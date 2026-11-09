// Madurez digital (encuesta diagnóstica) y microencuestas en hitos clave: piezas del panel.

import {
  DIAGNOSTIC_QUESTIONS,
  MATURITY_LEVELS,
  MICRO_SURVEYS,
  MILESTONE_LABELS,
  type DiagnosticResult,
  type MaturityLevel,
} from "@/lib/onboarding/diagnostic";
import { formatDate, formatNumber, formatPercent } from "@/features/dashboard/format";
import { Stars } from "@/features/dashboard/metrics-charts";
import { Card, SectionHeading } from "@/features/dashboard/ui";

/** Mismos cortes que scoreDiagnostic: < 40 inicial, < 70 en desarrollo, resto avanzado. */
export function levelForScore(score: number): MaturityLevel {
  return score < 40 ? "inicial" : score < 70 ? "en_desarrollo" : "avanzado";
}

function levelInfo(level: string) {
  return MATURITY_LEVELS[(level in MATURITY_LEVELS ? level : "inicial") as MaturityLevel];
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));
const LEVEL_ORDER: MaturityLevel[] = ["inicial", "en_desarrollo", "avanzado"];

/* ------------------------------------------------------------------ */
/* Medidor semicircular 0-100                                          */
/* ------------------------------------------------------------------ */

