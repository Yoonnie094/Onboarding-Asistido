import { formatDuration, formatNumber, formatPercent } from "@/features/dashboard/format";

export type BarDatum = { id: string; label: string; value: number; secondary?: number; note?: string };

/** Barras horizontales simples (divs). `max` define el 100% del ancho. */
export function HorizontalBars({
  data,
  max,
  color = "bg-forest",
  secondaryColor = "bg-forest-dark",
  valueLabel,
  emptyLabel = "Sin datos todavía.",
}: {
  data: BarDatum[];
  max?: number;
  color?: string;
  secondaryColor?: string;
  valueLabel?: (d: BarDatum) => string;
  emptyLabel?: string;
}) {
  const top = max ?? Math.max(0, ...data.map((d) => d.value));
  if (data.length === 0 || top <= 0) return <p className="text-sm text-muted">{emptyLabel}</p>;
  return (
    <ul className="space-y-3">
      {data.map((d) => {
        const pct = Math.min(100, (100 * d.value) / top);
        const secondaryPct = d.secondary !== undefined ? Math.min(100, (100 * d.secondary) / top) : null;
        return (
          <li key={d.id}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold">{d.label}</span>
              <span className="shrink-0 text-xs text-muted">{valueLabel ? valueLabel(d) : formatNumber(d.value)}</span>
            </div>
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-mist">
              <div className={`absolute inset-y-0 left-0 rounded-full ${color}`} style={{ width: `${pct}%` }} />
              {secondaryPct !== null ? (
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${secondaryColor}`}
                  style={{ width: `${secondaryPct}%` }}
                />
              ) : null}
            </div>
            {d.note ? <p className="mt-0.5 text-xs text-muted">{d.note}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Regla de tiempo: promedio y mediana sobre una escala, con la meta marcada. */
export function DurationGauge({
  avg,
  median,
  goalSeconds,
}: {
  avg: number | null;
  median: number | null;
  goalSeconds: number;
}) {
  const scale = Math.max(goalSeconds * 2, (avg ?? 0) * 1.15, (median ?? 0) * 1.15);
  const pos = (v: number) => `${Math.min(100, (100 * v) / scale)}%`;
  const ticks = [0, goalSeconds / 2, goalSeconds, (goalSeconds * 3) / 2, goalSeconds * 2].filter((t) => t <= scale);

  return (
    <div>
      <div className="relative mt-8 mb-2 h-4 w-full rounded-full bg-linear-to-r from-emerald-100 via-emerald-50 to-rose-100">
        <div className="absolute inset-y-0 left-0 rounded-l-full bg-forest/15" style={{ width: pos(goalSeconds) }} />
        <div className="absolute -top-1 -bottom-1 w-0.5 bg-foreground" style={{ left: pos(goalSeconds) }} />
        <span
          className="absolute -top-7 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] font-bold text-white"
          style={{ left: pos(goalSeconds) }}
        >
          Meta {formatDuration(goalSeconds)}
        </span>
        {median !== null ? (
          <span
            className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-sky-600 shadow"
            style={{ left: pos(median) }}
            title={`Mediana ${formatDuration(median)}`}
          />
        ) : null}
        {avg !== null ? (
          <span
            className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-sm border-2 border-white bg-forest shadow"
            style={{ left: pos(avg) }}
            title={`Promedio ${formatDuration(avg)}`}
          />
        ) : null}
      </div>
      <div className="relative h-4 text-[10px] text-muted">
        {ticks.map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: pos(t) }}>
            {t === 0 ? "0" : `${Math.round(t / 60)} min`}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-3 rotate-45 rounded-sm bg-forest" /> Promedio: <strong>{formatDuration(avg)}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-3 rounded-full bg-sky-600" /> Mediana: <strong>{formatDuration(median)}</strong>
        </span>
      </div>
    </div>
  );
}

export function Stars({ value, size = "text-2xl" }: { value: number | null; size?: string }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span
      aria-label={value === null ? "Sin calificaciones" : `${formatNumber(value, 1)} de 5 estrellas`}
      className={`relative inline-block leading-none tracking-wider ${size}`}
      role="img"
    >
      <span aria-hidden="true" className="text-border">
        ★★★★★
      </span>
      <span aria-hidden="true" className="absolute inset-0 overflow-hidden text-amber-400" style={{ width: `${pct}%` }}>
        ★★★★★
      </span>
    </span>
  );
}

/** Anillo de porcentaje en SVG. */
export function Ring({ pct, label }: { pct: number | null; label?: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const v = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <svg aria-label={label ?? formatPercent(pct)} className="h-24 w-24 shrink-0" role="img" viewBox="0 0 80 80">
      <circle className="stroke-mist" cx="40" cy="40" fill="none" r={r} strokeWidth="9" />
      <circle
        className="stroke-forest"
        cx="40"
        cy="40"
        fill="none"
        r={r}
        strokeDasharray={`${(v / 100) * c} ${c}`}
        strokeLinecap="round"
        strokeWidth="9"
        transform="rotate(-90 40 40)"
      />
      <text className="fill-foreground font-bold" dominantBaseline="central" fontSize="16" textAnchor="middle" x="40" y="40">
        {pct === null ? "—" : `${Math.round(v)}%`}
      </text>
    </svg>
  );
}
