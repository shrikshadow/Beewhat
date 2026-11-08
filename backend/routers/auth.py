from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from lib.auth import COOKIE, current_user, hash_password, optional_user, start_session, verify_password
from lib.pg import get_db
from models.schemas import LoginIn, OtpSendIn, OtpSendOut, PasswordChange, SignupIn, UserOut, UserUpdate
from models.tables import AuthSession, ExpertProfile, User

router = APIRouter(prefix="/auth", tags=["auth"])
MOCK_OTP = "123456"


def user_out(u: User) -> UserOut:
    return UserOut(id=u.id, email=u.email, full_name=u.full_name, role=u.role, phone=u.phone, created_at=u.created_at)


async def _email_taken(db: AsyncSession, email: str) -> bool:
    return (await db.execute(select(func.count()).where(User.email == email.lower()))).scalar_one() > 0


@router.post("/otp/send", response_model=OtpSendOut)
async def send_otp(body: OtpSendIn, db: AsyncSession = Depends(get_db)):
    if await _email_taken(db, body.email):
        raise HTTPException(409, "An account with this email already exists")
    return OtpSendOut(sent=True, demo_hint="Demo mode: use code 123456")


@router.post("/signup", response_model=UserOut)
async def signup(body: SignupIn, response: Response, db: AsyncSession = Depends(get_db)):
    email = body.email.lower()
    if body.role == "expert" and body.otp != MOCK_OTP:
        raise HTTPException(400, "Invalid verification code")
    if await _email_taken(db, email):
        raise HTTPException(409, "An account with this email already exists")
    user = User(
        email=email,
        password_hash=hash_password(body.password),
        full_name=body.full_name.strip(),
        role=body.role,
        email_verified=body.role == "expert",
    )
    db.add(user)
    await db.flush()
    if body.role == "expert":
        db.add(ExpertProfile(user_id=user.id, onboarding_step=2))
    await start_session(db, response, user)
    return user_out(user)


@router.post("/login", response_model=UserOut)
async def login(body: LoginIn, response: Response, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.email == body.email.lower()))).scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    await start_session(db, response, user)
    return user_out(user)


@router.post("/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get(COOKIE)
    if token:
        await db.execute(delete(AuthSession).where(AuthSession.token == token))
        await db.commit()
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@router.get("/me", response_model=UserOut | None)
async def me(user: User | None = Depends(optional_user)):
    return user_out(user) if user else None


@router.put("/me", response_model=UserOut)
async def update_me(body: UserUpdate, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    u = await db.get(User, user.id)
    if u.full_name != body.full_name.strip():
        # A changed name invalidates any earlier identity verification.
        prof = (await db.execute(select(ExpertProfile).where(ExpertProfile.user_id == u.id))).scalar_one_or_none()
        if prof:
            prof.identity_verified = False
    u.full_name = body.full_name.strip()
    u.phone = body.phone.strip()
    await db.commit()
    return user_out(u)


@router.post("/password")
async def change_password(body: PasswordChange, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    u = await db.get(User, user.id)
    if not verify_password(body.current_password, u.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    u.password_hash = hash_password(body.new_password)
    await db.commit()
    return {"ok": True}
