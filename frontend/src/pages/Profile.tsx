import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, Loader2, Star, Video } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState, Skeleton } from "@/components/common/States";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { errMsg, fmtDateTime, formatINR } from "@/lib/constants";
import { useMe } from "@/lib/hooks";
import { endSession } from "@/lib/session";
import type { BookingOut, PaymentOut, UserOut } from "@/lib/types";
import { cn } from "@/lib/utils";

export const joinSession = () => toast.info("Live sessions coming soon", { description: "Video sessions aren't available in this demo yet." });

export function BookingRow({ b, perspective, onReview }: { b: BookingOut; perspective: "user" | "expert"; onReview?: (b: BookingOut) => void }) {
  const other = perspective === "user" ? b.expert_name : b.user_name;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-shadow duration-200 hover:shadow-md sm:flex-row sm:items-center" data-testid={`booking-row-${b.id}`}>
      <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-slate-900 text-white"><CalendarClock className="size-5" /></div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">
          {perspective === "user" ? <Link to={`/experts/${b.expert_id}`} className="hover:underline">{other}</Link> : other}
          <span className="ml-2 text-xs font-normal text-slate-500">{perspective === "user" ? b.expert_profession : b.user_email}</span>
        </p>
        <p className="text-sm text-slate-600" data-testid="booking-row-when">{fmtDateTime(b.start_at)} · {b.duration_minutes} min</p>
        {b.topic && <p className="mt-0.5 truncate text-xs text-slate-500">“{b.topic}”</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", b.is_past ? "bg-slate-100 text-slate-600 ring-slate-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200")} data-testid="booking-row-status">
          {b.is_past ? "Completed" : "Confirmed"}
        </span>
        <span className="font-mono text-sm font-bold">{formatINR(b.amount)}</span>
        {!b.is_past && <Button size="sm" onClick={joinSession} data-testid={`join-session-${b.id}`}><Video className="size-4" /> Join session</Button>}
        {perspective === "user" && b.can_review && onReview && (
          <Button size="sm" variant="outline" onClick={() => onReview(b)} data-testid={`review-button-${b.id}`}><Star className="size-4" /> Leave review</Button>
        )}
      </div>
    </div>
  );
}

