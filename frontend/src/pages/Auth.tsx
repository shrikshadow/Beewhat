import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost } from "@/lib/api";
import { errMsg } from "@/lib/constants";
import { dashboardPath } from "@/lib/hooks";
import { beginSession } from "@/lib/session";
import type { UserOut } from "@/lib/types";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid min-h-[70vh] max-w-md place-items-center px-4 py-12">
      <div className="w-full animate-rise rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/50">
        <span className="grid size-10 place-items-center rounded-xl bg-slate-900 text-white"><ShieldCheck className="size-5" /></span>
        <h1 className="mt-4 text-2xl font-extrabold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function afterAuth(u: UserOut) {
  beginSession(u);
}

export function Login() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const m = useMutation({
    mutationFn: () => apiPost<UserOut>("/auth/login", { email, password }),
    onSuccess: (u) => {
      afterAuth(u);
      nav(params.get("next") || (u.role === "user" ? "/home" : dashboardPath(u.role)), { replace: true });
    },
  });
  const submit = (e: FormEvent) => { e.preventDefault(); m.mutate(); };
  return (
    <AuthCard title="Welcome back" subtitle="Log in to book sessions and manage your account.">
      <form onSubmit={submit} className="space-y-4" data-testid="login-form">
        <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="login-email-input" /></div>
        <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} data-testid="login-password-input" /></div>
        {m.isError && <p className="text-sm text-rose-600" data-testid="login-error">{errMsg(m.error)}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={m.isPending} data-testid="login-submit-button">
          {m.isPending && <Loader2 className="size-4 animate-spin" />} Log in
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500">
        New here? <Link to="/signup" className="font-semibold text-sky-700" data-testid="login-to-signup-link">Create an account</Link> · <Link to="/become-expert" className="font-semibold text-sky-700" data-testid="login-to-expert-link">Apply as expert</Link>
      </p>
    </AuthCard>
  );
}

export function Signup() {
  const nav = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const m = useMutation({
    mutationFn: () => apiPost<UserOut>("/auth/signup", { ...form, role: "user" }),
    onSuccess: (u) => { afterAuth(u); nav("/home", { replace: true }); },
  });
  const submit = (e: FormEvent) => { e.preventDefault(); m.mutate(); };
  const upd = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  return (
    <AuthCard title="Create your account" subtitle="Book 1:1 sessions with verified professionals.">
      <form onSubmit={submit} className="space-y-4" data-testid="signup-form">
        <div className="space-y-1.5"><Label htmlFor="name">Full name</Label><Input id="name" required minLength={2} value={form.full_name} onChange={upd("full_name")} data-testid="signup-name-input" /></div>
        <div className="space-y-1.5"><Label htmlFor="semail">Email</Label><Input id="semail" type="email" required value={form.email} onChange={upd("email")} data-testid="signup-email-input" /></div>
        <div className="space-y-1.5"><Label htmlFor="spw">Password</Label><Input id="spw" type="password" required minLength={8} value={form.password} onChange={upd("password")} placeholder="At least 8 characters" data-testid="signup-password-input" /></div>
        {m.isError && <p className="text-sm text-rose-600" data-testid="signup-error">{errMsg(m.error)}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={m.isPending} data-testid="signup-submit-button">
          {m.isPending && <Loader2 className="size-4 animate-spin" />} Create account
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500">
        Already have an account? <Link to="/login" className="font-semibold text-sky-700" data-testid="signup-to-login-link">Log in</Link>
      </p>
      <p className="mt-2 text-center text-sm text-slate-500">
        Are you a professional? <Link to="/become-expert" className="font-semibold text-sky-700" data-testid="signup-to-expert-link">Apply as an expert</Link>
      </p>
    </AuthCard>
  );
}
