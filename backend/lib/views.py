"""ORM -> response-model mapping shared by routers."""

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.schemas import (
    BookingOut,
    DocumentMeta,
    ExpertCard,
    ExpertDetail,
    ExpertMe,
    PaymentOut,
    ReviewOut,
    Verification,
    VerificationItem,
)
from models.tables import Booking, ExpertProfile, Payment, Review, Setting

DEFAULT_COMMISSION = Decimal("12")


async def get_commission(db: AsyncSession) -> Decimal:
    s = await db.get(Setting, "commission_pct")
    return Decimal(s.value) if s else DEFAULT_COMMISSION


def verification(e: ExpertProfile) -> Verification:
    """Server decides what's verified; anything else is only ever a claim."""
    docs = {d.doc_type for d in e.documents}

    def item(verified: bool, claim: str) -> VerificationItem:
        if verified:
            return VerificationItem(status="verified", claim=claim)
        return VerificationItem(status="claimed" if claim else "not_provided", claim=claim)

    identity_claim = e.user.full_name + (" (ID document submitted)" if "identity" in docs else "")
    emp = " at ".join(x for x in [e.designation, e.company] if x)
    cred = e.credentials.strip() or ("Certificate submitted" if "certificate" in docs else "")
    return Verification(
        identity=item(e.identity_verified, identity_claim),
        employment=item(e.employment_verified, emp),
        credentials=item(e.credentials_verified, cred),
    )


def photo_url(e: ExpertProfile) -> str | None:
    return f"/api/experts/{e.id}/photo?v={int(e.updated_at.timestamp())}" if e.photo_mime else None


def card(e: ExpertProfile, rating: float = 0, count: int = 0) -> ExpertCard:
    return ExpertCard(
        id=e.id,
        full_name=e.user.full_name,
        profession=e.profession,
        designation=e.designation,
        company=e.company,
        years_experience=e.years_experience,
        short_intro=e.short_intro,
        expertise=e.expertise or [],
        languages=e.languages or [],
        categories=e.categories or [],
        price_15=e.price_15,
        price_30=e.price_30,
        price_60=e.price_60,
        available_now=e.available_now,
        rating=round(float(rating or 0), 1),
        review_count=int(count or 0),
        photo_url=photo_url(e),
        verification=verification(e),
        is_demo=e.is_demo,
    )


async def rating_of(db: AsyncSession, expert_id: str) -> tuple[float, int]:
    row = (
        await db.execute(
            select(func.coalesce(func.avg(Review.rating), 0), func.count(Review.id)).where(Review.expert_id == expert_id)
        )
    ).one()
    return float(row[0]), int(row[1])


async def _review_data(db: AsyncSession, ids: list[str]) -> dict[str, tuple[float, int, list[Review]]]:
    """Ratings + reviews for many experts in ONE query (each round-trip to the remote DB is costly)."""
    if not ids:
        return {}
    revs: dict[str, list[Review]] = {i: [] for i in ids}
    for r in (
        (await db.execute(select(Review).where(Review.expert_id.in_(ids)).order_by(Review.created_at.desc())))
        .scalars()
        .unique()
    ):
        revs[r.expert_id].append(r)
    out = {}
    for i, rs in revs.items():
        avg = sum(r.rating for r in rs) / len(rs) if rs else 0.0
        out[i] = (avg, len(rs), rs[:50])
    return out


async def detail(db: AsyncSession, e: ExpertProfile, data: tuple[float, int, list[Review]] | None = None) -> dict:
    rating, count, reviews = data or (await _review_data(db, [e.id]))[e.id]
    base = card(e, rating, count).model_dump()
    return {
        **base,
        "bio": e.bio,
        "linkedin_url": e.linkedin_url,
        "company_website": e.company_website,
        "credentials": e.credentials,
        "weekly_availability": e.weekly_availability or {},
        "reviews": [
            ReviewOut(
                id=r.id,
                rating=r.rating,
                comment=r.comment,
                reviewer_name=r.user.full_name,
                created_at=r.created_at,
                is_demo=r.is_demo,
            )
            for r in reviews
        ],
    }


async def expert_detail(db: AsyncSession, e: ExpertProfile) -> ExpertDetail:
    return ExpertDetail(**(await detail(db, e)))


async def expert_me_many(db: AsyncSession, experts: list[ExpertProfile]) -> list[ExpertMe]:
    data = await _review_data(db, [e.id for e in experts])
    return [await expert_me(db, e, data[e.id]) for e in experts]


async def expert_me(db: AsyncSession, e: ExpertProfile, data: tuple[float, int, list[Review]] | None = None) -> ExpertMe:
    return ExpertMe(
        **(await detail(db, e, data)),
        email=e.user.email,
        status=e.status,
        rejection_reason=e.rejection_reason,
        onboarding_step=e.onboarding_step,
        identity_verified=e.identity_verified,
        employment_verified=e.employment_verified,
        credentials_verified=e.credentials_verified,
        documents=[
            DocumentMeta(
                id=d.id, doc_type=d.doc_type, filename=d.filename, mime=d.mime, size=d.size, uploaded_at=d.uploaded_at
            )
            for d in e.documents
        ],
        submitted_at=e.submitted_at,
        approved_at=e.approved_at,
    )


def payment_out(p: Payment) -> PaymentOut:
    b = p.booking
    return PaymentOut(
        id=p.id,
        booking_id=p.booking_id,
        amount=float(p.amount),
        commission_pct=float(p.commission_pct),
        commission_amount=float(p.commission_amount),
        expert_net=float(p.expert_net),
        currency=p.currency,
        transaction_id=p.transaction_id,
        method=p.method,
        status=p.status,
        created_at=p.created_at,
        expert_name=b.expert.user.full_name,
        user_name=b.user.full_name,
        duration_minutes=b.duration_minutes,
    )


def booking_out(b: Booking) -> BookingOut:
    past = b.end_at <= datetime.now(timezone.utc)
    return BookingOut(
        id=b.id,
        expert_id=b.expert_id,
        expert_name=b.expert.user.full_name,
        expert_profession=b.expert.designation or b.expert.profession,
        user_id=b.user_id,
        user_name=b.user.full_name,
        user_email=b.user.email,
        duration_minutes=b.duration_minutes,
        start_at=b.start_at,
        end_at=b.end_at,
        topic=b.topic,
        status=b.status,
        amount=float(b.payment.amount) if b.payment else 0,
        transaction_id=b.payment.transaction_id if b.payment else "",
        is_past=past,
        can_review=past and b.status == "confirmed" and b.review is None,
        created_at=b.created_at,
    )
