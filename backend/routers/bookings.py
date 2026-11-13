"""Razorpay checkout, my bookings/payments, and reviews."""

import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from lib.auth import current_user
from lib.pg import get_db
from lib.slots import is_open_slot
from lib.views import booking_out, get_commission, payment_out
from models.schemas import BookingOut, CheckoutIn, CheckoutOrderOut, CheckoutOut, CheckoutVerifyIn, PaymentOut, ReviewIn
from models.tables import Booking, ExpertProfile, Payment, Review, User, uid, utcnow
from routers.experts import booked_ranges

router = APIRouter(tags=["bookings"])
CENT = Decimal("0.01")


def razorpay_credentials():
    key_id = os.getenv("RAZORPAY_KEY_ID", "").strip()
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "").strip()
    if not key_id or not key_secret:
        raise HTTPException(503, "Razorpay is not configured")
    return key_id, key_secret


async def gateway_request(method: str, path: str, **kwargs):
    key_id, key_secret = razorpay_credentials()
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.request(
                method, f"https://api.razorpay.com/v1/{path}", auth=(key_id, key_secret), **kwargs
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError:
        raise HTTPException(502, "Unable to reach Razorpay. Please try again.") from None


async def validate_checkout(body: CheckoutIn | CheckoutVerifyIn, user: User, db: AsyncSession):
    # Row lock serialises concurrent checkouts for the same expert; the exclusion constraint is the backstop.
    e = (
        await db.execute(select(ExpertProfile).where(ExpertProfile.id == body.expert_id).with_for_update(of=ExpertProfile))
    ).scalar_one_or_none()
    if not e or e.status != "approved":
        raise HTTPException(404, "Expert not found")
    if e.user_id == user.id:
        raise HTTPException(400, "You cannot book a session with yourself")
    price = {15: e.price_15, 30: e.price_30, 60: e.price_60}[body.duration_minutes]
    if price <= 0:
        raise HTTPException(400, "This session length is not offered")
    start = body.start_at.astimezone(timezone.utc)
    if not is_open_slot(e.weekly_availability or {}, body.duration_minutes, start, await booked_ranges(db, e.id)):
        raise HTTPException(409, "That time slot is no longer available. Please pick another.")

    amount = Decimal(price).quantize(CENT)
    return e, start, amount


@router.post("/checkout/order", response_model=CheckoutOrderOut)
async def create_checkout_order(body: CheckoutIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    e, start, amount = await validate_checkout(body, user, db)
    key_id, _ = razorpay_credentials()
    order = await gateway_request(
        "POST",
        "orders",
        json={
            "amount": int(amount * 100),
            "currency": "INR",
            "receipt": uid()[:40],
            "notes": {
                "user_id": user.id,
                "expert_id": e.id,
                "duration_minutes": str(body.duration_minutes),
                "start_at": start.isoformat(),
                "topic": body.topic.strip()[:500],
            },
        },
    )
    return CheckoutOrderOut(order_id=order["id"], amount=order["amount"], currency=order["currency"], key_id=key_id)


@router.post("/checkout/verify", response_model=CheckoutOut)
async def verify_checkout(
    body: CheckoutVerifyIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
):
    _, secret = razorpay_credentials()
    expected = hmac.new(
        secret.encode(), f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, body.razorpay_signature):
        raise HTTPException(400, "Razorpay payment signature is invalid")
    order = await gateway_request("GET", f"orders/{body.razorpay_order_id}")
    payment_info = await gateway_request("GET", f"payments/{body.razorpay_payment_id}")
    if (
        order.get("status") != "paid"
        or payment_info.get("order_id") != order.get("id")
        or payment_info.get("status") != "captured"
    ):
        raise HTTPException(400, "Payment is not captured")
    notes = order.get("notes") or {}
    if (
        notes.get("user_id") != user.id
        or notes.get("expert_id") != body.expert_id
        or notes.get("duration_minutes") != str(body.duration_minutes)
        or notes.get("start_at") != body.start_at.astimezone(timezone.utc).isoformat()
        or payment_info.get("amount") != order.get("amount")
        or order.get("currency") != "INR"
    ):
        raise HTTPException(400, "Payment details do not match this booking")
    e, start, amount = await validate_checkout(body, user, db)
    if int(amount * 100) != order.get("amount"):
        raise HTTPException(400, "Booking amount changed. Please start checkout again.")
    pct = await get_commission(db)
    commission = (amount * pct / 100).quantize(CENT, rounding=ROUND_HALF_UP)
    booking = Booking(
        id=uid(),
        user_id=user.id,
        expert_id=e.id,
        duration_minutes=body.duration_minutes,
        start_at=start,
        end_at=start + timedelta(minutes=body.duration_minutes),
        topic=notes.get("topic", ""),
        status="confirmed",
        created_at=utcnow(),
    )
    payment = Payment(
        id=uid(),
        booking_id=booking.id,
        user_id=user.id,
        expert_id=e.id,
        amount=amount,
        commission_pct=pct,
        commission_amount=commission,
        expert_net=amount - commission,
        currency="INR",
        method="razorpay",
        status="succeeded",
        transaction_id=body.razorpay_payment_id,
        created_at=utcnow(),
    )
    db.add_all([booking, payment])  # unit of work inserts booking before payment (FK order), one transaction
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "That time slot was just booked. Please pick another.")
    # Build the response from in-memory objects (no extra round-trips to the remote DB).
    b_out = BookingOut(
        id=booking.id, expert_id=e.id, expert_name=e.user.full_name, expert_profession=e.designation or e.profession,
        user_id=user.id, user_name=user.full_name, user_email=user.email, duration_minutes=booking.duration_minutes,
        start_at=booking.start_at, end_at=booking.end_at, topic=booking.topic, status=booking.status,
        amount=float(amount), transaction_id=payment.transaction_id, is_past=False, can_review=False,
        created_at=booking.created_at,
    )
    p_out = PaymentOut(
        id=payment.id, booking_id=booking.id, amount=float(amount), commission_pct=float(pct),
        commission_amount=float(commission), expert_net=float(amount - commission), currency="INR",
        transaction_id=payment.transaction_id, method="razorpay", status="succeeded", created_at=payment.created_at,
        expert_name=e.user.full_name, user_name=user.full_name, duration_minutes=booking.duration_minutes,
    )
    return CheckoutOut(booking=b_out, payment=p_out)


@router.get("/me/bookings", response_model=list[BookingOut])
async def my_bookings(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Booking).where(Booking.user_id == user.id).order_by(Booking.start_at.desc()))).scalars()
    return [booking_out(b) for b in rows.unique()]


@router.get("/me/payments", response_model=list[PaymentOut])
async def my_payments(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Payment).where(Payment.user_id == user.id).order_by(Payment.created_at.desc()))).scalars()
    return [payment_out(p) for p in rows.unique()]


@router.post("/me/bookings/{booking_id}/review", response_model=BookingOut)
async def review_booking(
    booking_id: str, body: ReviewIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
):
    b = (await db.execute(select(Booking).where(Booking.id == booking_id, Booking.user_id == user.id))).scalar_one_or_none()
    if not b:
        raise HTTPException(404, "Booking not found")
    if b.end_at > datetime.now(timezone.utc) or b.status != "confirmed":
        raise HTTPException(400, "You can review a session after it has ended")
    if b.review:
        raise HTTPException(409, "You already reviewed this session")
    db.add(Review(expert_id=b.expert_id, user_id=user.id, booking_id=b.id, rating=body.rating, comment=body.comment.strip()))
    await db.commit()
    b = (
        await db.execute(select(Booking).where(Booking.id == booking_id).execution_options(populate_existing=True))
    ).scalar_one()
    return booking_out(b)
