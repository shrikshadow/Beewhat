import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, Clock, ExternalLink, Globe, Languages, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InitialsAvatar } from "@/components/marketplace/InitialsAvatar";
import { Rating, VerificationPanel } from "@/components/marketplace/Verification";
import { AvailableDot, DemoTag } from "@/components/marketplace/ExpertCard";
import { EmptyState, ErrorState, PageLoader } from "@/components/common/States";
import { ApiError, apiGet } from "@/lib/api";
import { DAYS, DURATIONS, categoryName, formatINR } from "@/lib/constants";
import type { ExpertDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

const PKG_COPY: Record<number, string> = {
  15: "Quick question, resume glance or a focused doubt",
  30: "Interview prep, career guidance or a technical deep-dive",
  60: "Mock interview, mentorship or a full strategy session",
};

export default function ExpertProfile() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["expert", id], queryFn: () => apiGet<ExpertDetail>(`/experts/${id}`), retry: false });

  if (q.isLoading) return <PageLoader label="Loading profile…" />;
  if (q.isError || !q.data)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        {q.error instanceof ApiError && q.error.status === 404 ? (
          <EmptyState title="Expert not found" description="This profile may not be published yet." action={<Link to="/explore" className="text-sm font-semibold text-sky-700" data-testid="profile-notfound-explore-link">Browse experts</Link>} testId="profile-not-found" />
        ) : (
          <ErrorState onRetry={() => q.refetch()} testId="profile-error" />
        )}
      </div>
    );

  const e = q.data;
  const prices: Record<number, number> = { 15: e.price_15, 30: e.price_30, 60: e.price_60 };
  const book = (d: number) => nav(`/book/${e.id}?d=${d}`);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/explore" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900" data-testid="profile-back-link">
        <ArrowLeft className="size-4" /> Back to explore
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <section className="animate-rise rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" data-testid="profile-header">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <InitialsAvatar name={e.full_name} photoUrl={e.photo_url} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-extrabold text-slate-900" data-testid="profile-name">{e.full_name}</h1>
                  {e.is_demo && <DemoTag />}
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-slate-700" data-testid="profile-designation">
                  <Briefcase className="size-4" /> {e.designation}{e.company ? ` at ${e.company}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <Rating rating={e.rating} count={e.review_count} />
                  <span>{e.profession}</span>
                  <span>{e.years_experience} years experience</span>
                  <span className="inline-flex items-center gap-1"><Languages className="size-4" /> {e.languages.join(", ")}</span>
                  <AvailableDot on={e.available_now} />
                </div>
                <p className="mt-4 text-base leading-relaxed text-slate-700" data-testid="profile-intro">{e.short_intro}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {e.categories.map((c) => (
                    <Link key={c} to={`/explore?category=${c}`} className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 ring-1 ring-sky-200" data-testid={`profile-category-${c}`}>
                      {categoryName(c)}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-lg font-bold text-slate-900">About</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-700" data-testid="profile-bio">{e.bio}</p>
            <h3 className="mt-6 text-sm font-bold text-slate-900">Expertise</h3>
            <div className="mt-2 flex flex-wrap gap-2" data-testid="profile-expertise">
              {e.expertise.map((s) => <span key={s} className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700">{s}</span>)}
            </div>
            <div className="mt-6 flex flex-wrap gap-4 text-sm">
              {e.linkedin_url && (
                <a href={e.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline" data-testid="profile-linkedin-link">
                  LinkedIn profile <ExternalLink className="size-3.5" />
                </a>
              )}
              {e.company_website && (
                <a href={e.company_website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline" data-testid="profile-company-link">
                  <Globe className="size-3.5" /> Company website
                </a>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8" data-testid="profile-packages">
            <h2 className="text-lg font-bold text-slate-900">Session packages</h2>
            <p className="mt-1 text-sm text-slate-500">Fixed price. What you see is what you pay.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => book(d)}
                  data-testid={`package-${d}-button`}
                  className={cn("group rounded-2xl border p-4 text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-slate-900 hover:shadow-md", d === 30 ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white")}
                >
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Clock className="size-4" /> {d} minutes</p>
                  <p className="mt-2 font-mono text-2xl font-bold text-slate-900" data-testid={`package-${d}-price`}>{formatINR(prices[d])}</p>
                  <p className="mt-1 text-xs text-slate-500">{PKG_COPY[d]}</p>
                  <p className="mt-3 text-xs font-semibold text-sky-700 group-hover:underline">Select →</p>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8" data-testid="profile-availability">
            <h2 className="text-lg font-bold text-slate-900">Weekly availability <span className="text-sm font-normal text-slate-500">(IST)</span></h2>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {DAYS.map((d) => {
                const wins = e.weekly_availability[d.key] ?? [];
                return (
                  <div key={d.key} className={cn("rounded-xl p-3 text-center ring-1", wins.length ? "bg-emerald-50/60 ring-emerald-200" : "bg-slate-50 ring-slate-200")}>
                    <p className="text-xs font-bold text-slate-700">{d.label}</p>
                    {wins.length ? wins.map((w, i) => <p key={i} className="mt-1 font-mono text-[11px] text-emerald-800">{w.start}–{w.end}</p>) : <p className="mt-1 text-[11px] text-slate-400">Off</p>}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8" data-testid="profile-reviews">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              Reviews <Rating rating={e.rating} count={e.review_count} />
            </h2>
            {e.reviews.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500" data-testid="profile-reviews-empty">No reviews yet. Reviews come from people who completed a paid session.</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {e.reviews.map((r) => (
                  <li key={r.id} className="py-4" data-testid={`review-${r.id}`}>
                    <div className="flex items-center gap-2">
                      <InitialsAvatar name={r.reviewer_name} size="sm" />
                      <span className="text-sm font-semibold text-slate-900">{r.reviewer_name}</span>
                      <span className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={cn("size-3.5", i < r.rating ? "fill-amber-400 text-amber-400" : "text-slate-300")} />)}</span>
                      {r.is_demo && <span className="text-[10px] font-semibold uppercase text-amber-700">Demo review</span>}
                      <span className="ml-auto text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString("en-IN")}</span>
                    </div>
                    {r.comment && <p className="mt-2 text-sm text-slate-700">{r.comment}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:col-span-4">
          <div className="sticky top-24 space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Sessions from</p>
              <p className="font-mono text-3xl font-bold text-slate-900">{formatINR(e.price_15)}</p>
              <div className="mt-3 space-y-1.5 text-sm">
                {DURATIONS.map((d) => (
                  <div key={d} className="flex justify-between text-slate-600"><span>{d} min</span><span className="font-mono font-semibold text-slate-900">{formatINR(prices[d])}</span></div>
                ))}
              </div>
              <Button size="lg" className="mt-4 w-full" onClick={() => book(30)} data-testid="book-session-cta">Book Session</Button>
            </div>
            <VerificationPanel v={e.verification} />
          </div>
        </aside>
      </div>

      {/* Sticky mobile booking bar */}
      <div className="fixed inset-x-0 bottom-[60px] z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] text-slate-500">From</p>
            <p className="font-mono text-lg font-bold text-slate-900">{formatINR(e.price_15)}</p>
          </div>
          <Button size="lg" onClick={() => book(30)} data-testid="mobile-book-session-cta">Book Session</Button>
        </div>
      </div>
    </div>
  );
}
