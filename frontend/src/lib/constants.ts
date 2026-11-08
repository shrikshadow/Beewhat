import { BarChart3, Code2, Compass, Layers, Rocket, type LucideIcon } from "lucide-react";
import { ApiError } from "./api";

export interface Category {
  id: string;
  name: string;
  tagline: string;
  icon: LucideIcon;
  tone: string;
}

// ids must match ALLOWED_CATEGORIES in backend/routers/expert_me.py
export const CATEGORIES: Category[] = [
  { id: "career-jobs", name: "Career & Jobs", tagline: "Resume reviews, mock interviews, career switches", icon: Compass, tone: "bg-sky-50 text-sky-700 ring-sky-100" },
  { id: "technology", name: "Technology", tagline: "System design, coding, engineering careers", icon: Code2, tone: "bg-indigo-50 text-indigo-700 ring-indigo-100" },
  { id: "product-business", name: "Product & Business", tagline: "PM strategy, consulting, business analysis", icon: Layers, tone: "bg-amber-50 text-amber-700 ring-amber-100" },
  { id: "data-analytics", name: "Data & Analytics", tagline: "SQL, BI dashboards, data science", icon: BarChart3, tone: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
  { id: "startups", name: "Startups & Entrepreneurship", tagline: "Fundraising, pitch decks, growth", icon: Rocket, tone: "bg-rose-50 text-rose-700 ring-rose-100" },
];
export const categoryName = (id: string) => CATEGORIES.find((c) => c.id === id)?.name ?? id;

export const PROFESSIONS = [
  "Software Engineer",
  "Product Manager",
  "Data Analyst",
  "Business Analyst",
  "Startup Founder",
  "Career Mentor",
  "Management Consultant",
  "Recruiter",
  "Graphic Designer",
  "Marketing & Sales",
  "Interview Preparation Expert",
];

export const LANGUAGES = ["English", "Hindi", "Tamil", "Telugu", "Kannada", "Malayalam", "Marathi", "Bengali", "Gujarati", "Punjabi", "Urdu"];

export const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

export const DURATIONS = [15, 30, 60] as const;
export type Duration = (typeof DURATIONS)[number];

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 0 });
export const formatINR = (n: number) => inr.format(n);

const TZ = "Asia/Kolkata";
export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
export const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
export const fmtDateTime = (iso: string) => `${fmtDate(iso)}, ${fmtTime(iso)} IST`;
export const fmtDay = (ymd: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${ymd}T00:00:00Z`));

export function errMsg(e: unknown, fallback = "Something went wrong. Please try again."): string {
  if (e instanceof ApiError) {
    const d = (e.body as { detail?: unknown } | null)?.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d[0] && typeof d[0] === "object" && "msg" in d[0]) {
      const first = d[0] as { msg: string; loc?: string[] };
      const field = first.loc?.[first.loc.length - 1];
      return field ? `${field.replace(/_/g, " ")}: ${first.msg}` : first.msg;
    }
  }
  return fallback;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