export function MaturityGauge({ score, level, size = "lg" }: { score: number | null; level: string; size?: "lg" | "sm" }) {
  const info = levelInfo(level);
  const v = score === null ? 0 : clamp(score);
  const arc = "M 12 62 A 50 50 0 0 1 112 62";
  // Zonas de nivel tenues bajo el arco (0-40, 40-70, 70-100).
  const zones: { level: MaturityLevel; from: number; to: number }[] = [
    { level: "inicial", from: 0, to: 40 },
    { level: "en_desarrollo", from: 40, to: 70 },
    { level: "avanzado", from: 70, to: 100 },
  ];
  const tick = (t: number) => {
    const a = Math.PI * (1 - t / 100);
    return { x1: 62 + 43 * Math.cos(a), y1: 62 - 43 * Math.sin(a), x2: 62 + 57 * Math.cos(a), y2: 62 - 57 * Math.sin(a) };
  };

  return (
    <svg
      aria-label={score === null ? "Sin diagnóstico" : `Madurez digital ${Math.round(v)} de 100, nivel ${info.label}`}
      className={size === "lg" ? "h-auto w-full max-w-64" : "h-auto w-full max-w-44"}
      role="img"
      viewBox="0 0 124 76"
    >
      {zones.map((z) => (
        <path
          d={arc}
          fill="none"
          key={z.level}
          pathLength={100}
          stroke={MATURITY_LEVELS[z.level].color}
          strokeDasharray={`${z.to - z.from} 200`}
          strokeDashoffset={-z.from}
          strokeOpacity={0.16}
          strokeWidth={12}
        />
      ))}
      {score !== null && v > 0 ? (
        <path
          d={arc}
          fill="none"
          pathLength={100}
          stroke={info.color}
          strokeDasharray={`${v} 200`}
          strokeLinecap="round"
          strokeWidth={12}
        />
      ) : null}
      {[40, 70].map((t) => (
        <line key={t} stroke="#ffffff" strokeWidth={1.5} {...tick(t)} />
      ))}
      <text className="fill-foreground font-serif font-bold" fontSize="26" textAnchor="middle" x="62" y="58">
        {score === null ? "—" : Math.round(v)}
      </text>
      <text className="fill-muted" fontSize="7" textAnchor="middle" x="62" y="70">
        de 100
      </text>
      <text className="fill-muted" fontSize="6" textAnchor="middle" x="12" y="73">
        0
      </text>
      <text className="fill-muted" fontSize="6" textAnchor="middle" x="112" y="73">
        100
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Barras por dimensión                                                */
/* ------------------------------------------------------------------ */

type DimensionRow = { id: string; label: string; value: number | null; note?: string; highlight?: boolean };

function DimensionBars({ rows }: { rows: DimensionRow[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const color = row.value === null ? undefined : MATURITY_LEVELS[levelForScore(row.value)].color;
        return (
          <li
            className={row.highlight ? "-mx-3 rounded-xl border border-cherry/30 bg-cherry/5 px-3 py-2" : undefined}
            key={row.id}
          >
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold">
                {row.label}
                {row.highlight ? (
                  <span className="ml-2 rounded-full bg-cherry px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Brecha principal del segmento
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-xs font-semibold text-muted">
                {row.value === null ? "Sin respuesta" : `${Math.round(row.value)} / 100`}
              </span>
            </div>
            <div
              aria-label={`${row.label}: ${row.value === null ? "sin respuesta" : `${Math.round(row.value)} de 100`}`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={row.value === null ? undefined : Math.round(row.value)}
              className="h-2.5 w-full overflow-hidden rounded-full bg-mist"
              role="progressbar"
            >
              {row.value !== null ? (
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(3, clamp(row.value))}%`, backgroundColor: color }}
                />
              ) : null}
            </div>
            {row.note ? <p className="mt-0.5 text-xs text-muted">{row.note}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

function LevelPill({ level, score }: { level: string; score?: number | null }) {
  const info = levelInfo(level);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold"
      style={{ borderColor: `${info.color}55`, backgroundColor: `${info.color}14`, color: info.color }}
    >
      <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: info.color }} />
      {info.label}
      {score !== undefined && score !== null ? <span className="font-semibold opacity-80">· {Math.round(score)}</span> : null}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Tarjeta del fundo                                                   */
/* ------------------------------------------------------------------ */

export function MaturityCard({ diagnostic }: { diagnostic: DiagnosticResult | null }) {
  if (!diagnostic) {
    return (
      <section
        aria-labelledby="maturity-title"
        className="rounded-2xl border border-dashed border-border bg-card p-5 shadow-sm sm:p-6"
      >
        <SectionHeading eyebrow="Diagnóstico" id="maturity-title" title="Madurez digital" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-mist text-2xl text-forest"
          >
            ◔
          </div>
          <p className="max-w-2xl text-sm leading-6 text-muted">
            Este fundo todavía no tiene diagnóstico de madurez digital. Se responde en el último paso de la
            configuración (<strong className="text-foreground">Diagnóstico</strong>): son 6 preguntas rápidas sobre
            cómo registran, comparten y usan sus datos. Con eso calculamos un puntaje de 0 a 100 y las prioridades para
            acompañarte.
          </p>
        </div>
      </section>
    );
  }

  const info = levelInfo(diagnostic.level);
  const rows: DimensionRow[] = DIAGNOSTIC_QUESTIONS.map((q) => {
    const raw = diagnostic.dimensions?.[q.id];
    const value = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
    const answer = diagnostic.answers?.[q.id];
    const option = q.options.find((o) => o.value === answer);
    return { id: q.id, label: q.dimension, value, note: option ? `Hoy: ${option.label}` : undefined };
  });
  const advice = Array.isArray(diagnostic.advice) ? diagnostic.advice.filter((a) => typeof a === "string") : [];

  return (
    <section
      aria-labelledby="maturity-title"
      className="overflow-hidden rounded-2xl border bg-card shadow-sm"
      style={{ borderColor: `${info.color}55` }}
    >
      <div className="h-1.5 w-full" style={{ backgroundColor: info.color }} />
      <div className="p-5 sm:p-6">
        <SectionHeading
          action={
            diagnostic.completedAt ? (
              <span className="text-xs text-muted">Respondido el {formatDate(diagnostic.completedAt)}</span>
            ) : undefined
          }
          description="Resultado de la encuesta diagnóstica del onboarding. Nos dice desde dónde parte tu equipo para adaptar el acompañamiento."
          eyebrow="Diagnóstico"
          id="maturity-title"
          title="Madurez digital"
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,1fr)]">
          {/* Medidor y nivel */}
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <MaturityGauge level={diagnostic.level} score={diagnostic.score} />
            <div className="mt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Nivel</p>
              <p className="font-serif text-2xl font-bold" style={{ color: info.color }}>
                {info.label}
              </p>
              <p className="mt-1 text-sm leading-6 text-foreground/80">{info.description}</p>
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5 lg:justify-start">
              {LEVEL_ORDER.map((l) => (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    l === diagnostic.level ? "text-white" : "bg-mist text-muted"
                  }`}
                  key={l}
                  style={l === diagnostic.level ? { backgroundColor: MATURITY_LEVELS[l].color } : undefined}
                >
                  {MATURITY_LEVELS[l].label}
                </span>
              ))}
            </div>
          </div>

          {/* Dimensiones */}
          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Por dimensión</h3>
            <DimensionBars rows={rows} />
          </div>

          {/* Prioridades */}
          <div className="rounded-xl bg-mist/60 p-4">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Prioridades</h3>
            {advice.length === 0 ? (
              <p className="text-sm leading-6 text-forest">
                Ninguna dimensión quedó baja. Tu equipo está listo para alertas y modelos predictivos.
              </p>
            ) : (
              <ol className="space-y-3">
                {advice.map((item, i) => (
                  <li className="flex gap-3" key={item}>
                    <span
                      aria-hidden="true"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: info.color }}
                    >
                      {i + 1}
                    </span>
                    <p className="text-sm leading-6">{item}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Badge para la lista de fundos                                       */
/* ------------------------------------------------------------------ */

export function MaturityBadge({ diagnostic }: { diagnostic: DiagnosticResult }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted" title={levelInfo(diagnostic.level).description}>
      Madurez digital: <LevelPill level={diagnostic.level} score={diagnostic.score} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Métricas agregadas                                                  */
/* ------------------------------------------------------------------ */

function Measures({ children }: { children: string }) {
  return (
    <p className="mt-5 border-t border-border pt-3 text-xs leading-5 text-muted">
      <span className="font-semibold text-foreground/70">Qué mide:</span> {children}
    </p>
  );
}

export function MaturityMetricsSection({
  count,
  avgScore,
  levels,
  byDimension,
}: {
  count: number;
  avgScore: number | null;
  levels: Record<string, number>;
  byDimension: Record<string, number>;
}) {
  const avgLevel = avgScore !== null ? levelForScore(avgScore) : "inicial";
  const levelTotal = LEVEL_ORDER.reduce((sum, l) => sum + (levels[l] ?? 0), 0);

  const dimRows: DimensionRow[] = DIAGNOSTIC_QUESTIONS.map((q) => ({
    id: q.id,
    label: q.dimension,
    value: typeof byDimension[q.id] === "number" ? byDimension[q.id] : null,
  }));
  const answered = dimRows.filter((r): r is DimensionRow & { value: number } => r.value !== null);
  const weakest = answered.length > 1 ? answered.reduce((a, b) => (b.value < a.value ? b : a)) : null;
  for (const row of dimRows) row.highlight = weakest !== null && row.id === weakest.id;

  return (
    <section aria-labelledby="maturity-metrics-title">
      <Card>
        <SectionHeading
          description="Resultado agregado de la encuesta diagnóstica que se responde al final del onboarding (6 preguntas, escala de 1 a 4)."
          eyebrow="Segmentación de clientes"
          id="maturity-metrics-title"
          title="Diagnóstico de madurez digital"
        />
        {count === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
            Todavía nadie ha respondido la encuesta diagnóstica. Aparece en el último paso del asistente.
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.3fr)]">
            {/* Promedio */}
            <div className="flex flex-col items-center text-center">
              <MaturityGauge level={avgLevel} score={avgScore} />
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">Puntaje promedio</p>
              <p className="mt-1">
                <LevelPill level={avgLevel} />
              </p>
              <p className="mt-3 text-sm text-muted">
                <strong className="font-serif text-2xl text-foreground">{formatNumber(count)}</strong> diagnóstico
                {count === 1 ? "" : "s"} respondido{count === 1 ? "" : "s"}
              </p>
            </div>

            {/* Distribución por nivel */}
            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Distribución por nivel</h3>
              {levelTotal > 0 ? (
                <div aria-hidden="true" className="mb-4 flex h-3 w-full overflow-hidden rounded-full bg-mist">
                  {LEVEL_ORDER.map((l) =>
                    (levels[l] ?? 0) > 0 ? (
                      <div
                        key={l}
                        style={{ width: `${(100 * (levels[l] ?? 0)) / levelTotal}%`, backgroundColor: MATURITY_LEVELS[l].color }}
                      />
                    ) : null,
                  )}
                </div>
              ) : null}
              <ul className="space-y-3">
                {LEVEL_ORDER.map((l) => {
                  const n = levels[l] ?? 0;
                  const pct = levelTotal > 0 ? (100 * n) / levelTotal : 0;
                  return (
                    <li key={l}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 font-semibold">
                          <span
                            aria-hidden="true"
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: MATURITY_LEVELS[l].color }}
                          />
                          {MATURITY_LEVELS[l].label}
                        </span>
                        <span className="shrink-0 text-xs text-muted">
                          {formatNumber(n)} · {formatPercent(pct)}
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-mist">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: MATURITY_LEVELS[l].color }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Por dimensión */}
            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Promedio por dimensión</h3>
              <DimensionBars rows={dimRows} />
              {weakest ? (
                <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
                  <strong>Brecha principal:</strong> “{weakest.label}” ({Math.round(weakest.value)} / 100). Es donde más
                  conviene reforzar el acompañamiento a este segmento.
                </p>
              ) : null}
            </div>
          </div>
        )}
        <Measures>
          la madurez digital de cada cliente al entrar. Permite segmentarlos y adaptar el acompañamiento: un cliente
          “Inicial” necesita digitalizar su registro; uno “Avanzado” está listo para alertas y predicción.
        </Measures>
      </Card>
    </section>
  );
}

export function MicroSurveysSection({
  data,
}: {
  data: Record<string, { avgRating: number | null; count: number }>;
}) {
  const ids = [...new Set([...Object.keys(MICRO_SURVEYS), ...Object.keys(data)])];
  const total = ids.reduce((sum, id) => sum + (data[id]?.count ?? 0), 0);

  return (
    <section aria-labelledby="micro-title">
      <Card>
        <SectionHeading
          description="Preguntas de 1 a 5 estrellas que aparecen en el momento justo, al cumplir un hito del asistente."
          eyebrow="Feedback en contexto"
          id="micro-title"
          title="Microencuestas en hitos clave"
        />
        {total === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
            Aún no hay respuestas. Las microencuestas aparecen al configurar los cuarteles y al asignar al equipo.
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {ids.map((id) => {
              const entry = data[id] ?? { avgRating: null, count: 0 };
              const question = id in MICRO_SURVEYS ? MICRO_SURVEYS[id as keyof typeof MICRO_SURVEYS].question : null;
              const low = entry.avgRating !== null && entry.avgRating < 3.5;
              return (
                <li className="flex flex-col rounded-xl border border-border p-4" key={id}>
                  <p className="text-xs font-bold uppercase tracking-wide text-forest">{MILESTONE_LABELS[id] ?? id}</p>
                  {question ? <p className="mt-1 text-sm text-foreground/80">“{question}”</p> : null}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Stars value={entry.avgRating} />
                    <span className={`font-serif text-2xl font-bold ${low ? "text-cherry" : ""}`}>
                      {entry.avgRating !== null ? `${formatNumber(entry.avgRating, 1)} / 5` : "—"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {formatNumber(entry.count)} respuesta{entry.count === 1 ? "" : "s"}
                    {low ? " · fricción detectada en este hito" : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        <Measures>
          qué tan fácil fue cada hito justo después de vivirlo. Detecta fricción en tiempo real, en el paso exacto
          donde ocurre, y no al final de la temporada cuando ya es tarde para corregir.
        </Measures>
      </Card>
    </section>
  );
}
