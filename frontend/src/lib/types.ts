// Hand-written mirrors of backend/models/schemas.py — keep in sync.
export type Role = "user" | "expert" | "admin";
export type VerStatus = "verified" | "claimed" | "not_provided";
export type ExpertStatus = "draft" | "pending" | "approved" | "rejected";

export interface UserOut {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  phone: string;
  created_at: string;
}

export interface OtpSendOut {
  sent: boolean;
  demo_hint: string;
}

export interface TimeWindow {
  start: string;
  end: string;
}
export type WeeklyAvailability = Record<string, TimeWindow[]>;

export interface VerificationItem {
  status: VerStatus;
  claim: string;
}
export interface Verification {
  identity: VerificationItem;
  employment: VerificationItem;
  credentials: VerificationItem;
}

export interface ExpertCard {
  id: string;
  full_name: string;
  profession: string;
  designation: string;
  company: string;
  years_experience: number;
  short_intro: string;
  expertise: string[];
  languages: string[];
  categories: string[];
  price_15: number;
  price_30: number;
  price_60: number;
  available_now: boolean;
  rating: number;
  review_count: number;
  photo_url: string | null;
  verification: Verification;
  is_demo: boolean;
}

export interface ReviewOut {
  id: string;
  rating: number;
  comment: string;
  reviewer_name: string;
  created_at: string;
  is_demo: boolean;
}

export interface ExpertDetail extends ExpertCard {
  bio: string;
  linkedin_url: string;
  company_website: string;
  credentials: string;
  weekly_availability: WeeklyAvailability;
  reviews: ReviewOut[];
}

export interface DocumentMeta {
  id: string;
  doc_type: "identity" | "employment" | "certificate";
  filename: string;
  mime: string;
  size: number;
  uploaded_at: string;
}

export interface ExpertMe extends ExpertDetail {
  email: string;
  status: ExpertStatus;
  rejection_reason: string;
  onboarding_step: number;
  identity_verified: boolean;
  employment_verified: boolean;
  credentials_verified: boolean;
  documents: DocumentMeta[];
  submitted_at: string | null;
  approved_at: string | null;
}

export interface ExpertListOut {
  items: ExpertCard[];
  total: number;
}

export interface CategoryCount {
  id: string;
  count: number;
}

export type ExpertProfileUpdate = Partial<{
  full_name: string;
  profession: string;
  designation: string;
  company: string;
  company_website: string;
  years_experience: number;
  linkedin_url: string;
  credentials: string;
  short_intro: string;
  bio: string;
  expertise: string[];
  languages: string[];
  categories: string[];
  price_15: number;
  price_30: number;
  price_60: number;
  weekly_availability: WeeklyAvailability;
  available_now: boolean;
  onboarding_step: number;
}>;

export interface FileUploadIn {
  filename: string;
  mime: string;
  data_base64: string;
}
export interface DocumentUploadIn extends FileUploadIn {
  doc_type: DocumentMeta["doc_type"];
}

export interface SlotDay {
  date: string;
  slots: string[];
}

export interface CheckoutIn {
  expert_id: string;
  duration_minutes: 15 | 30 | 60;
  start_at: string;
  topic: string;
}

export interface PaymentOut {
  id: string;
  booking_id: string;
  amount: number;
  commission_pct: number;
  commission_amount: number;
  expert_net: number;
  currency: string;
  transaction_id: string;
  method: string;
  status: string;
  created_at: string;
  expert_name: string;
  user_name: string;
  duration_minutes: number;
}

export interface BookingOut {
  id: string;
  expert_id: string;
  expert_name: string;
  expert_profession: string;
  user_id: string;
  user_name: string;
  user_email: string;
  duration_minutes: number;
  start_at: string;
  end_at: string;
  topic: string;
  status: string;
  amount: number;
  transaction_id: string;
  is_past: boolean;
  can_review: boolean;
  created_at: string;
}

export interface CheckoutOut {
  booking: BookingOut;
  payment: PaymentOut;
}

export interface CheckoutOrderOut {
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
}

export interface Earnings {
  gross: number;
  commission: number;
  net: number;
  sessions: number;
  payments: PaymentOut[];
}

export interface PublicSettings {
  commission_pct: number;
}

export interface AdminStats {
  users: number;
  experts_approved: number;
  experts_pending: number;
  bookings: number;
  gross_volume: number;
  commission_earned: number;
  commission_pct: number;
}

export interface VerifyIn {
  identity_verified?: boolean;
  employment_verified?: boolean;
  credentials_verified?: boolean;
}

export interface ChatThread {
  id: string;
  user_id: string;
  user_name: string;
  expert_id: string;
  expert_name: string;
  expert_profession: string;
  expert_photo_url: string | null;
  latest_message: string | null;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
}
