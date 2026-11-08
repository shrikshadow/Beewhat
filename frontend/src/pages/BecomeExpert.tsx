import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Clock, Loader2, MailCheck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AvailabilityEditor, CompanySection, DocumentsSection, ExpertiseSection, IntroSection, PhotoSection,
  PricingSection, ProfessionalSection, VALIDATORS, toDraft, type Draft,
} from "@/components/expert/ProfileFields";
import { AuthCard, afterAuth } from "@/pages/Auth";
import { PageLoader, ErrorState } from "@/components/common/States";
import { apiPost, apiPut } from "@/lib/api";
import { categoryName, errMsg, formatINR } from "@/lib/constants";
import { useExpertMe, useMe } from "@/lib/hooks";
import { endSession } from "@/lib/session";
import type { ExpertMe, OtpSendOut, UserOut } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "account", title: "Account" },
  { key: "professional", title: "Professional details" },
  { key: "company", title: "Company details" },
  { key: "documents", title: "ID & certificates" },
  { key: "expertise", title: "Expertise & languages" },
  { key: "intro", title: "Photo & introduction" },
  { key: "pricing", title: "Pricing & availability" },
  { key: "review", title: "Review & submit" },
];

function AccountStep() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState<OtpSendOut | null>(null);
  const send = useMutation({ mutationFn: () => apiPost<OtpSendOut>("/auth/otp/send", { email: form.email }), onSuccess: setSent });
  const signup = useMutation({
    mutationFn: () => apiPost<UserOut>("/auth/signup", { ...form, role: "expert", otp }),
    onSuccess: (u) => { afterAuth(u); qc.invalidateQueries({ queryKey: ["expert-me"] }); toast.success("Email verified — account created"); },
  });
  const upd = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => { setForm({ ...form, [k]: e.target.value }); setSent(null); };
  const onSend = (e: FormEvent) => { e.preventDefault(); send.mutate(); };
  const onVerify = (e: FormEvent) => { e.preventDefault(); signup.mutate(); };

  return (
    <AuthCard title="Apply as an expert" subtitle="Step 1 of 8 — create your expert account. You'll be listed only after our team approves you.">
      <form onSubmit={onSend} className="space-y-4" data-testid="expert-account-form">
        <Input required minLength={2} placeholder="Full name (as on your ID)" value={form.full_name} onChange={upd("full_name")} data-testid="expert-signup-name-input" />
        <Input required type="email" placeholder="Work or personal email" value={form.email} onChange={upd("email")} data-testid="expert-signup-email-input" />
        <Input required type="password" minLength={8} placeholder="Password (min 8 characters)" value={form.password} onChange={upd("password")} data-testid="expert-signup-password-input" />
        {send.isError && <p className="text-sm text-rose-600" data-testid="expert-otp-send-error">{errMsg(send.error)}</p>}
        {!sent && (
          <Button type="submit" className="w-full" size="lg" disabled={send.isPending} data-testid="expert-send-otp-button">
            {send.isPending && <Loader2 className="size-4 animate-spin" />} Send verification code
          </Button>
        )}
      </form>
      {sent && (
        <form onSubmit={onVerify} className="mt-4 space-y-3 rounded-xl bg-sky-50 p-4 ring-1 ring-sky-200" data-testid="expert-otp-form">
          <p className="flex items-center gap-2 text-sm font-semibold text-sky-900"><MailCheck className="size-4" /> Code sent to {form.email}</p>
          <p className="text-xs text-sky-800" data-testid="expert-otp-hint">{sent.demo_hint}</p>
          <Input inputMode="numeric" maxLength={6} required placeholder="6-digit code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} className="bg-white font-mono tracking-[0.4em]" data-testid="expert-otp-input" />
          {signup.isError && <p className="text-sm text-rose-600" data-testid="expert-otp-error">{errMsg(signup.error)}</p>}
          <Button type="submit" className="w-full" disabled={signup.isPending || otp.length !== 6} data-testid="expert-verify-otp-button">
            {signup.isPending && <Loader2 className="size-4 animate-spin" />} Verify & continue
          </Button>
        </form>
      )}
      <p className="mt-5 text-center text-sm text-slate-500">Already applied? <Link to="/login?next=/become-expert" className="font-semibold text-sky-700" data-testid="expert-login-link">Log in</Link></p>
    </AuthCard>
  );
}

function ReviewStep({ d, me }: { d: Draft; me: ExpertMe }) {
  const rows: [string, string][] = [
    ["Name", d.full_name], ["Profession", d.profession], ["Designation", d.designation], ["Company", d.company],
    ["Experience", `${d.years_experience} years`], ["LinkedIn", d.linkedin_url], ["Credentials", d.credentials || "—"],
    ["Expertise", d.expertise.join(", ")], ["Languages", d.languages.join(", ")], ["Categories", d.categories.map(categoryName).join(", ")],
    ["Prices", `${formatINR(d.price_15)} / ${formatINR(d.price_30)} / ${formatINR(d.price_60)} (15/30/60 min)`],
    ["Documents", me.documents.map((x) => `${x.doc_type}: ${x.filename}`).join(", ") || "—"],
  ];
  return (
    <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white" data-testid="onboarding-review">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-3 gap-3 px-4 py-2.5 text-sm"><dt className="text-slate-500">{k}</dt><dd className="col-span-2 break-words font-medium text-slate-900">{v}</dd></div>
      ))}
    </dl>
  );
}

