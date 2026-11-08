import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, CalendarCheck, CreditCard, Search, ShieldCheck, Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ExpertCard, { AvailableDot } from "@/components/marketplace/ExpertCard";
import { InitialsAvatar } from "@/components/marketplace/InitialsAvatar";
import { VerificationChips } from "@/components/marketplace/Verification";
import { CardGridSkeleton, EmptyState, ErrorState, SectionHeading } from "@/components/common/States";
import { apiGet } from "@/lib/api";
import { CATEGORIES, formatINR } from "@/lib/constants";
import { useMe } from "@/lib/hooks";
import type { ExpertListOut } from "@/lib/types";

export function SearchBar({ size = "lg", initial = "" }: { size?: "lg" | "md"; initial?: string }) {
  const [q, setQ] = useState(initial);
  const nav = useNavigate();
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    nav(q.trim() ? `/explore?q=${encodeURIComponent(q.trim())}` : "/explore");
  };
  return (
    <form onSubmit={submit} className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-sky-500/40" data-testid="hero-search-form">
      <Search className="ml-2.5 size-5 shrink-0 text-slate-400" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name, role or skill — e.g. system design"
        className={`border-0 bg-transparent shadow-none focus-visible:ring-0 ${size === "lg" ? "h-11 text-base" : "h-9"}`}
        data-testid="hero-search-input"
        aria-label="Search experts"
      />
      <Button type="submit" className={size === "lg" ? "h-11 rounded-xl px-5" : "h-9 rounded-xl"} data-testid="hero-search-submit">
        Search
      </Button>
    </form>
  );
}

export function CategoryTiles({ counts }: { counts?: Record<string, number> }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {CATEGORIES.map((c, i) => (
        <Link
          key={c.id}
          to={`/explore?category=${c.id}`}
          data-testid={`category-tile-${c.id}`}
          style={{ animationDelay: `${i * 60}ms` }}
          className="group animate-rise rounded-2xl border border-slate-200 bg-white p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className={`grid size-10 place-items-center rounded-xl ring-1 ${c.tone}`}>
            <c.icon className="size-5" />
          </span>
          <p className="mt-3 text-sm font-bold text-slate-900">{c.name}</p>
          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{c.tagline}</p>
          {counts && <p className="mt-2 text-[11px] font-semibold text-sky-700">{counts[c.id] ?? 0} experts</p>}
        </Link>
      ))}
    </div>
  );
}

