import type { ReactNode } from "react";
import { qualityTone } from "@/features/dashboard/format";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6 ${className}`}>{children}</section>;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  id,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-forest">{eyebrow}</p> : null}
        <h2 className="font-serif text-xl font-bold tracking-tight" id={id}>
          {title}
        </h2>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex h-full flex-col rounded-2xl border p-4 shadow-sm sm:p-5 ${
        accent ? "border-forest bg-forest text-white" : "border-border bg-card"
      }`}
    >
      <p className={`text-xs font-semibold uppercase tracking-wide ${accent ? "text-white/80" : "text-muted"}`}>{label}</p>
      <p className="mt-2 font-serif text-2xl font-bold tracking-tight sm:text-3xl">{value}</p>
      {hint ? <p className={`mt-2 text-xs leading-5 ${accent ? "text-white/80" : "text-muted"}`}>{hint}</p> : null}
    </div>
  );
}

export function QualityBar({ score, compact = false }: { score: number | null; compact?: boolean }) {
  const tone = qualityTone(score);
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score));
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-muted">Calidad de datos</span>
        <span className={`font-bold ${tone.text}`}>
          {score === null ? tone.label : `${Math.round(pct)}% · ${tone.label}`}
        </span>
      </div>
      <div
        aria-label={score === null ? "Sin planilla cargada" : `Calidad de datos ${Math.round(pct)}%`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={score === null ? undefined : Math.round(pct)}
        className={`mt-1.5 w-full overflow-hidden rounded-full bg-mist ${compact ? "h-1.5" : "h-2.5"}`}
        role="progressbar"
      >
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "forest" | "cherry" | "amber" }) {
  const tones = {
    neutral: "border-border bg-mist text-foreground",
    forest: "border-forest/30 bg-forest/10 text-forest",
    cherry: "border-cherry/30 bg-cherry/10 text-cherry",
    amber: "border-amber-300 bg-amber-50 text-amber-800",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon = "◇",
}: {
  title: string;
  description: ReactNode;
  action?: ReactNode;
  icon?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center sm:px-10">
      <div
        aria-hidden="true"
        className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-mist text-2xl text-forest"
      >
        {icon}
      </div>
      <h2 className="font-serif text-2xl font-bold">{title}</h2>
      <div className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted">{description}</div>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** Clases de un enlace con aspecto de botón (Link no puede usar <Button>). */
export const linkButtonClasses = {
  primary:
    "inline-flex min-h-11 items-center justify-center rounded-xl border border-forest bg-forest px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-forest-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest",
  secondary:
    "inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-white px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest",
} as const;
