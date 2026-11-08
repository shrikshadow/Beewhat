import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES, DAYS, LANGUAGES, PROFESSIONS } from "@/lib/constants";
import { apiPost } from "@/lib/api";
import { errMsg, fileToBase64 } from "@/lib/constants";
import type { DocumentUploadIn, ExpertMe, ExpertProfileUpdate, WeeklyAvailability } from "@/lib/types";

export type Draft = Required<Pick<ExpertProfileUpdate,
  "full_name" | "profession" | "designation" | "company" | "company_website" | "years_experience" |
  "linkedin_url" | "credentials" | "short_intro" | "bio" | "expertise" | "languages" | "categories" |
  "price_15" | "price_30" | "price_60" | "weekly_availability" | "available_now" | "onboarding_step"
>>;

export function toDraft(me: ExpertMe): Draft {
  return {
    full_name: me.full_name, profession: me.profession, designation: me.designation, company: me.company,
    company_website: me.company_website, years_experience: me.years_experience, linkedin_url: me.linkedin_url,
    credentials: me.credentials, short_intro: me.short_intro, bio: me.bio, expertise: [...me.expertise],
    languages: [...me.languages], categories: [...me.categories], price_15: me.price_15, price_30: me.price_30,
    price_60: me.price_60, weekly_availability: structuredClone(me.weekly_availability),
    available_now: me.available_now, onboarding_step: me.onboarding_step,
  };
}

type DraftProps = { d: Draft; set: (patch: Partial<Draft>) => void };
type FieldProps = { label: string; value: string | number; onChange: (value: string) => void; type?: string; required?: boolean };
function Field({ label, value, onChange, type = "text", required }: FieldProps) {
  return <label className="block space-y-1.5"><Label>{label}</Label><Input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}
