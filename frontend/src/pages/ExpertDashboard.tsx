import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CircleDollarSign, PencilLine, Users } from "lucide-react";
import { BookingRow, PaymentsTable } from "@/pages/Profile";
import { EmptyState, ErrorState, PageLoader, Skeleton } from "@/components/common/States";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet } from "@/lib/api";
import { errMsg, formatINR } from "@/lib/constants";
import { useExpertMe } from "@/lib/hooks";
import type { BookingOut, Earnings } from "@/lib/types";

export default function ExpertDashboard() {
  const profile = useExpertMe();
  const bookings = useQuery({ queryKey: ["expert-bookings"], queryFn: () => apiGet<BookingOut[]>("/expert/bookings") });
  const earnings = useQuery({ queryKey: ["expert-earnings"], queryFn: () => apiGet<Earnings>("/expert/earnings") });

  if (profile.isLoading) return <PageLoader />;
  if (profile.isError || !profile.data) return <div className="mx-auto max-w-3xl px-4 py-16"><ErrorState message={errMsg(profile.error)} onRetry={() => void profile.refetch()} /></div>;

  const expert = profile.data;
  const upcoming = (bookings.data ?? []).filter((booking) => !booking.is_past);
  const past = (bookings.data ?? []).filter((booking) => booking.is_past);

  return <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-slate-500">Expert workspace</p><h1 className="mt-1 text-3xl font-extrabold text-slate-900" data-testid="expert-dashboard-title">Welcome, {expert.full_name}</h1><p className="mt-1 text-slate-600">{expert.designation}{expert.company ? ` · ${expert.company}` : ""}</p></div><Link to="/become-expert" className={buttonVariants({ variant: "outline" })}><PencilLine className="size-4" /> Edit profile</Link></div>

    {expert.status !== "approved" && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div><p className="font-semibold text-amber-900">Application status: {expert.status}</p><p className="text-sm text-amber-800">Your public listing and bookings become available after approval.</p></div><Link to="/become-expert" className="text-sm font-semibold text-amber-900 underline">Continue application</Link></div>}

    <div className="grid gap-4 sm:grid-cols-3">
      <Metric icon={<CalendarClock className="size-5" />} label="Upcoming sessions" value={bookings.isLoading ? "…" : String(upcoming.length)} />
      <Metric icon={<CircleDollarSign className="size-5" />} label="Net earnings" value={earnings.isLoading ? "…" : formatINR(earnings.data?.net ?? 0)} />
      <Metric icon={<Users className="size-5" />} label="Sessions completed" value={earnings.isLoading ? "…" : String(earnings.data?.sessions ?? past.length)} />
    </div>

    <Tabs defaultValue="upcoming">
      <TabsList><TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger><TabsTrigger value="past">Past ({past.length})</TabsTrigger><TabsTrigger value="payments">Payments</TabsTrigger></TabsList>
      <TabsContent value="upcoming" className="mt-5">{bookings.isLoading ? <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div> : bookings.isError ? <ErrorState onRetry={() => void bookings.refetch()} /> : upcoming.length ? <div className="space-y-3">{upcoming.map((booking) => <BookingRow key={booking.id} b={booking} perspective="expert" />)}</div> : <EmptyState title="No upcoming sessions" description="New confirmed sessions will appear here." />}</TabsContent>
      <TabsContent value="past" className="mt-5">{bookings.isLoading ? <Skeleton className="h-20" /> : bookings.isError ? <ErrorState onRetry={() => void bookings.refetch()} /> : past.length ? <div className="space-y-3">{past.map((booking) => <BookingRow key={booking.id} b={booking} perspective="expert" />)}</div> : <EmptyState title="No completed sessions yet" />}</TabsContent>
      <TabsContent value="payments" className="mt-5">{earnings.isLoading ? <Skeleton className="h-40" /> : earnings.isError ? <ErrorState onRetry={() => void earnings.refetch()} /> : earnings.data?.payments.length ? <PaymentsTable rows={earnings.data.payments} perspective="expert" /> : <EmptyState title="No payments yet" />}</TabsContent>
    </Tabs>
    <Link to="/explore" className={buttonVariants({ variant: "outline" })}>View marketplace</Link>
  </div>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2 text-sm text-slate-500">{icon}{label}</div><p className="mt-3 text-2xl font-bold text-slate-900">{value}</p></div>;
}