export default function Landing() {
  const { data: me } = useMe();
  const featured = useQuery({ queryKey: ["experts", "featured"], queryFn: () => apiGet<ExpertListOut>("/experts?sort=rating&limit=6") });
  const live = useQuery({ queryKey: ["experts", "live"], queryFn: () => apiGet<ExpertListOut>("/experts?available_now=true&limit=8") });
  const stack = featured.data?.items.slice(0, 3) ?? [];

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="pointer-events-none absolute -right-40 -top-40 size-[520px] rounded-full bg-sky-100/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 left-10 size-[420px] rounded-full bg-amber-100/50 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-12 lg:px-8">
          <div className="animate-rise lg:col-span-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
              <BadgeCheck className="size-3.5 text-sky-600" /> Real professionals · admin-checked verification
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] text-slate-900 sm:text-5xl lg:text-[56px]" data-testid="landing-headline">
              Advice from people who've <span className="text-sky-700">actually done the job.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              Book 1:1 sessions with engineers, PMs, founders, recruiters and mentors. See exactly what's verified and what it costs — before you book.
            </p>
            <div className="mt-7 max-w-xl">
              <SearchBar />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Interview Prep", "Resume Review", "System Design", "Product Strategy", "Fundraising"].map((t) => (
                <Link key={t} to={`/explore?q=${encodeURIComponent(t)}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200" data-testid={`quick-search-${t.toLowerCase().replace(/\s+/g, "-")}`}>
                  {t}
                </Link>
              ))}
            </div>
            {!me && (
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/signup" className={buttonVariants({ size: "lg" })} data-testid="landing-signup-button">
                  Create free account <ArrowRight className="size-4" />
                </Link>
                <Link to="/login" className={buttonVariants({ size: "lg", variant: "outline" })} data-testid="landing-login-button">
                  Log in
                </Link>
                <Link to="/become-expert" className={buttonVariants({ size: "lg", variant: "ghost" })} data-testid="landing-become-expert-button">
                  Become an expert
                </Link>
              </div>
            )}
          </div>

          {/* Stacked live cards */}
          <div className="relative hidden lg:col-span-5 lg:block">
            <div className="relative mx-auto h-[440px] max-w-sm">
              {stack.map((e, i) => (
                <Link
                  key={e.id}
                  to={`/experts/${e.id}`}
                  data-testid={`hero-stack-card-${i}`}
                  className="absolute inset-x-0 rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-xl shadow-slate-300/40 backdrop-blur transition-transform duration-300 hover:-translate-y-1"
                  style={{ top: i * 140, transform: `translateX(${i % 2 ? 28 : -8}px) rotate(${i === 1 ? 1.5 : -1}deg)`, zIndex: 3 - i }}
                >
                  <div className="flex items-center gap-3">
                    <InitialsAvatar name={e.full_name} photoUrl={e.photo_url} />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900">{e.full_name}</p>
                      <p className="truncate text-xs text-slate-500">{e.designation} · {e.company}</p>
                    </div>
                    <span className="ml-auto font-mono text-sm font-bold text-slate-900">{formatINR(e.price_30)}<span className="text-[10px] font-normal text-slate-500">/30m</span></span>
                  </div>
                  <div className="mt-3 flex items-center gap-2"><VerificationChips v={e.verification} /><AvailableDot on={e.available_now} /></div>
                </Link>
              ))}
            </div>
          </div>
        </div>
        {/* Live ticker */}
        {(live.data?.items.length ?? 0) > 0 && (
          <div className="relative overflow-hidden border-t border-slate-100 bg-slate-50 py-2.5" data-testid="available-ticker">
            <div className="flex w-max animate-ticker gap-8 pl-8">
              {[...(live.data?.items ?? []), ...(live.data?.items ?? [])].map((e, i) => (
                <Link key={`${e.id}-${i}`} to={`/experts/${e.id}`} className="flex items-center gap-2 whitespace-nowrap text-xs text-slate-600 hover:text-slate-900">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> {e.full_name} · {e.designation} is available now
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="mx-auto max-w-7xl space-y-16 px-4 py-14 sm:px-6 lg:px-8">
        <section>
          <SectionHeading eyebrow="Browse" title="Explore by category" />
          <CategoryTiles />
        </section>

        <section>
          <SectionHeading
            eyebrow="Top rated"
            title="Featured experts"
            action={<Link to="/explore" className={buttonVariants({ variant: "outline", size: "sm" })} data-testid="featured-view-all">View all</Link>}
          />
          {featured.isLoading ? (
            <CardGridSkeleton count={3} />
          ) : featured.isError ? (
            <ErrorState onRetry={() => featured.refetch()} testId="featured-error" />
          ) : !featured.data?.items.length ? (
            <EmptyState title="No experts published yet" description="Check back soon — new professionals are being verified." />
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3" data-testid="featured-experts-grid">
              {featured.data.items.map((e, i) => <ExpertCard key={e.id} e={e} index={i} />)}
            </div>
          )}
        </section>

        <section className="rounded-3xl bg-slate-900 px-6 py-12 text-white sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-300">How it works</p>
          <h2 className="mt-1 text-2xl font-bold sm:text-3xl">Three steps to the right conversation</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              { icon: Search, t: "Discover", d: "Search by role, skill or company. Filter by price, language, rating and availability." },
              { icon: ShieldCheck, t: "Check what's verified", d: "Each profile shows identity, employment and credentials — verified or only claimed." },
              { icon: CalendarCheck, t: "Book & pay", d: "Pick 15, 30 or 60 minutes and an open slot. Fixed price, shown upfront." },
            ].map((s, i) => (
              <div key={s.t} className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                <span className="font-mono text-xs text-sky-300">0{i + 1}</span>
                <s.icon className="mt-3 size-6 text-amber-300" />
                <p className="mt-3 font-bold">{s.t}</p>
                <p className="mt-1 text-sm text-slate-300">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid items-center gap-8 rounded-3xl border border-slate-200 bg-white p-8 md:grid-cols-2">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-700"><Sparkles className="size-3.5" /> For professionals</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Share what you know. Set your own price.</h2>
            <p className="mt-2 text-slate-600">Apply in a few steps, get verified by our team, and start taking paid 1:1 sessions on your schedule.</p>
            <Link to="/become-expert" className={`${buttonVariants({ size: "lg" })} mt-5`} data-testid="cta-become-expert">
              Apply as an expert <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-3 text-sm">
            {[
              [ShieldCheck, "Three separate verification badges"],
              [CreditCard, "Transparent commission — see gross, fee and net"],
              [CalendarCheck, "Weekly availability turns into bookable slots"],
            ].map(([Icon, t], i) => {
              const I = Icon as typeof ShieldCheck;
              return (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <I className="size-5 text-sky-700" /> <span className="font-medium text-slate-800">{t as string}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
