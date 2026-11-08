"""Admin-only: approvals, verification controls, users, bookings, payments, stats, commission."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import undefer

from lib.auth import require_role
from lib.pg import get_db
from lib.views import booking_out, expert_me, expert_me_many, get_commission, payment_out
from models.schemas import AdminStats, BookingOut, CommissionIn, ExpertMe, PaymentOut, PublicSettings, RejectIn, UserOut, VerifyIn
from models.tables import Booking, ExpertDocument, ExpertProfile, Payment, Setting, User, utcnow
from routers.auth import user_out

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_role("admin"))])


async def _expert(db: AsyncSession, expert_id: str) -> ExpertProfile:
    e = await db.get(ExpertProfile, expert_id)
    if not e:
        raise HTTPException(404, "Expert not found")
    return e


@router.get("/stats", response_model=AdminStats)
async def stats(db: AsyncSession = Depends(get_db)):
    async def count(stmt):
        return (await db.execute(stmt)).scalar_one()

    return AdminStats(
        users=await count(select(func.count(User.id))),
        experts_approved=await count(select(func.count(ExpertProfile.id)).where(ExpertProfile.status == "approved")),
        experts_pending=await count(select(func.count(ExpertProfile.id)).where(ExpertProfile.status == "pending")),
        bookings=await count(select(func.count(Booking.id)).where(Booking.status == "confirmed")),
        gross_volume=float(await count(select(func.coalesce(func.sum(Payment.amount), 0)))),
        commission_earned=float(await count(select(func.coalesce(func.sum(Payment.commission_amount), 0)))),
        commission_pct=float(await get_commission(db)),
    )


@router.get("/experts", response_model=list[ExpertMe])
async def experts(
    status: Literal["all", "draft", "pending", "approved", "rejected"] = "all", db: AsyncSession = Depends(get_db)
):
    stmt = select(ExpertProfile).order_by(ExpertProfile.submitted_at.desc().nullslast(), ExpertProfile.created_at.desc())
    if status != "all":
        stmt = stmt.where(ExpertProfile.status == status)
    return await expert_me_many(db, list((await db.execute(stmt)).scalars().unique()))


@router.post("/experts/{expert_id}/approve", response_model=ExpertMe)
async def approve(expert_id: str, db: AsyncSession = Depends(get_db)):
    e = await _expert(db, expert_id)
    if e.status == "draft":
        raise HTTPException(400, "Expert has not submitted an application yet")
    e.status, e.rejection_reason, e.approved_at = "approved", "", utcnow()
    await db.commit()
    return await expert_me(db, e)


@router.post("/experts/{expert_id}/reject", response_model=ExpertMe)
async def reject(expert_id: str, body: RejectIn, db: AsyncSession = Depends(get_db)):
    e = await _expert(db, expert_id)
    e.status, e.rejection_reason, e.approved_at = "rejected", body.reason.strip(), None
    await db.commit()
    return await expert_me(db, e)


@router.post("/experts/{expert_id}/verify", response_model=ExpertMe)
async def verify(expert_id: str, body: VerifyIn, db: AsyncSession = Depends(get_db)):
    e = await _expert(db, expert_id)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(e, k, v)
    await db.commit()
    return await expert_me(db, e)


@router.get("/documents/{doc_id}")
async def document(doc_id: str, db: AsyncSession = Depends(get_db)):
    d = (
        await db.execute(select(ExpertDocument).options(undefer(ExpertDocument.data)).where(ExpertDocument.id == doc_id))
    ).scalar_one_or_none()
    if not d:
        raise HTTPException(404, "Document not found")
    return Response(
        d.data,
        media_type=d.mime,
        headers={"Content-Disposition": f'inline; filename="{d.filename}"', "Cache-Control": "private, no-store"},
    )


@router.get("/users", response_model=list[UserOut])
async def users(db: AsyncSession = Depends(get_db)):
    return [user_out(u) for u in (await db.execute(select(User).order_by(User.created_at.desc()))).scalars()]


@router.get("/bookings", response_model=list[BookingOut])
async def bookings(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Booking).order_by(Booking.start_at.desc()).limit(500))).scalars().unique()
    return [booking_out(b) for b in rows]


@router.get("/payments", response_model=list[PaymentOut])
async def payments(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Payment).order_by(Payment.created_at.desc()).limit(500))).scalars().unique()
    return [payment_out(p) for p in rows]


@router.put("/settings/commission", response_model=PublicSettings)
async def set_commission(body: CommissionIn, db: AsyncSession = Depends(get_db)):
    s = await db.get(Setting, "commission_pct")
    val = f"{body.commission_pct:.2f}"
    if s:
        s.value = val
    else:
        db.add(Setting(key="commission_pct", value=val))
    await db.commit()
    return PublicSettings(commission_pct=float(val))
