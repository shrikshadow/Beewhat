"""Supabase PostgreSQL (transaction pooler) — the app's only datastore.

Import `get_db` (FastAPI dependency) or `SessionLocal` (scripts) from here.
"""

import os
import re
import uuid
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.engine import URL
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

load_dotenv(Path(__file__).parent.parent / ".env")

_URI = re.compile(r"^postgres(?:ql)?(?:\+\w+)?://([^:]+):(.*)@([^@:/]+):(\d+)/([^?\s]+)")


def db_url(driver: str, query: dict | None = None) -> URL:
    """Parse DATABASE_URL by hand so passwords with raw special characters still work."""
    m = _URI.match(os.environ["DATABASE_URL"].strip())
    if not m:
        raise RuntimeError("DATABASE_URL is not a valid postgres URI")
    user, pw, host, port, name = m.groups()
    return URL.create(driver, username=user, password=pw, host=host, port=int(port), database=name, query=query or {})


engine = create_async_engine(
    # pgbouncer/supavisor transaction mode: no prepared-statement caching, unique statement names
    db_url("postgresql+asyncpg", {"prepared_statement_cache_size": "0"}),
    pool_size=5,
    max_overflow=5,
    pool_timeout=30,
    pool_recycle=1800,
    pool_pre_ping=False,
    connect_args={
        "statement_cache_size": 0,
        "command_timeout": 30,
        "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4()}__",
    },
)

SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False, autoflush=False)


async def get_db():
    async with SessionLocal() as session:
        yield session
