import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { buttonVariants } from "@/components/ui/button";
import ExpertCard from "@/components/marketplace/ExpertCard";
import { CardGridSkeleton, EmptyState, ErrorState, SectionHeading } from "@/components/common/States";
import { CategoryTiles, SearchBar } from "@/pages/Landing";
import { apiGet } from "@/lib/api";
import { categoryName } from "@/lib/constants";
import { useMe } from "@/lib/hooks";
import type { CategoryCount, ExpertListOut } from "@/lib/types";

function ExpertRow({ qk, path, title, eyebrow, viewAll, testId }: { qk: string; path: string; title: string; eyebrow: string; viewAll: string; testId: string }) {
  const q = useQuery({ queryKey: ["experts", qk], queryFn: () => apiGet<ExpertListOut>(path) });
  return (
    <section data-testid={testId}>
      <SectionHeading eyebrow={eyebrow} title={title} action={<Link to={viewAll} className={buttonVariants({ variant: "outline", size: "sm" })} data-testid={`${testId}-view-all`}>See all</Link>} />
      {q.isLoading ? (
        <CardGridSkeleton count={3} />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} testId={`${testId}-error`} />
      ) : !q.data?.items.length ? (
        <EmptyState title="Nobody here right now" description="Try exploring all experts instead." testId={`${testId}-empty`} />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {q.data.items.map((e, i) => <ExpertCard key={e.id} e={e} index={i} />)}
        </div>
      )}
    </section>
  );
}

export default function HomeDashboard() {
  const { data: me } = useMe();
  const cats = useQuery({ queryKey: ["categories"], queryFn: () => apiGet<CategoryCount[]>("/categories") });
  const counts = Object.fromEntries((cats.data ?? []).map((c) => [c.id, c.count]));
  const popular = [...(cats.data ?? [])].sort((a, b) => b.count - a.count);
  return (
    <div className="mx-auto max-w-7xl space-y-14 px-4 py-10 sm:px-6 lg:px-8">
      <div className="animate-rise">
        <p className="text-sm text-slate-500">{me ? `Welcome back, ${me.full_name.split(" ")[0]}` : "Welcome"}</p>
        <h1 className="mt-1 text-3xl font-extrabold text-slate-900 sm:text-4xl" data-testid="home-title">Who do you want to learn from today?</h1>
        <div className="mt-5 max-w-2xl"><SearchBar size="md" /></div>
      </div>

      <ExpertRow qk="recommended" path="/experts?sort=recommended&limit=6" title="Recommended for you" eyebrow="Recommended" viewAll="/explore" testId="home-recommended" />
      <ExpertRow qk="available" path="/experts?available_now=true&limit=3" title="Available now" eyebrow="Live" viewAll="/explore?available_now=true" testId="home-available-now" />

      <section data-testid="home-popular-categories">
        <SectionHeading eyebrow="Categories" title="Popular categories" />
        {cats.isError ? <ErrorState onRetry={() => cats.refetch()} /> : <CategoryTiles counts={counts} />}
        {popular.length > 0 && (
          <p className="mt-3 text-xs text-slate-500">Most experts in: {popular.slice(0, 2).map((c) => categoryName(c.id)).join(", ")}</p>
        )}
      </section>

      <ExpertRow qk="trending" path="/experts?sort=trending&limit=3" title="Trending this month" eyebrow="Trending" viewAll="/explore?sort=trending" testId="home-trending" />
    </div>
  );
}
