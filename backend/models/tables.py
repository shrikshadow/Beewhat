"""SQLAlchemy ORM tables (PostgreSQL). Schema changes go through Alembic migrations only."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def uid() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(16), default="user", index=True)
    phone: Mapped[str] = mapped_column(String(32), default="")
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (CheckConstraint("role in ('user','expert','admin')", name="ck_users_role"),)


class AuthSession(Base):
    __tablename__ = "sessions"
    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    user: Mapped[User] = relationship(lazy="joined")


class ExpertProfile(Base):
    __tablename__ = "expert_profiles"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    profession: Mapped[str] = mapped_column(String(80), default="", index=True)
    designation: Mapped[str] = mapped_column(String(120), default="")
    company: Mapped[str] = mapped_column(String(120), default="")
    company_website: Mapped[str] = mapped_column(String(255), default="")
    years_experience: Mapped[int] = mapped_column(Integer, default=0)
    linkedin_url: Mapped[str] = mapped_column(String(255), default="")
    credentials: Mapped[str] = mapped_column(Text, default="")
    short_intro: Mapped[str] = mapped_column(String(200), default="")
    bio: Mapped[str] = mapped_column(Text, default="")
    expertise: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    languages: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    categories: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    price_15: Mapped[int] = mapped_column(Integer, default=0)
    price_30: Mapped[int] = mapped_column(Integer, default=0)
    price_60: Mapped[int] = mapped_column(Integer, default=0)
    weekly_availability: Mapped[dict] = mapped_column(JSONB, default=dict)
    available_now: Mapped[bool] = mapped_column(Boolean, default=False)
    photo_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True, deferred=True)
    photo_mime: Mapped[str] = mapped_column(String(64), default="")
    status: Mapped[str] = mapped_column(String(16), default="draft", index=True)
    rejection_reason: Mapped[str] = mapped_column(Text, default="")
    onboarding_step: Mapped[int] = mapped_column(Integer, default=2)
    identity_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    employment_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    credentials_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    user: Mapped[User] = relationship(lazy="joined")
    documents: Mapped[list["ExpertDocument"]] = relationship(
        lazy="selectin", order_by="ExpertDocument.uploaded_at", cascade="all, delete-orphan"
    )
    __table_args__ = (
        CheckConstraint("status in ('draft','pending','approved','rejected')", name="ck_expert_status"),
        CheckConstraint("price_15 >= 0 and price_30 >= 0 and price_60 >= 0", name="ck_expert_prices"),
    )


class ExpertDocument(Base):
    """Private verification uploads — only ever served through admin routes."""

    __tablename__ = "expert_documents"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    expert_id: Mapped[str] = mapped_column(ForeignKey("expert_profiles.id", ondelete="CASCADE"), index=True)
    doc_type: Mapped[str] = mapped_column(String(24))
    filename: Mapped[str] = mapped_column(String(255))
    mime: Mapped[str] = mapped_column(String(100))
    size: Mapped[int] = mapped_column(Integer)
    data: Mapped[bytes] = mapped_column(LargeBinary, deferred=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (CheckConstraint("doc_type in ('identity','employment','certificate')", name="ck_doc_type"),)


class Booking(Base):
    __tablename__ = "bookings"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expert_id: Mapped[str] = mapped_column(ForeignKey("expert_profiles.id", ondelete="CASCADE"))
    duration_minutes: Mapped[int] = mapped_column(Integer)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    topic: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(16), default="confirmed")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    user: Mapped[User] = relationship(lazy="joined")
    expert: Mapped[ExpertProfile] = relationship(lazy="joined")
    payment: Mapped["Payment | None"] = relationship(lazy="selectin", uselist=False, back_populates="booking")
    review: Mapped["Review | None"] = relationship(lazy="selectin", uselist=False)
    __table_args__ = (
        CheckConstraint("duration_minutes in (15,30,60)", name="ck_booking_duration"),
        CheckConstraint("end_at > start_at", name="ck_booking_range"),
        CheckConstraint("status in ('confirmed','cancelled')", name="ck_booking_status"),
        Index("ix_bookings_expert_start", "expert_id", "start_at"),
    )


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    booking_id: Mapped[str] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), unique=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expert_id: Mapped[str] = mapped_column(ForeignKey("expert_profiles.id", ondelete="CASCADE"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    commission_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    commission_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    expert_net: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    transaction_id: Mapped[str] = mapped_column(String(40), unique=True)
    method: Mapped[str] = mapped_column(String(16), default="demo")
    status: Mapped[str] = mapped_column(String(16), default="succeeded")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    booking: Mapped[Booking] = relationship(lazy="joined", back_populates="payment")
    __table_args__ = (CheckConstraint("amount >= 0", name="ck_payment_amount"),)


class Review(Base):
    __tablename__ = "reviews"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    expert_id: Mapped[str] = mapped_column(ForeignKey("expert_profiles.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    booking_id: Mapped[str | None] = mapped_column(ForeignKey("bookings.id", ondelete="SET NULL"), unique=True, nullable=True)
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str] = mapped_column(Text, default="")
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    user: Mapped[User] = relationship(lazy="joined")
    __table_args__ = (CheckConstraint("rating between 1 and 5", name="ck_review_rating"),)


class Setting(Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(String(255))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
