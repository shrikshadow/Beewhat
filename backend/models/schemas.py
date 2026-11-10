"""Pydantic v2 request/response models. Mirrored by hand in frontend/src/lib/types.ts."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

Role = Literal["user", "expert", "admin"]
VerStatus = Literal["verified", "claimed", "not_provided"]


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: Role
    phone: str
    created_at: datetime


class SignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=120)
    role: Literal["user", "expert"] = "user"
    otp: str | None = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class OtpSendIn(BaseModel):
    email: EmailStr


class OtpSendOut(BaseModel):
    sent: bool
    demo_hint: str


class UserUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(default="", max_length=32)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class TimeWindow(BaseModel):
    start: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    end: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")


class VerificationItem(BaseModel):
    status: VerStatus
    claim: str


class Verification(BaseModel):
    identity: VerificationItem
    employment: VerificationItem
    credentials: VerificationItem


class ExpertCard(BaseModel):
    id: str
    full_name: str
    profession: str
    designation: str
    company: str
    years_experience: int
    short_intro: str
    expertise: list[str]
    languages: list[str]
    categories: list[str]
    price_15: int
    price_30: int
    price_60: int
    available_now: bool
    rating: float
    review_count: int
    photo_url: str | None
    verification: Verification
    is_demo: bool


class ReviewOut(BaseModel):
    id: str
    rating: int
    comment: str
    reviewer_name: str
    created_at: datetime
    is_demo: bool


class ExpertDetail(ExpertCard):
    bio: str
    linkedin_url: str
    company_website: str
    credentials: str
    weekly_availability: dict[str, list[TimeWindow]]
    reviews: list[ReviewOut]


class DocumentMeta(BaseModel):
    id: str
    doc_type: str
    filename: str
    mime: str
    size: int
    uploaded_at: datetime


class ExpertMe(ExpertDetail):
    email: str
    status: Literal["draft", "pending", "approved", "rejected"]
    rejection_reason: str
    onboarding_step: int
    identity_verified: bool
    employment_verified: bool
    credentials_verified: bool
    documents: list[DocumentMeta]
    submitted_at: datetime | None
    approved_at: datetime | None


class ExpertListOut(BaseModel):
    items: list[ExpertCard]
    total: int


class CategoryCount(BaseModel):
    id: str
    count: int


class ExpertProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    profession: str | None = Field(default=None, max_length=80)
    designation: str | None = Field(default=None, max_length=120)
    company: str | None = Field(default=None, max_length=120)
    company_website: str | None = Field(default=None, max_length=255)
    years_experience: int | None = Field(default=None, ge=0, le=60)
    linkedin_url: str | None = Field(default=None, max_length=255)
    credentials: str | None = Field(default=None, max_length=2000)
    short_intro: str | None = Field(default=None, max_length=200)
    bio: str | None = Field(default=None, max_length=5000)
    expertise: list[str] | None = Field(default=None, max_length=15)
    languages: list[str] | None = Field(default=None, max_length=10)
    categories: list[str] | None = Field(default=None, max_length=5)
    price_15: int | None = Field(default=None, ge=0, le=100000)
    price_30: int | None = Field(default=None, ge=0, le=100000)
    price_60: int | None = Field(default=None, ge=0, le=100000)
    weekly_availability: dict[str, list[TimeWindow]] | None = None
    available_now: bool | None = None
    onboarding_step: int | None = Field(default=None, ge=1, le=10)


class FileUploadIn(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    mime: str = Field(min_length=1, max_length=100)
    data_base64: str = Field(min_length=4)


class DocumentUploadIn(FileUploadIn):
    doc_type: Literal["identity", "employment", "certificate"]


class SlotDay(BaseModel):
    date: str
    slots: list[datetime]


class CheckoutIn(BaseModel):
    expert_id: str
    duration_minutes: Literal[15, 30, 60]
    start_at: datetime
    topic: str = Field(default="", max_length=500)


class PaymentOut(BaseModel):
    id: str
    booking_id: str
    amount: float
    commission_pct: float
    commission_amount: float
    expert_net: float
    currency: str
    transaction_id: str
    method: str
    status: str
    created_at: datetime
    expert_name: str
    user_name: str
    duration_minutes: int


class BookingOut(BaseModel):
    id: str
    expert_id: str
    expert_name: str
    expert_profession: str
    user_id: str
    user_name: str
    user_email: str
    duration_minutes: int
    start_at: datetime
    end_at: datetime
    topic: str
    status: str
    amount: float
    transaction_id: str
    is_past: bool
    can_review: bool
    created_at: datetime


class CheckoutOut(BaseModel):
    booking: BookingOut
    payment: PaymentOut


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=1000)


class Earnings(BaseModel):
    gross: float
    commission: float
    net: float
    sessions: int
    payments: list[PaymentOut]


class PublicSettings(BaseModel):
    commission_pct: float


class CommissionIn(BaseModel):
    commission_pct: float = Field(ge=0, le=50)


class AdminStats(BaseModel):
    users: int
    experts_approved: int
    experts_pending: int
    bookings: int
    gross_volume: float
    commission_earned: float
    commission_pct: float


class VerifyIn(BaseModel):
    identity_verified: bool | None = None
    employment_verified: bool | None = None
    credentials_verified: bool | None = None


class RejectIn(BaseModel):
    reason: str = Field(min_length=3, max_length=1000)


class ChatThreadOut(BaseModel):
    id: str
    user_id: str
    user_name: str
    expert_id: str
    expert_name: str
    expert_profession: str
    expert_photo_url: str | None
    latest_message: str | None
    updated_at: datetime


class ChatMessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class ChatMessageOut(BaseModel):
    id: str
    thread_id: str
    sender_id: str
    sender_name: str
    body: str
    created_at: datetime