function Wizard({ me }: { me: ExpertMe }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [stepState, setStep] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const d = draft ?? toDraft(me);
  const set = (p: Partial<Draft>) => { setDraft({ ...d, ...p }); setErr(null); };
  const step = stepState ?? Math.min(Math.max(2, me.onboarding_step), 8);
  const cur = STEPS[step - 1];

  const save = useMutation({
    mutationFn: (next: number) => apiPut<ExpertMe>("/expert/me", { ...d, onboarding_step: next }),
    onSuccess: (m, next) => { qc.setQueryData(["expert-me"], m); setStep(next); window.scrollTo({ top: 0, behavior: "smooth" }); },
    onError: (e) => setErr(errMsg(e)),
  });
  const submit = useMutation({
    mutationFn: () => apiPost<ExpertMe>("/expert/me/submit"),
    onSuccess: (m) => { qc.setQueryData(["expert-me"], m); toast.success("Application submitted for review"); nav("/expert/dashboard"); },
    onError: (e) => setErr(errMsg(e)),
  });
  const next = () => {
    const v = VALIDATORS[cur.key]?.(d, me);
    if (v) { setErr(v); return; }
    save.mutate(step + 1);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-slate-900">Expert application</h1>
        {me.status === "rejected" && <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">Changes requested</span>}
      </div>
      {me.status === "rejected" && me.rejection_reason && <p className="mt-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800" data-testid="onboarding-rejection-reason">Admin note: {me.rejection_reason}</p>}
      {/* Stepper */}
      <ol className="mt-5 flex gap-1.5" data-testid="onboarding-stepper">
        {STEPS.map((s, i) => (
          <li key={s.key} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i + 1 < step ? "bg-emerald-500" : i + 1 === step ? "bg-slate-900" : "bg-slate-200")} />
        ))}
      </ol>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500" data-testid="onboarding-step-label">Step {step} of 8</p>
      <h2 className="mt-1 text-xl font-bold text-slate-900" data-testid="onboarding-step-title">{cur.title}</h2>

      <div key={step} className="mt-5 animate-rise rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        {cur.key === "professional" && <ProfessionalSection d={d} set={set} />}
        {cur.key === "company" && <CompanySection d={d} set={set} />}
        {cur.key === "documents" && <DocumentsSection me={me} />}
        {cur.key === "expertise" && <ExpertiseSection d={d} set={set} />}
        {cur.key === "intro" && <div className="space-y-6"><PhotoSection me={me} /><IntroSection d={d} set={set} /></div>}
        {cur.key === "pricing" && <div className="space-y-6"><PricingSection d={d} set={set} /><AvailabilityEditor d={d} set={set} /></div>}
        {cur.key === "review" && <ReviewStep d={d} me={me} />}
        {err && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700" data-testid="onboarding-error">{err}</p>}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <Button variant="ghost" disabled={step <= 2 || save.isPending} onClick={() => { setErr(null); setStep(step - 1); }} data-testid="onboarding-back-button">
          <ArrowLeft className="size-4" /> Back
        </Button>
        {cur.key === "review" ? (
          <Button size="lg" disabled={submit.isPending} onClick={() => submit.mutate()} data-testid="onboarding-submit-button">
            {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Submit for review
          </Button>
        ) : (
          <Button size="lg" disabled={save.isPending} onClick={next} data-testid="onboarding-next-button">
            {save.isPending && <Loader2 className="size-4 animate-spin" />} Save & continue <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function BecomeExpert() {
  const me = useMe();
  const isExpert = me.data?.role === "expert";
  const em = useExpertMe(isExpert);
  if (me.isLoading || (isExpert && em.isLoading)) return <PageLoader />;
  if (!me.data) return <AccountStep />;
  if (!isExpert)
    return (
      <AuthCard title="Expert accounts are separate" subtitle="You're signed in with a client account. Log out and apply with a different email to become an expert.">
        <Button className="w-full" onClick={() => endSession("/become-expert")} data-testid="become-expert-logout-button">Log out & apply</Button>
      </AuthCard>
    );
  if (em.isError || !em.data) return <div className="mx-auto max-w-xl px-4 py-16"><ErrorState onRetry={() => em.refetch()} /></div>;
  if (em.data.status === "pending" || em.data.status === "approved")
    return (
      <AuthCard title={em.data.status === "pending" ? "Application under review" : "You're approved!"} subtitle={em.data.status === "pending" ? "Our team is reviewing your details and documents. You'll be published once approved." : "Your profile is live on Verity."}>
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" data-testid="become-expert-status"><Clock className="size-4" /> Status: {em.data.status}</div>
        <Link to="/expert/dashboard" className={`${buttonVariants({ size: "lg" })} mt-4 w-full`} data-testid="become-expert-dashboard-link">Go to dashboard</Link>
      </AuthCard>
    );
  return <Wizard me={em.data} />;
}