export function PaymentsTable({ rows, perspective }: { rows: PaymentOut[]; perspective: "user" | "expert" | "admin" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <Table data-testid="payments-table">
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead><TableHead>Transaction ID</TableHead>
            {perspective !== "expert" && <TableHead>Expert</TableHead>}
            {perspective !== "user" && <TableHead>Client</TableHead>}
            <TableHead className="text-right">Amount</TableHead>
            {perspective !== "user" && <><TableHead className="text-right">Commission</TableHead><TableHead className="text-right">Expert net</TableHead></>}
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => (
            <TableRow key={p.id} data-testid={`payment-row-${p.id}`}>
              <TableCell className="whitespace-nowrap text-xs">{new Date(p.created_at).toLocaleDateString("en-IN")}</TableCell>
              <TableCell className="font-mono text-xs">{p.transaction_id}</TableCell>
              {perspective !== "expert" && <TableCell>{p.expert_name}</TableCell>}
              {perspective !== "user" && <TableCell>{p.user_name}</TableCell>}
              <TableCell className="text-right font-mono font-semibold">{formatINR(p.amount)}</TableCell>
              {perspective !== "user" && <><TableCell className="text-right font-mono text-rose-700">−{formatINR(p.commission_amount)} <span className="text-[10px] text-slate-400">({p.commission_pct}%)</span></TableCell><TableCell className="text-right font-mono font-semibold text-emerald-700">{formatINR(p.expert_net)}</TableCell></>}
              <TableCell><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Paid · demo</span></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ReviewDialog({ booking, onClose }: { booking: BookingOut | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const m = useMutation({
    mutationFn: () => apiPost<BookingOut>(`/me/bookings/${booking?.id}/review`, { rating, comment }),
    onSuccess: () => { toast.success("Thanks for your review"); qc.invalidateQueries({ queryKey: ["my-bookings"] }); qc.invalidateQueries({ queryKey: ["expert", booking?.expert_id] }); onClose(); setComment(""); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open={!!booking} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="review-dialog">
        <DialogHeader><DialogTitle>Review your session with {booking?.expert_name}</DialogTitle><DialogDescription>Your review appears on their public profile.</DialogDescription></DialogHeader>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`} data-testid={`review-star-${n}`} className="transition-transform active:scale-90">
              <Star className={cn("size-7", n <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300")} />
            </button>
          ))}
        </div>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder="What was most helpful?" data-testid="review-comment-input" />
        <Button onClick={() => m.mutate()} disabled={m.isPending} data-testid="review-submit-button">{m.isPending && <Loader2 className="size-4 animate-spin" />} Submit review</Button>
      </DialogContent>
    </Dialog>
  );
}

function AccountSettings({ me }: { me: UserOut }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ full_name: me.full_name, phone: me.phone });
  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  const save = useMutation({ mutationFn: () => apiPut<UserOut>("/auth/me", form), onSuccess: (u) => { qc.setQueryData(["me"], u); toast.success("Profile updated"); }, onError: (e) => toast.error(errMsg(e)) });
  const change = useMutation({ mutationFn: () => apiPost("/auth/password", pw), onSuccess: () => { toast.success("Password changed"); setPw({ current_password: "", new_password: "" }); }, onError: (e) => toast.error(errMsg(e)) });
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5" onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} data-testid="account-settings-form">
        <h3 className="font-bold">Personal details</h3>
        <div className="space-y-1.5"><Label>Email</Label><Input value={me.email} disabled data-testid="settings-email" /></div>
        <div className="space-y-1.5"><Label>Full name</Label><Input required minLength={2} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} data-testid="settings-name-input" /></div>
        <div className="space-y-1.5"><Label>Phone (optional)</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="settings-phone-input" /></div>
        <Button type="submit" disabled={save.isPending} data-testid="settings-save-button">Save changes</Button>
      </form>
      <form className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5" onSubmit={(e: FormEvent) => { e.preventDefault(); change.mutate(); }} data-testid="password-form">
        <h3 className="font-bold">Change password</h3>
        <div className="space-y-1.5"><Label>Current password</Label><Input type="password" required value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} data-testid="settings-current-password" /></div>
        <div className="space-y-1.5"><Label>New password</Label><Input type="password" required minLength={8} value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} data-testid="settings-new-password" /></div>
        <div className="flex gap-2">
          <Button type="submit" disabled={change.isPending} data-testid="settings-password-button">Update password</Button>
          <Button type="button" variant="outline" onClick={() => endSession("/")} data-testid="settings-logout-button">Log out</Button>
        </div>
      </form>
    </div>
  );
}

export default function Profile() {
  const { data: me } = useMe();
  const [reviewing, setReviewing] = useState<BookingOut | null>(null);
  const bookings = useQuery({ queryKey: ["my-bookings"], queryFn: () => apiGet<BookingOut[]>("/me/bookings") });
  const payments = useQuery({ queryKey: ["my-payments"], queryFn: () => apiGet<PaymentOut[]>("/me/payments") });
  const upcoming = (bookings.data ?? []).filter((b) => !b.is_past).reverse();
  const past = (bookings.data ?? []).filter((b) => b.is_past);
  if (!me) return null;

  const list = (rows: BookingOut[], emptyTitle: string, tid: string) =>
    bookings.isLoading ? <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div> :
    bookings.isError ? <ErrorState onRetry={() => bookings.refetch()} testId={`${tid}-error`} /> :
    !rows.length ? <EmptyState title={emptyTitle} action={<Link to="/explore" className={buttonVariants({ size: "sm" })} data-testid={`${tid}-explore-link`}>Find an expert</Link>} testId={`${tid}-empty`} /> :
    <div className="space-y-3" data-testid={`${tid}-list`}>{rows.map((b) => <BookingRow key={b.id} b={b} perspective="user" onReview={setReviewing} />)}</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold text-slate-900" data-testid="profile-page-title">My profile</h1>
      <p className="mt-1 text-slate-600">{me.full_name} · {me.email}</p>
      <Tabs defaultValue="upcoming" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="upcoming" data-testid="tab-upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past" data-testid="tab-past">Past ({past.length})</TabsTrigger>
          <TabsTrigger value="payments" data-testid="tab-payments">Payments</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">Account settings</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="mt-5">{list(upcoming, "No upcoming sessions", "upcoming")}</TabsContent>
        <TabsContent value="past" className="mt-5">{list(past, "No past sessions yet", "past")}</TabsContent>
        <TabsContent value="payments" className="mt-5">
          {payments.isLoading ? <Skeleton className="h-40" /> : payments.isError ? <ErrorState onRetry={() => payments.refetch()} /> :
            !payments.data?.length ? <EmptyState title="No payments yet" testId="payments-empty" /> : <PaymentsTable rows={payments.data} perspective="user" />}
        </TabsContent>
        <TabsContent value="settings" className="mt-5"><AccountSettings me={me} /></TabsContent>
      </Tabs>
      <ReviewDialog booking={reviewing} onClose={() => setReviewing(null)} />
    </div>
  );
}
