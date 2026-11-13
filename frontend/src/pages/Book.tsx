import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Clock, CreditCard, Loader2, Lock } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InitialsAvatar } from "@/components/marketplace/InitialsAvatar";
import { EmptyState, ErrorState, PageLoader, Skeleton } from "@/components/common/States";
import { apiGet, apiPost } from "@/lib/api";
import { DURATIONS, errMsg, fmtDateTime, fmtDay, fmtTime, formatINR, type Duration } from "@/lib/constants";
import { useMe, usePublicSettings } from "@/lib/hooks";
import type { CheckoutIn, CheckoutOrderOut, CheckoutOut, ExpertDetail, SlotDay } from "@/lib/types";
import { cn } from "@/lib/utils";

type RazorpayResult = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayOptions = {
  key: string; amount: number; currency: string; name: string; description: string;
  order_id: string; prefill: { name: string; email: string; contact: string };
  handler: (result: RazorpayResult) => void;
  modal: { ondismiss: () => void };
};
declare global { interface Window { Razorpay?: new (options: RazorpayOptions) => { open: () => void }; } }

async function loadRazorpay() {
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Couldn't load Razorpay Checkout."));
    document.body.appendChild(script);
  });
}

export default function Book() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const initial = Number(params.get("d"));
  const [duration, setDuration] = useState<Duration>(DURATIONS.includes(initial as Duration) ? (initial as Duration) : 30);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<CheckoutOut | null>(null);

  const expert = useQuery({ queryKey: ["expert", id], queryFn: () => apiGet<ExpertDetail>(`/experts/${id}`), retry: false });
  const slots = useQuery({ queryKey: ["slots", id, duration], queryFn: () => apiGet<SlotDay[]>(`/experts/${id}/slots?duration=${duration}`), enabled: expert.isSuccess });
  const settings = usePublicSettings();

  const days = slots.data ?? [];
  const activeDay = days.find((d) => d.date === day) ?? days[0];
  const price = expert.data ? { 15: expert.data.price_15, 30: expert.data.price_30, 60: expert.data.price_60 }[duration] : 0;
  const pct = settings.data?.commission_pct ?? 12;
  const expertGets = useMemo(() => Math.round(price * (100 - pct)) / 100, [price, pct]);
  const isSelf = !!expert.data && !!me && me.role === "expert" && expert.data.full_name === me.full_name;

  const pay = useMutation({
    mutationFn: async (body: CheckoutIn) => {
      const order = await apiPost<CheckoutOrderOut>("/checkout/order", body);
      await loadRazorpay();
      if (!window.Razorpay) throw new Error("Razorpay Checkout is unavailable.");
      return new Promise<CheckoutOut>((resolve, reject) => {
        const checkout = new window.Razorpay!({
          key: order.key_id, amount: order.amount, currency: order.currency,
          name: "BeeWisely", description: `Consultation with ${expert.data?.full_name ?? "expert"}`, order_id: order.order_id,
          prefill: { name: me?.full_name ?? "", email: me?.email ?? "", contact: me?.phone ?? "" },
          handler: (result) => {
            apiPost<CheckoutOut>("/checkout/verify", {
              ...body, razorpay_order_id: result.razorpay_order_id,
              razorpay_payment_id: result.razorpay_payment_id, razorpay_signature: result.razorpay_signature,
            }).then(resolve, reject);
          },
          modal: { ondismiss: () => reject(new Error("Payment cancelled.")) },
        });
        checkout.open();
      });
    },
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      qc.invalidateQueries({ queryKey: ["my-payments"] });
      qc.invalidateQueries({ queryKey: ["slots", id] });
    },
    onError: (e) => {
      toast.error(errMsg(e, "Payment failed. No booking was made."));
      setOpen(false);
      setSlot(null);
      qc.invalidateQueries({ queryKey: ["slots", id] });
    },
  });

  if (expert.isLoading) return <PageLoader label="Preparing booking…" />;
  if (expert.isError || !expert.data)
    return <div className="mx-auto max-w-3xl px-4 py-16"><ErrorState message="This expert isn't available for booking." onRetry={() => expert.refetch()} testId="book-error" /></div>;
  const e = expert.data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to={`/experts/${e.id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900" data-testid="book-back-link">
        <ArrowLeft className="size-4" /> Back to profile
      </Link>
      <div className="mt-4 flex items-center gap-3">
        <InitialsAvatar name={e.full_name} photoUrl={e.photo_url} />
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900" data-testid="book-title">Book a session with {e.full_name}</h1>
          <p className="text-sm text-slate-600">{e.designation}{e.company ? ` · ${e.company}` : ""}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Step 1</p>
            <h2 className="mt-1 text-lg font-bold">Session length</h2>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {DURATIONS.map((d) => {
                const p = { 15: e.price_15, 30: e.price_30, 60: e.price_60 }[d];
                return (
                  <button key={d} onClick={() => { setDuration(d); setSlot(null); }} data-testid={`duration-${d}-button`}
                    className={cn("rounded-2xl border p-3 text-left transition-[border-color,box-shadow,transform] duration-150 active:scale-[0.98]", duration === d ? "border-slate-900 bg-slate-900 text-white shadow-md" : "border-slate-200 bg-white hover:border-slate-400")}>
                    <p className="flex items-center gap-1 text-sm font-semibold"><Clock className="size-3.5" /> {d} min</p>
                    <p className="mt-1 font-mono text-lg font-bold">{formatINR(p)}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6" data-testid="slot-picker">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Step 2</p>
            <h2 className="mt-1 text-lg font-bold">Pick a time <span className="text-sm font-normal text-slate-500">(IST)</span></h2>
            {slots.isLoading ? (
              <div className="mt-4 space-y-3"><Skeleton className="h-14 w-full" /><Skeleton className="h-24 w-full" /></div>
            ) : slots.isError ? (
              <div className="mt-4"><ErrorState message="Couldn't load time slots." onRetry={() => slots.refetch()} testId="slots-error" /></div>
            ) : !days.length ? (
              <div className="mt-4"><EmptyState title="No open slots in the next 2 weeks" description="Try a shorter session or check back later." testId="slots-empty" /></div>
            ) : (
              <>
                <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-2">
                  {days.map((d) => (
                    <button key={d.date} onClick={() => { setDay(d.date); setSlot(null); }} data-testid={`slot-day-${d.date}`}
                      className={cn("shrink-0 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors duration-150", activeDay?.date === d.date ? "border-sky-600 bg-sky-50 text-sky-800" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400")}>
                      {fmtDay(d.date)}
                      <span className="block text-[11px] font-normal text-slate-500">{d.slots.length} slots</span>
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {activeDay?.slots.map((s) => (
                    <button key={s} onClick={() => setSlot(s)} data-testid="slot-select-button"
                      className={cn("rounded-lg border py-2 font-mono text-sm transition-[background-color,border-color,transform] duration-150 active:scale-[0.97]", slot === s ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-800 hover:border-slate-500")}>
                      {fmtTime(s)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Step 3 · optional</p>
            <Label htmlFor="topic" className="mt-1 text-lg font-bold">What would you like to discuss?</Label>
            <Textarea id="topic" value={topic} onChange={(ev) => setTopic(ev.target.value)} maxLength={500} placeholder="e.g. Preparing for a senior backend interview at a product company" className="mt-3" data-testid="booking-topic-input" />
          </section>
        </div>

        <aside className="lg:col-span-5">
          <div className="sticky top-24 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" data-testid="price-breakdown">
            <h2 className="text-lg font-bold">Price breakdown</h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between"><dt className="text-slate-600">{duration}-minute session</dt><dd className="font-mono font-semibold" data-testid="breakdown-session-price">{formatINR(price)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-600">Booking fee</dt><dd className="font-mono font-semibold">{formatINR(0)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-600">Taxes</dt><dd className="font-mono font-semibold">Included</dd></div>
              <div className="flex justify-between border-t border-dashed border-slate-200 pt-3 text-base"><dt className="font-bold">Total payable</dt><dd className="font-mono font-bold" data-testid="breakdown-total">{formatINR(price)}</dd></div>
            </dl>
            <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500">
              Of this, {pct}% is the platform commission. {e.full_name.split(" ")[0]} receives {formatINR(expertGets)}.
            </p>
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm" data-testid="booking-summary">
              {slot ? <p><span className="text-slate-500">When:</span> <span className="font-semibold">{fmtDateTime(slot)}</span></p> : <p className="text-slate-500">Select a time slot to continue.</p>}
            </div>
            {isSelf ? (
              <p className="mt-4 text-sm text-amber-700">You can't book a session with yourself.</p>
            ) : (
              <Button size="lg" className="mt-4 w-full" disabled={!slot} onClick={() => { setResult(null); setOpen(true); }} data-testid="proceed-to-pay-button">
                <Lock className="size-4" /> Continue to payment
              </Button>
            )}
          </div>
        </aside>
      </div>

      <Dialog open={open} onOpenChange={(o) => { if (!pay.isPending) setOpen(o); }}>
        <DialogContent className="sm:max-w-md" data-testid="checkout-modal">
          {result ? (
            <div className="py-2 text-center" data-testid="payment-success">
              <CheckCircle2 className="mx-auto size-14 text-emerald-600" />
              <DialogTitle className="mt-3 text-xl">Payment successful — booking confirmed</DialogTitle>
              <DialogDescription className="mt-1">{fmtDateTime(result.booking.start_at)} · {result.booking.duration_minutes} min with {result.booking.expert_name}</DialogDescription>
              <div className="mt-4 rounded-xl bg-slate-50 p-3 text-left text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Amount paid</span><span className="font-mono font-bold" data-testid="payment-success-amount">{formatINR(result.payment.amount)}</span></div>
                <div className="mt-1 flex justify-between"><span className="text-slate-500">Transaction ID</span><span className="font-mono text-xs" data-testid="payment-success-txn">{result.payment.transaction_id}</span></div>
              </div>
              <div className="mt-5 grid gap-2">
                <Button onClick={() => nav("/profile")} data-testid="payment-success-view-bookings">View my bookings</Button>
                <Link to="/explore" className={buttonVariants({ variant: "ghost" })} data-testid="payment-success-explore">Keep exploring</Link>
              </div>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Secure checkout</DialogTitle>
                <DialogDescription>Pay securely with Razorpay to confirm your session.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 rounded-xl border border-slate-200 p-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Expert</span><span className="font-semibold">{e.full_name}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Session</span><span className="font-semibold">{duration} min</span></div>
                <div className="flex justify-between"><span className="text-slate-500">When</span><span className="font-semibold">{slot ? fmtDateTime(slot) : "-"}</span></div>
                <div className="flex justify-between border-t pt-2 text-base"><span className="font-bold">Total</span><span className="font-mono font-bold" data-testid="checkout-total">{formatINR(price)}</span></div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-slate-900 p-3 text-white">
                <CreditCard className="size-5 text-amber-300" />
                <div className="text-xs"><p className="font-semibold">Razorpay secure payment</p><p className="text-slate-400">UPI, cards and other methods enabled on your account</p></div>
              </div>
              <Button size="lg" disabled={pay.isPending || !slot} data-testid="pay-button"
                onClick={() => slot && pay.mutate({ expert_id: e.id, duration_minutes: duration, start_at: slot, topic })}>
                {pay.isPending ? <><Loader2 className="size-4 animate-spin" /> Processing payment…</> : <>Pay {formatINR(price)}</>}
              </Button>
              <p className="text-center text-[11px] text-slate-400">The final amount is calculated by our server from the expert's saved price.</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
