import { AlertCircle, Award, Briefcase, CircleDashed, ShieldCheck, Star, type LucideIcon } from "lucide-react";
import type { Verification, VerificationItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const KINDS: { key: keyof Verification; label: string; icon: LucideIcon; tone: string }[] = [
  { key: "identity", label: "Identity", icon: ShieldCheck, tone: "bg-blue-50 text-blue-700 ring-blue-200" },
  { key: "employment", label: "Employment", icon: Briefcase, tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { key: "credentials", label: "Credentials", icon: Award, tone: "bg-violet-50 text-violet-700 ring-violet-200" },
];

/** Compact chips for cards: only shows what the admin actually verified. */
export function VerificationChips({ v }: { v: Verification }) {
  const verified = KINDS.filter((k) => v[k.key].status === "verified");
  if (!verified.length)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200" data-testid="chip-unverified">
        <AlertCircle className="size-3" /> Not yet verified
      </span>
    );
  return (
    <div className="flex flex-wrap gap-1">
      {verified.map((k) => (
        <span key={k.key} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1", k.tone)} data-testid={`chip-${k.key}-verified`}>
          <k.icon className="size-3" /> {k.label}
        </span>
      ))}
    </div>
  );
}

function Row({ label, icon: Icon, tone, item, testId }: { label: string; icon: LucideIcon; tone: string; item: VerificationItem; testId: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200" data-testid={testId}>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg ring-1", item.status === "verified" ? tone : "bg-slate-50 text-slate-400 ring-slate-200")}>
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          {item.status === "verified" && (
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", tone)} data-testid={`${testId}-status`}>
              {label} verified
            </span>
          )}
          {item.status === "claimed" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200" data-testid={`${testId}-status`}>
              <AlertCircle className="size-3" /> Claimed by expert, not verified
            </span>
          )}
          {item.status === "not_provided" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500" data-testid={`${testId}-status`}>
              <CircleDashed className="size-3" /> Not provided
            </span>
          )}
        </div>
        {item.claim && <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.claim}</p>}
      </div>
    </div>
  );
}

/** Full panel: exactly what was verified, and what is only a claim. */
export function VerificationPanel({ v }: { v: Verification }) {
  return (
    <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4" data-testid="verification-panel">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Verification</h3>
        <span className="text-[11px] text-slate-500">Checked by Verity admins</span>
      </div>
      {KINDS.map((k) => (
        <Row key={k.key} label={k.label} icon={k.icon} tone={k.tone} item={v[k.key]} testId={`verification-${k.key}`} />
      ))}
    </div>
  );
}

export function Rating({ rating, count, className }: { rating: number; count: number; className?: string }) {
  if (!count) return <span className={cn("text-xs text-slate-500", className)} data-testid="rating-new">New · no reviews yet</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm", className)} data-testid="rating-value">
      <Star className="size-4 fill-amber-400 text-amber-400" />
      <span className="font-semibold text-slate-900">{rating.toFixed(1)}</span>
      <span className="text-slate-500">({count})</span>
    </span>
  );
}
