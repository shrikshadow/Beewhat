"""The signed-in expert's own application/profile, documents, bookings and earnings."""

import base64
import binascii

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lib.auth import require_role
from lib.pg import get_db
from lib.views import booking_out, expert_me, payment_out
from models.schemas import BookingOut, DocumentUploadIn, Earnings, ExpertMe, ExpertProfileUpdate, FileUploadIn
from models.tables import Booking, ExpertDocument, ExpertProfile, Payment, User, utcnow

router = APIRouter(prefix="/expert/me", tags=["expert"])
MAX_BYTES = 5 * 1024 * 1024
DOC_MIMES = {"application/pdf", "image/png", "image/jpeg", "image/webp"}
PHOTO_MIMES = {"image/png", "image/jpeg", "image/webp"}
ALLOWED_CATEGORIES = {"career-jobs", "technology", "product-business", "data-analytics", "startups"}


async def own_profile(db: AsyncSession, user: User, fresh: bool = False) -> ExpertProfile:
    stmt = select(ExpertProfile).where(ExpertProfile.user_id == user.id)
    if fresh:  # reload columns + eager relationships after a commit (no lazy IO in async)
        stmt = stmt.execution_options(populate_existing=True)
    e = (await db.execute(stmt)).scalar_one_or_none()
    if not e:
        raise HTTPException(404, "Expert profile not found")
    return e


def _decode(body: FileUploadIn, mimes: set[str]) -> bytes:
    if body.mime not in mimes:
        raise HTTPException(400, "Unsupported file type")
    try:
        raw = base64.b64decode(body.data_base64.split(",")[-1], validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(400, "Invalid file data")
    if len(raw) > MAX_BYTES:
        raise HTTPException(400, "File must be 5 MB or smaller")
    return raw


@router.get("", response_model=ExpertMe)
async def get_me(user: User = Depends(require_role("expert")), db: AsyncSession = Depends(get_db)):
    return await expert_me(db, await own_profile(db, user))


@router.put("", response_model=ExpertMe)
async def update_me(
    body: ExpertProfileUpdate, user: User = Depends(require_role("expert")), db: AsyncSession = Depends(get_db)
):
    e = await own_profile(db, user)
    data = body.model_dump(exclude_unset=True)
    if "categories" in data and not set(data["categories"]) <= ALLOWED_CATEGORIES:
        raise HTTPException(400, "Unknown category")
    if "weekly_availability" in data:
        for day, wins in data["weekly_availability"].items():
            if day not in {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}:
                raise HTTPException(400, f"Unknown day {day}")
            for w in wins:
                if w["start"] >= w["end"]:
                    raise HTTPException(400, "Availability end time must be after start time")
    # Changing a verified claim drops its verification — it becomes a fresh, unverified claim.
    if ("company" in data and data["company"] != e.company) or (
        "designation" in data and data["designation"] != e.designation
    ):
        e.employment_verified = False
    if "credentials" in data and data["credentials"] != e.credentials:
        e.credentials_verified = False
    name = data.pop("full_name", None)
    if name and name.strip() != e.user.full_name:
        u = await db.get(User, user.id)
        u.full_name = name.strip()
        e.identity_verified = False
    for k, v in data.items():
        if k in {"expertise", "languages"}:
            v = [s.strip() for s in v if s.strip()]
        setattr(e, k, v)
    e.updated_at = utcnow()
    await db.commit()
    return await expert_me(db, await own_profile(db, user, fresh=True))


@router.post("/photo", response_model=ExpertMe)
async def upload_photo(body: FileUploadIn, user: User = Depends(require_role("expert")), db: AsyncSession = Depends(get_db)):
    e = await own_profile(db, user)
    e.photo_data = _decode(body, PHOTO_MIMES)
    e.photo_mime = body.mime
    e.updated_at = utcnow()
    await db.commit()
    return await expert_me(db, e)


@router.post("/documents", response_model=ExpertMe)
async def upload_document(
    body: DocumentUploadIn, user: User = Depends(require_role("expert")), db: AsyncSession = Depends(get_db)
):
    e = await own_profile(db, user)
    raw = _decode(body, DOC_MIMES)
    db.add(ExpertDocument(expert_id=e.id, doc_type=body.doc_type, filename=body.filename, mime=body.mime, size=len(raw), data=raw))
    await db.commit()
    return await expert_me(db, await own_profile(db, user, fresh=True))


@router.delete("/documents/{doc_id}", response_model=ExpertMe)
async def delete_document(doc_id: str, user: User = Depends(require_role("expert")), db: AsyncSession = Depends(get_db)):
    e = await own_profile(db, user)
    d = (
        await db.execute(select(ExpertDocument).where(ExpertDocument.id == doc_id, ExpertDocument.expert_id == e.id))
    ).scalar_one_or_none()
    if not d:
        raise HTTPException(404, "Document not found")
    await db.delete(d)
    await db.commit()
    return await expert_me(db, await own_profile(db, user, fresh=True))


@router.post("/submit", response_model=ExpertMe)
async def submit(user: User = Depends(require_role("expert")), db: AsyncSession = Depends(get_db)):
    e = await own_profile(db, user)
    if e.status in {"pending", "approved"}:
        raise HTTPException(400, f"Application is already {e.status}")
    missing = [
        label
        for label, ok in [
            ("profession", e.profession),
            ("designation", e.designation),
            ("company", e.company),
            ("LinkedIn URL", e.linkedin_url),
            ("ID document", any(d.doc_type == "identity" for d in e.documents)),
            ("expertise", e.expertise),
            ("languages", e.languages),
            ("categories", e.categories),
            ("short intro", e.short_intro),
            ("bio", e.bio),
            ("prices", e.price_15 > 0 and e.price_30 > 0 and e.price_60 > 0),
            ("weekly availability", any(e.weekly_availability.values()) if e.weekly_availability else False),
        ]
        if not ok
    ]
    if missing:
        raise HTTPException(400, "Missing: " + ", ".join(missing))
    e.status = "pending"
    e.rejection_reason = ""
    e.submitted_at = utcnow()
    await db.commit()
    return await expert_me(db, e)


@router.get("/bookings", response_model=list[BookingOut])
async def expert_bookings(user: User = Depends(require_role("expert")), db: AsyncSession = Depends(get_db)):
    e = await own_profile(db, user)
    rows = (await db.execute(select(Booking).where(Booking.expert_id == e.id).order_by(Booking.start_at.desc()))).scalars()
    return [booking_out(b) for b in rows.unique()]


@router.get("/earnings", response_model=Earnings)
async def earnings(user: User = Depends(require_role("expert")), db: AsyncSession = Depends(get_db)):
    e = await own_profile(db, user)
    rows = list(
        (await db.execute(select(Payment).where(Payment.expert_id == e.id, Payment.status == "succeeded").order_by(Payment.created_at.desc())))
        .scalars()
        .unique()
    )
    return Earnings(
        gross=float(sum(p.amount for p in rows)),
        commission=float(sum(p.commission_amount for p in rows)),
        net=float(sum(p.expert_net for p in rows)),
        sessions=len(rows),
        payments=[payment_out(p) for p in rows],
    )
