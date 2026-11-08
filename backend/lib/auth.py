"""Cookie sessions stored in Postgres + role dependencies. Role is re-read from the DB every request."""

import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lib.pg import get_db
from models.tables import AuthSession, User

COOKIE = "session"
TTL = timedelta(days=7)


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except ValueError:
        return False


async def start_session(db: AsyncSession, response: Response, user: User) -> None:
    token = secrets.token_urlsafe(32)
    db.add(AuthSession(token=token, user_id=user.id, expires_at=datetime.now(timezone.utc) + TTL))
    await db.commit()
    response.set_cookie(COOKIE, token, httponly=True, samesite="lax", max_age=int(TTL.total_seconds()), path="/")


async def optional_user(request: Request, db: AsyncSession = Depends(get_db)) -> User | None:
    token = request.cookies.get(COOKIE)
    if not token:
        return None
    s = (await db.execute(select(AuthSession).where(AuthSession.token == token))).scalar_one_or_none()
    if not s or s.expires_at < datetime.now(timezone.utc):
        return None
    return s.user


async def current_user(user: User | None = Depends(optional_user)) -> User:
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user


def require_role(*roles: str):
    async def dep(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, "Forbidden")
        return user

    return dep
