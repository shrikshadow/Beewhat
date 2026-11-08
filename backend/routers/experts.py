"""Public discovery: listing with filters, detail, photo, slots, categories, public settings."""

from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import undefer

from lib.auth import optional_user
from lib.pg import get_db
from lib.slots import generate_slots
from lib.views import card, expert_detail, get_commission
from models.schemas import CategoryCount, ExpertDetail, ExpertListOut, PublicSettings, SlotDay
from models.tables import Booking, ExpertProfile, Review, User

router = APIRouter(tags=["experts"])


@router.get("/experts", response_model=ExpertListOut)
async def list_experts(
    q: str = "",
    category: str = "",
    profession: str = "",
    language: str = "",
    min_rating: float = Query(0, ge=0, le=5),
    min_experience: int = Query(0, ge=0),
    min_price: int = Query(0, ge=0),
    max_price: int = Query(0, ge=0),
    available_now: bool = False,
    sort: Literal["recommended", "rating", "price_asc", "price_desc", "experience", "trending"] = "recommended",
    limit: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    rq = (
        select(Review.expert_id, func.avg(Review.rating).label("avg"), func.count(Review.id).label("cnt"))
        .group_by(Review.expert_id)
        .subquery()
    )
    since = datetime.now(timezone.utc) - timedelta(days=30)
    bq = (
        select(Booking.expert_id, func.count(Booking.id).label("bc"))
        .where(Booking.created_at >= since, Booking.status == "confirmed")
        .group_by(Booking.expert_id)
        .subquery()
    )
    avg = func.coalesce(rq.c.avg, 0)
    cnt = func.coalesce(rq.c.cnt, 0)
    bc = func.coalesce(bq.c.bc, 0)
    stmt = (
        select(ExpertProfile, avg, cnt)
        .join(User, User.id == ExpertProfile.user_id)
        .outerjoin(rq, rq.c.expert_id == ExpertProfile.id)
        .outerjoin(bq, bq.c.expert_id == ExpertProfile.id)
        .where(ExpertProfile.status == "approved")
    )
    if q.strip():
        p = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                User.full_name.ilike(p),
                ExpertProfile.profession.ilike(p),
                ExpertProfile.designation.ilike(p),
                ExpertProfile.company.ilike(p),
                func.array_to_string(ExpertProfile.expertise, " ").ilike(p),
            )
        )
    if category:
        stmt = stmt.where(ExpertProfile.categories.any(category))
    if profession:
        stmt = stmt.where(ExpertProfile.profession == profession)
    if language:
        stmt = stmt.where(ExpertProfile.languages.any(language))
    if min_rating:
        stmt = stmt.where(avg >= min_rating)
    if min_experience:
        stmt = stmt.where(ExpertProfile.years_experience >= min_experience)
    if min_price:
        stmt = stmt.where(ExpertProfile.price_30 >= min_price)
    if max_price:
        stmt = stmt.where(ExpertProfile.price_30 <= max_price)
    if available_now:
        stmt = stmt.where(ExpertProfile.available_now.is_(True))

    total_col = func.count().over().label("total")
    order = {
        "recommended": [ExpertProfile.available_now.desc(), (avg * func.ln(cnt + 2)).desc()],
        "rating": [avg.desc(), cnt.desc()],
        "price_asc": [ExpertProfile.price_30.asc()],
        "price_desc": [ExpertProfile.price_30.desc()],
        "experience": [ExpertProfile.years_experience.desc()],
        "trending": [bc.desc(), cnt.desc()],
    }[sort]
    rows = (
        await db.execute(stmt.add_columns(total_col).order_by(*order, ExpertProfile.id).limit(limit).offset(offset))
    ).unique().all()
    total = rows[0][3] if rows else 0
    return ExpertListOut(items=[card(e, a, c) for e, a, c, _ in rows], total=total)


@router.get("/categories", response_model=list[CategoryCount])
async def categories(db: AsyncSession = Depends(get_db)):
    cat = func.unnest(ExpertProfile.categories).label("cat")
    sub = select(cat).where(ExpertProfile.status == "approved").subquery()
    rows = (await db.execute(select(sub.c.cat, func.count()).group_by(sub.c.cat))).all()
    return [CategoryCount(id=r[0], count=r[1]) for r in rows]


@router.get("/settings/public", response_model=PublicSettings)
async def public_settings(db: AsyncSession = Depends(get_db)):
    return PublicSettings(commission_pct=float(await get_commission(db)))


async def _visible_expert(db: AsyncSession, expert_id: str, viewer: User | None) -> ExpertProfile:
    e = await db.get(ExpertProfile, expert_id)
    if not e:
        raise HTTPException(404, "Expert not found")
    if e.status != "approved" and not (viewer and (viewer.role == "admin" or viewer.id == e.user_id)):
        raise HTTPException(404, "Expert not found")
    return e


@router.get("/experts/{expert_id}", response_model=ExpertDetail)
async def get_expert(expert_id: str, db: AsyncSession = Depends(get_db), viewer: User | None = Depends(optional_user)):
    return await expert_detail(db, await _visible_expert(db, expert_id, viewer))


@router.get("/experts/{expert_id}/photo")
async def get_photo(expert_id: str, db: AsyncSession = Depends(get_db), viewer: User | None = Depends(optional_user)):
    await _visible_expert(db, expert_id, viewer)
    e = (
        await db.execute(select(ExpertProfile).options(undefer(ExpertProfile.photo_data)).where(ExpertProfile.id == expert_id))
    ).scalar_one()
    if not e.photo_data:
        raise HTTPException(404, "No photo")
    return Response(e.photo_data, media_type=e.photo_mime, headers={"Cache-Control": "public, max-age=86400"})


async def booked_ranges(db: AsyncSession, expert_id: str) -> list[tuple[datetime, datetime]]:
    rows = (
        await db.execute(
            select(Booking.start_at, Booking.end_at).where(
                Booking.expert_id == expert_id,
                Booking.status == "confirmed",
                Booking.end_at > datetime.now(timezone.utc),
            )
        )
    ).all()
    return [(r[0], r[1]) for r in rows]


@router.get("/experts/{expert_id}/slots", response_model=list[SlotDay])
async def get_slots(
    expert_id: str,
    duration: int = 30,
    db: AsyncSession = Depends(get_db),
    viewer: User | None = Depends(optional_user),
):
    if duration not in (15, 30, 60):
        raise HTTPException(422, "duration must be 15, 30 or 60")
    e = await _visible_expert(db, expert_id, viewer)
    return [SlotDay(**d) for d in generate_slots(e.weekly_availability or {}, duration, await booked_ranges(db, e.id))]
