import { Link } from "react-router-dom";
import { ArrowRight, Briefcase, Languages } from "lucide-react";
import type { ExpertCard as Expert } from "@/lib/types";
import { formatINR } from "@/lib/constants";
import { InitialsAvatar } from "./InitialsAvatar";
import { Rating, VerificationChips } from "./Verification";
import { cn } from "@/lib/utils";

export function AvailableDot({ on, className }: { on: boolean; className?: string }) {
  if (!on) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200", className)} data-testid="available-now-badge">
      <span className="size-1.5 animate-pulse-dot rounded-full bg-emerald-500" /> Available now
    </span>
  );
}

export function DemoTag() {
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900" data-testid="demo-profile-tag">
      Demo profile
    </span>
  );
}

export default function ExpertCard({ e, index = 0 }: { e: Expert; index?: number }) {
  return (
    <Link
      to={`/experts/${e.id}`}
      data-testid={`expert-card-${e.id}`}
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
      className="group flex animate-rise flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/70"
    >
      <div className="flex items-start gap-3.5">
        <InitialsAvatar name={e.full_name} photoUrl={e.photo_url} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-base font-bold text-slate-900" data-testid="expert-card-name">{e.full_name}</h3>
            {e.is_demo && <DemoTag />}
          </div>
          <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-slate-600">
            <Briefcase className="size-3.5 shrink-0" />
            <span className="truncate">{e.designation}{e.company ? ` · ${e.company}` : ""}</span>
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Rating rating={e.rating} count={e.review_count} />
            <span className="text-xs text-slate-500">{e.years_experience} yrs exp</span>
          </div>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600">{e.short_intro}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {e.expertise.slice(0, 3).map((s) => (
          <span key={s} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{s}</span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <VerificationChips v={e.verification} />
        <AvailableDot on={e.available_now} />
      </div>
      <div className="mt-auto flex items-end justify-between gap-3 border-t border-slate-100 pt-4 mt-4">
        <div>
          <p className="flex items-center gap-1 text-[11px] text-slate-500"><Languages className="size-3" /> {e.languages.slice(0, 3).join(", ")}</p>
          <p className="mt-1 text-sm text-slate-600">
            From <span className="font-mono text-base font-bold text-slate-900" data-testid="expert-card-price">{formatINR(e.price_15)}</span>
            <span className="text-xs text-slate-500"> / 15 min</span>
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-transform duration-200 group-hover:translate-x-0.5">
          View <ArrowRight className="size-3.5" />
        </span>
      </div>
    </Link>
  );
}
