import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-sky-100 text-sky-800 ring-sky-200",
  "bg-emerald-100 text-emerald-800 ring-emerald-200",
  "bg-amber-100 text-amber-800 ring-amber-200",
  "bg-violet-100 text-violet-800 ring-violet-200",
  "bg-rose-100 text-rose-800 ring-rose-200",
  "bg-indigo-100 text-indigo-800 ring-indigo-200",
];
const SIZES = { sm: "size-7 text-[11px]", md: "size-14 text-lg", lg: "size-24 text-3xl" };

export function InitialsAvatar({ name, photoUrl, size = "md", className }: { name: string; photoUrl?: string | null; size?: keyof typeof SIZES; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const base = cn("shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-white", SIZES[size], className);
  if (photoUrl) return <img src={photoUrl} alt={name} className={cn(base, "object-cover ring-slate-200")} data-testid="expert-photo" />;
  return (
    <span className={cn(base, "grid place-items-center font-heading font-bold", PALETTE[hash % PALETTE.length])} aria-label={name} data-testid="initials-avatar">
      {initials || "?"}
    </span>
  );
}