function ListField({ label, values, onChange, options }: { label: string; values: string[]; onChange: (values: string[]) => void; options?: string[] }) {
  const [entry, setEntry] = useState("");
  const add = (value: string) => { const item = value.trim(); if (item && !values.includes(item)) onChange([...values, item]); setEntry(""); };
  return <div className="space-y-2"><Label>{label}</Label>{options ? <div className="flex flex-wrap gap-2">{options.map((option) => <label key={option} className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={values.includes(option)} onChange={(e) => onChange(e.target.checked ? [...values, option] : values.filter((v) => v !== option))} />{option}</label>)}</div> : <div className="flex gap-2"><Input value={entry} onChange={(e) => setEntry(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(entry); } }} placeholder={`Add ${label.toLowerCase()}`} /><Button type="button" variant="outline" onClick={() => add(entry)}>Add</Button></div>}{!options && <div className="flex flex-wrap gap-2">{values.map((value) => <button type="button" key={value} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs" onClick={() => onChange(values.filter((v) => v !== value))}>{value} ×</button>)}</div>}</div>;
}

export function ProfessionalSection({ d, set }: DraftProps) {
  return <div className="grid gap-4 sm:grid-cols-2"><Field label="Full name" value={d.full_name} required onChange={(full_name) => set({ full_name })} /><label className="space-y-1.5"><Label>Profession</Label><select className="h-10 w-full rounded-lg border bg-white px-3" value={d.profession} onChange={(e) => set({ profession: e.target.value })}>{PROFESSIONS.map((p) => <option key={p}>{p}</option>)}</select></label><Field label="Designation" value={d.designation} required onChange={(designation) => set({ designation })} /><Field label="Years of experience" type="number" value={d.years_experience} onChange={(v) => set({ years_experience: Number(v) || 0 })} /><Field label="LinkedIn URL" type="url" value={d.linkedin_url} onChange={(linkedin_url) => set({ linkedin_url })} /><Field label="Credentials" value={d.credentials} onChange={(credentials) => set({ credentials })} /></div>;
}

export function CompanySection({ d, set }: DraftProps) {
  return <div className="grid gap-4 sm:grid-cols-2"><Field label="Company" value={d.company} required onChange={(company) => set({ company })} /><Field label="Company website" type="url" value={d.company_website} onChange={(company_website) => set({ company_website })} /></div>;
}

export function ExpertiseSection({ d, set }: DraftProps) {
  return <div className="space-y-6"><ListField label="Expertise" values={d.expertise} onChange={(expertise) => set({ expertise })} /><ListField label="Languages" values={d.languages} onChange={(languages) => set({ languages })} options={LANGUAGES} /><ListField label="Categories" values={d.categories} onChange={(categories) => set({ categories })} options={CATEGORIES.map((c) => c.id)} /></div>;
}

export function IntroSection({ d, set }: DraftProps) {
  return <div className="space-y-4"><label className="block space-y-1.5"><Label>Short introduction</Label><Textarea maxLength={240} value={d.short_intro} onChange={(e) => set({ short_intro: e.target.value })} /></label><label className="block space-y-1.5"><Label>About you</Label><Textarea rows={6} value={d.bio} onChange={(e) => set({ bio: e.target.value })} /></label></div>;
}

export function PricingSection({ d, set }: DraftProps) {
  return <div className="grid gap-4 sm:grid-cols-3">{([15, 30, 60] as const).map((minutes) => <Field key={minutes} label={`${minutes}-minute session price (INR)`} type="number" value={d[`price_${minutes}`]} onChange={(v) => set({ [`price_${minutes}`]: Number(v) || 0 })} />)}</div>;
}

export function AvailabilityEditor({ d, set }: DraftProps) {
  const change = (day: string, start: string, end: string, enabled: boolean) => {
    const weekly_availability: WeeklyAvailability = { ...d.weekly_availability };
    weekly_availability[day] = enabled ? [{ start, end }] : [];
    set({ weekly_availability });
  };
  return <section className="space-y-3"><h3 className="font-semibold">Weekly availability (IST)</h3>{DAYS.map(({ key, label }) => { const window = d.weekly_availability[key]?.[0]; return <div key={key} className="grid grid-cols-[auto_1fr_1fr] items-center gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!window} onChange={(e) => change(key, window?.start ?? "09:00", window?.end ?? "17:00", e.target.checked)} />{label}</label><Input type="time" disabled={!window} value={window?.start ?? "09:00"} onChange={(e) => change(key, e.target.value, window?.end ?? "17:00", true)} /><Input type="time" disabled={!window} value={window?.end ?? "17:00"} onChange={(e) => change(key, window?.start ?? "09:00", e.target.value, true)} /></div>; })}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.available_now} onChange={(e) => set({ available_now: e.target.checked })} />Available now</label></section>;
}

export function DocumentsSection({ me }: { me: ExpertMe }) {
  const qc = useQueryClient();
  const upload = useMutation({ mutationFn: (body: DocumentUploadIn) => apiPost<ExpertMe>("/expert/documents", body), onSuccess: (updated) => { qc.setQueryData(["expert-me"], updated); toast.success("Document uploaded"); }, onError: (e) => toast.error(errMsg(e)) });
  const selectFile = async (doc_type: DocumentUploadIn["doc_type"], file?: File) => { if (!file) return; upload.mutate({ doc_type, filename: file.name, mime: file.type || "application/octet-stream", data_base64: await fileToBase64(file) }); };
  return <div className="space-y-4">{(["identity", "employment", "certificate"] as const).map((type) => <label key={type} className="block space-y-2 rounded-xl border p-4"><span className="block font-medium capitalize">{type === "certificate" ? "Credentials" : type} documents</span><Input type="file" accept="image/*,.pdf" disabled={upload.isPending} onChange={(e) => void selectFile(type, e.target.files?.[0])} />{me.documents.filter((doc) => doc.doc_type === type).map((doc) => <span key={doc.id} className="block text-xs text-slate-500">Uploaded: {doc.filename}</span>)}</label>)}</div>;
}

export function PhotoSection({ me }: { me: ExpertMe }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const upload = async (file?: File) => { if (!file) return; setBusy(true); try { const data_base64 = await fileToBase64(file); const updated = await apiPost<ExpertMe>("/expert/photo", { filename: file.name, mime: file.type || "application/octet-stream", data_base64 }); qc.setQueryData(["expert-me"], updated); toast.success("Photo uploaded"); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } };
  return <label className="block space-y-2"><Label>Profile photo</Label>{me.photo_url && <img src={me.photo_url} alt="Current profile" className="size-20 rounded-full object-cover" />}<Input type="file" accept="image/*" disabled={busy} onChange={(e) => void upload(e.target.files?.[0])} /></label>;
}

export const VALIDATORS: Record<string, (draft: Draft, me: ExpertMe) => string | undefined> = {
  professional: (d) => !d.full_name.trim() || !d.profession || !d.designation.trim() ? "Complete the required professional details." : d.years_experience < 0 ? "Experience cannot be negative." : undefined,
  company: (d) => !d.company.trim() ? "Enter your company or organization." : undefined,
  documents: (_d, me) => !me.documents.some((doc) => doc.doc_type === "identity") ? "Upload an identity document to continue." : undefined,
  expertise: (d) => !d.expertise.length || !d.languages.length || !d.categories.length ? "Add expertise, a language, and at least one category." : undefined,
  intro: (d) => !d.short_intro.trim() || !d.bio.trim() ? "Add a short introduction and a bio." : undefined,
  pricing: (d) => [d.price_15, d.price_30, d.price_60].some((price) => price <= 0) ? "Set a price greater than zero for each session length." : undefined,
};
