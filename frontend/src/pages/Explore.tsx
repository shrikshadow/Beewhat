import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import ExpertCard from "@/components/marketplace/ExpertCard";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/common/States";
import { apiGet } from "@/lib/api";
import { CATEGORIES, LANGUAGES, PROFESSIONS, categoryName } from "@/lib/constants";
import type { ExpertListOut } from "@/lib/types";

type Opt = { value: string; label: string };
const ANY = "all";
const FILTERS: { key: string; label: string; options: Opt[] }[] = [
  { key: "category", label: "Category", options: CATEGORIES.map((c) => ({ value: c.id, label: c.name })) },
  { key: "profession", label: "Profession", options: PROFESSIONS.map((p) => ({ value: p, label: p })) },
  { key: "language", label: "Language", options: LANGUAGES.map((l) => ({ value: l, label: l })) },
  { key: "min_rating", label: "Rating", options: [{ value: "4", label: "4.0 & up" }, { value: "4.5", label: "4.5 & up" }] },
  { key: "min_experience", label: "Experience", options: ["3", "5", "10"].map((v) => ({ value: v, label: `${v}+ years` })) },
  { key: "max_price", label: "Price (30 min)", options: ["500", "1000", "1500", "2000"].map((v) => ({ value: v, label: `Up to ₹${Number(v).toLocaleString("en-IN")}` })) },
];
const SORTS: Opt[] = [
  { value: "recommended", label: "Recommended" },
  { value: "rating", label: "Highest rated" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "experience", label: "Most experienced" },
  { value: "trending", label: "Trending" },
];

function FilterSelect({ id, label, options, value, onChange }: { id: string; label: string; options: Opt[]; value: string; onChange: (v: string) => void }) {
  const all = [{ value: ANY, label: `Any ${label.toLowerCase()}` }, ...options];
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</Label>
      <Select value={value || ANY} onValueChange={(v: string) => onChange(v === ANY ? "" : v)}>
        <SelectTrigger className="w-full bg-white" data-testid={`filter-${id}-select`}>
          <SelectValue>{(v) => all.find((o) => o.value === v)?.label ?? ""}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {all.map((o) => (
            <SelectItem key={o.value} value={o.value} data-testid={`filter-${id}-option-${o.value}`}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function Explore() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const get = (k: string) => params.get(k) ?? "";
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  // Debounced free-text search → URL
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q.trim()) set("q", q.trim());
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const qs = params.toString();
  const list = useQuery({ queryKey: ["experts", "explore", qs], queryFn: () => apiGet<ExpertListOut>(`/experts?limit=60&${qs}`), placeholderData: keepPreviousData });
  const active = FILTERS.filter((f) => get(f.key));
  const clearAll = () => { setQ(""); setParams(new URLSearchParams(), { replace: true }); };

  const filterBody = (
    <div className="space-y-4">
      {FILTERS.map((f) => (
        <FilterSelect key={f.key} id={f.key} label={f.label} options={f.options} value={get(f.key)} onChange={(v) => set(f.key, v)} />
      ))}
      <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800">
        <Checkbox checked={get("available_now") === "true"} onCheckedChange={(c) => set("available_now", c ? "true" : "")} data-testid="filter-available-now-checkbox" />
        Available now only
      </label>
      <Button variant="ghost" className="w-full" onClick={clearAll} data-testid="filter-clear-all-button">Clear all filters</Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="animate-rise">
        <h1 className="text-3xl font-extrabold text-slate-900" data-testid="explore-title">Explore experts</h1>
        <p className="mt-1 text-slate-600">Verified professionals with fixed, upfront prices.</p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, profession or expertise" className="h-11 bg-white pl-9" data-testid="explore-search-input" />
        </div>
        <div className="flex gap-2">
          <Select value={get("sort") || "recommended"} onValueChange={(v: string) => set("sort", v === "recommended" ? "" : v)}>
            <SelectTrigger className="h-11 min-w-44 bg-white" data-testid="explore-sort-select">
              <SelectValue>{(v) => `Sort: ${SORTS.find((s) => s.value === v)?.label ?? ""}`}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => <SelectItem key={s.value} value={s.value} data-testid={`sort-option-${s.value}`}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Sheet>
            <SheetTrigger render={<Button variant="outline" className="h-11 lg:hidden" data-testid="explore-mobile-filters-button" />}>
              <SlidersHorizontal className="size-4" /> Filters{active.length ? ` (${active.length})` : ""}
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto">
              <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
              <div className="px-4 pb-6">{filterBody}</div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {(active.length > 0 || get("available_now")) && (
        <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="active-filters">
          {active.map((f) => {
            const v = get(f.key);
            const label = f.key === "category" ? categoryName(v) : f.options.find((o) => o.value === v)?.label ?? v;
            return (
              <button key={f.key} onClick={() => set(f.key, "")} className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800 ring-1 ring-sky-200 transition-colors hover:bg-sky-100" data-testid={`active-filter-${f.key}`}>
                {f.label}: {label} <X className="size-3" />
              </button>
            );
          })}
          {get("available_now") && (
            <button onClick={() => set("available_now", "")} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200" data-testid="active-filter-available-now">
              Available now <X className="size-3" />
            </button>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-12">
        <aside className="hidden lg:col-span-3 lg:block">
          <div className="sticky top-24 rounded-2xl border border-slate-200 bg-slate-50/60 p-4" data-testid="explore-filter-sidebar">{filterBody}</div>
        </aside>
        <section className="lg:col-span-9">
          <p className="mb-4 text-sm text-slate-500" data-testid="explore-result-count">
            {list.isLoading ? "Searching…" : list.isError ? "" : `${list.data?.total ?? 0} expert${list.data?.total === 1 ? "" : "s"} found${list.isPlaceholderData ? " · updating…" : ""}`}
          </p>
          {list.isLoading ? (
            <CardGridSkeleton count={6} />
          ) : list.isError ? (
            <ErrorState onRetry={() => list.refetch()} testId="explore-error" />
          ) : !list.data?.items.length ? (
            <EmptyState title="No experts match these filters" description="Try removing a filter or searching for a broader skill." action={<Button variant="outline" onClick={clearAll} data-testid="explore-empty-clear-button">Clear filters</Button>} testId="explore-empty" />
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" data-testid="explore-results-grid">
              {list.data.items.map((e, i) => <ExpertCard key={e.id} e={e} index={i} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
