import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ExternalLink, FileText, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { InitialsAvatar } from "@/components/marketplace/InitialsAvatar";
import { EmptyState, ErrorState, Skeleton } from "@/components/common/States";
import { PaymentsTable } from "@/pages/Profile";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { categoryName, errMsg, fmtDateTime, formatINR } from "@/lib/constants";
import type { AdminStats, BookingOut, ExpertMe, PaymentOut, PublicSettings, UserOut, VerifyIn } from "@/lib/types";
import { cn } from "@/lib/utils";

function useAdmin<T>(key: string, path: string) {
  return useQuery({ queryKey: ["admin", key], queryFn: () => apiGet<T>(path) });
}

function ExpertReviewCard({ e }: { e: ExpertMe }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const done = (msg: string) => () => { toast.success(msg); qc.invalidateQueries({ queryKey: ["admin"] }); qc.invalidateQueries({ queryKey: ["experts"] }); qc.invalidateQueries({ queryKey: ["expert", e.id] }); };
  const verify = useMutation({ mutationFn: (b: VerifyIn) => apiPost<ExpertMe>(`/admin/experts/${e.id}/verify`, b), onSuccess: done("Verification updated"), onError: (x) => toast.error(errMsg(x)) });
  const approve = useMutation({ mutationFn: () => apiPost<ExpertMe>(`/admin/experts/${e.id}/approve`), onSuccess: done(`${e.full_name} approved and published`), onError: (x) => toast.error(errMsg(x)) });
  const reject = useMutation({ mutationFn: () => apiPost<ExpertMe>(`/admin/experts/${e.id}/reject`, { reason }), onSuccess: done("Application rejected"), onError: (x) => toast.error(errMsg(x)) });
  const checks: { key: keyof VerifyIn; label: string; claim: string; value: boolean }[] = [
    { key: "identity_verified", label: "Identity", claim: e.verification.identity.claim, value: e.identity_verified },
    { key: "employment_verified", label: "Employment", claim: e.verification.employment.claim || "Not provided", value: e.employment_verified },
    { key: "credentials_verified", label: "Credentials", claim: e.verification.credentials.claim || "Not provided", value: e.credentials_verified },
  ];
  const statusTone = { draft: "bg-slate-100 text-slate-700", pending: "bg-amber-50 text-amber-800", approved: "bg-emerald-50 text-emerald-700", rejected: "bg-rose-50 text-rose-700" }[e.status];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5" data-testid={`admin-expert-card-${e.id}`}>
      <div className="flex flex-wrap items-start gap-3">
        <InitialsAvatar name={e.full_name} photoUrl={e.photo_url} />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900">{e.full_name} <span className="text-sm font-normal text-slate-500">· {e.email}</span></p>
          <p className="text-sm text-slate-600">{e.designation} at {e.company} · {e.profession} · {e.years_experience} yrs</p>
          <p className="mt-1 text-xs text-slate-500">{e.categories.map(categoryName).join(", ")} · {e.languages.join(", ")} · {formatINR(e.price_15)}/{formatINR(e.price_30)}/{formatINR(e.price_60)}</p>
        </div>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", statusTone)} data-testid="admin-expert-status">{e.status}</span>
      </div>
      {e.short_intro && <p className="mt-3 text-sm text-slate-700">{e.short_intro}</p>}
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        {e.linkedin_url && <a href={e.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-sky-700" data-testid="admin-expert-linkedin">LinkedIn <ExternalLink className="size-3" /></a>}
        {e.documents.map((d) => (
          <a key={d.id} href={`/api/admin/documents/${d.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700 hover:bg-slate-200" data-testid={`admin-doc-link-${d.id}`}>
            <FileText className="size-3" /> {d.doc_type}: {d.filename}
          </a>
        ))}
        {!e.documents.length && <span className="text-rose-600">No documents uploaded</span>}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3" data-testid="admin-verification-controls">
        {checks.map((c) => (
          <label key={c.key} className={cn("flex cursor-pointer items-start gap-2.5 rounded-xl p-3 ring-1 transition-colors", c.value ? "bg-emerald-50 ring-emerald-200" : "bg-slate-50 ring-slate-200")}>
            <Checkbox checked={c.value} disabled={verify.isPending} onCheckedChange={(v) => verify.mutate({ [c.key]: !!v })} data-testid={`admin-verify-${c.key}-${e.id}`} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{c.label} {c.value ? "verified" : "not verified"}</span>
              <span className="block truncate text-xs text-slate-500" title={c.claim}>Claim: {c.claim}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {e.status !== "approved" && e.status !== "draft" && (
          <Button size="sm" onClick={() => approve.mutate()} disabled={approve.isPending} data-testid={`admin-approve-${e.id}`}>
            {approve.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Approve & publish
          </Button>
        )}
        {e.status !== "rejected" && e.status !== "draft" && !rejecting && (
          <Button size="sm" variant="outline" onClick={() => setRejecting(true)} data-testid={`admin-reject-open-${e.id}`}><X className="size-4" /> {e.status === "approved" ? "Unpublish" : "Reject"}</Button>
        )}
        {e.status === "approved" && <Link to={`/experts/${e.id}`} className="text-xs font-semibold text-sky-700" data-testid={`admin-view-profile-${e.id}`}>View public profile →</Link>}
        {e.status === "draft" && <span className="text-xs text-slate-500">Application not submitted yet</span>}
      </div>
      {rejecting && (
        <div className="mt-3 space-y-2 rounded-xl bg-rose-50/60 p-3 ring-1 ring-rose-200">
          <Textarea value={reason} onChange={(x) => setReason(x.target.value)} placeholder="Reason shown to the expert (e.g. ID document unreadable)" className="bg-white" data-testid={`admin-reject-reason-${e.id}`} />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={reason.trim().length < 3 || reject.isPending} onClick={() => reject.mutate()} data-testid={`admin-reject-confirm-${e.id}`}>Confirm</Button>
            <Button size="sm" variant="ghost" onClick={() => setRejecting(false)} data-testid={`admin-reject-cancel-${e.id}`}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExpertList({ status }: { status: string }) {
  const q = useAdmin<ExpertMe[]>(`experts-${status}`, `/admin/experts?status=${status}`);
  if (q.isLoading) return <div className="space-y-3"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} testId={`admin-experts-${status}-error`} />;
  if (!q.data?.length) return <EmptyState title={status === "pending" ? "No pending applications" : "No experts"} description={status === "pending" ? "You're all caught up." : undefined} testId={`admin-experts-${status}-empty`} />;
  return <div className="space-y-4" data-testid={`admin-experts-${status}-list`}>{q.data.map((e) => <ExpertReviewCard key={e.id} e={e} />)}</div>;
}

function CommissionSetting({ current }: { current: number }) {
  const qc = useQueryClient();
  const [val, setVal] = useState(String(current));
  const m = useMutation({
    mutationFn: () => apiPut<PublicSettings>("/admin/settings/commission", { commission_pct: Number(val) }),
    onSuccess: () => { toast.success("Commission updated — applies to new payments"); qc.invalidateQueries({ queryKey: ["admin"] }); qc.invalidateQueries({ queryKey: ["settings-public"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-5" data-testid="admin-commission-setting">
      <h3 className="font-bold">Platform commission</h3>
      <p className="mt-1 text-sm text-slate-500">Deducted from the expert's share of each new payment. Existing payments keep the rate they were made at.</p>
      <div className="mt-4 flex items-center gap-2">
        <Input type="number" min={0} max={50} step={0.5} value={val} onChange={(e) => setVal(e.target.value)} className="w-28 font-mono" data-testid="admin-commission-input" />
        <span className="text-sm text-slate-500">%</span>
        <Button onClick={() => m.mutate()} disabled={m.isPending || val === "" || Number(val) < 0 || Number(val) > 50} data-testid="admin-commission-save">Save</Button>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const stats = useAdmin<AdminStats>("stats", "/admin/stats");
  const users = useAdmin<UserOut[]>("users", "/admin/users");
  const bookings = useAdmin<BookingOut[]>("bookings", "/admin/bookings");
  const payments = useAdmin<PaymentOut[]>("payments", "/admin/payments");
  const s = stats.data;
  const cards = s ? [
    ["Users", String(s.users)], ["Live experts", String(s.experts_approved)], ["Pending approvals", String(s.experts_pending)],
    ["Bookings", String(s.bookings)], ["Gross volume", formatINR(s.gross_volume)], ["Commission earned", formatINR(s.commission_earned)],
  ] : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold text-slate-900" data-testid="admin-title">Admin dashboard</h1>
      <p className="mt-1 text-slate-600">Approvals, verification and platform activity, including Razorpay payments.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6" data-testid="admin-stats">
        {stats.isLoading ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />) : stats.isError ? <div className="col-span-full"><ErrorState onRetry={() => stats.refetch()} /></div> :
          cards.map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4" data-testid={`admin-stat-${k.toLowerCase().replace(/\s+/g, "-")}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{k}</p>
              <p className="mt-1 font-mono text-xl font-bold text-slate-900">{v}</p>
            </div>
          ))}
      </div>

      <Tabs defaultValue="pending" className="mt-8">
        <TabsList className="flex-wrap">
          <TabsTrigger value="pending" data-testid="admin-tab-pending">Pending approvals{s?.experts_pending ? ` (${s.experts_pending})` : ""}</TabsTrigger>
          <TabsTrigger value="experts" data-testid="admin-tab-experts">All experts</TabsTrigger>
          <TabsTrigger value="users" data-testid="admin-tab-users">Users</TabsTrigger>
          <TabsTrigger value="bookings" data-testid="admin-tab-bookings">Bookings</TabsTrigger>
          <TabsTrigger value="payments" data-testid="admin-tab-payments">Payments</TabsTrigger>
          <TabsTrigger value="settings" data-testid="admin-tab-settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-5"><ExpertList status="pending" /></TabsContent>
        <TabsContent value="experts" className="mt-5"><ExpertList status="all" /></TabsContent>
        <TabsContent value="users" className="mt-5">
          {users.isLoading ? <Skeleton className="h-40" /> : users.isError ? <ErrorState onRetry={() => users.refetch()} /> : (
            <div className="rounded-2xl border border-slate-200 bg-white">
              <Table data-testid="admin-users-table">
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Joined</TableHead></TableRow></TableHeader>
                <TableBody>{users.data?.map((u) => (
                  <TableRow key={u.id} data-testid={`admin-user-row-${u.id}`}><TableCell className="font-medium">{u.full_name}</TableCell><TableCell>{u.email}</TableCell>
                    <TableCell><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize">{u.role}</span></TableCell>
                    <TableCell className="text-xs">{new Date(u.created_at).toLocaleDateString("en-IN")}</TableCell></TableRow>
                ))}</TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="bookings" className="mt-5">
          {bookings.isLoading ? <Skeleton className="h-40" /> : bookings.isError ? <ErrorState onRetry={() => bookings.refetch()} /> : !bookings.data?.length ? <EmptyState title="No bookings yet" testId="admin-bookings-empty" /> : (
            <div className="rounded-2xl border border-slate-200 bg-white">
              <Table data-testid="admin-bookings-table">
                <TableHeader><TableRow><TableHead>When (IST)</TableHead><TableHead>Client</TableHead><TableHead>Expert</TableHead><TableHead>Length</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{bookings.data.map((b) => (
                  <TableRow key={b.id} data-testid={`admin-booking-row-${b.id}`}><TableCell className="whitespace-nowrap text-xs">{fmtDateTime(b.start_at)}</TableCell><TableCell>{b.user_name}</TableCell><TableCell>{b.expert_name}</TableCell>
                    <TableCell>{b.duration_minutes} min</TableCell><TableCell className="text-right font-mono">{formatINR(b.amount)}</TableCell>
                    <TableCell><span className="text-xs font-semibold">{b.is_past ? "Completed" : "Confirmed"}</span></TableCell></TableRow>
                ))}</TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="payments" className="mt-5">
          {payments.isLoading ? <Skeleton className="h-40" /> : payments.isError ? <ErrorState onRetry={() => payments.refetch()} /> : !payments.data?.length ? <EmptyState title="No payments yet" testId="admin-payments-empty" /> : <PaymentsTable rows={payments.data} perspective="admin" />}
        </TabsContent>
        <TabsContent value="settings" className="mt-5">{s ? <CommissionSetting key={s.commission_pct} current={s.commission_pct} /> : <Skeleton className="h-32 max-w-md" />}</TabsContent>
      </Tabs>
    </div>
  );
}
