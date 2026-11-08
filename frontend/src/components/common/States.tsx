import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="grid min-h-[40vh] place-items-center text-slate-500" data-testid="page-loader">
      <span className="flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" /> {label}
      </span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-slate-200/70", className)} />;
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3" data-testid="card-grid-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex gap-3">
            <Skeleton className="size-14 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="mt-4 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-4/5" />
          <Skeleton className="mt-5 h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, description, action, testId = "empty-state" }: { title: string; description?: string; action?: ReactNode; testId?: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center" data-testid={testId}>
      <span className="grid size-11 place-items-center rounded-full bg-slate-100 text-slate-500">
        <Inbox className="size-5" />
      </span>
      <h3 className="mt-3 text-base font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message = "We couldn't load this right now.", onRetry, testId = "error-state" }: { message?: string; onRetry?: () => void; testId?: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-rose-200 bg-rose-50/60 px-6 py-10 text-center" data-testid={testId}>
      <AlertTriangle className="size-6 text-rose-600" />
      <p className="mt-2 text-sm font-medium text-rose-800">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry} data-testid={`${testId}-retry-button`}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function SectionHeading({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">{eyebrow}</p>}
        <h2 className="mt-1 text-2xl font-bold text-slate-900 sm:text-[28px]">{title}</h2>
      </div>
      {action}
    </div>
  );
}
