import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OnboardingMetrics } from "@/lib/database.types";
import { ONBOARDING_STEPS } from "@/lib/onboarding/types";
import { AppHeader } from "@/features/dashboard/app-header";
import { formatDuration, formatNumber, formatPercent, toNumber } from "@/features/dashboard/format";
import { DurationGauge, HorizontalBars, Ring, Stars, type BarDatum } from "@/features/dashboard/metrics-charts";
import { MaturityMetricsSection, MicroSurveysSection } from "@/features/dashboard/maturity";
import { Card, EmptyState, QualityBar, SectionHeading, linkButtonClasses } from "@/features/dashboard/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Métricas de onboarding" };

const GOAL_SECONDS = 600;

function asRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value)) {
    const n = toNumber(v);
    if (n !== null) out[k] = n;
  }
  return out;
}

function asMicroSurveys(value: unknown): OnboardingMetrics["microSurveys"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: OnboardingMetrics["microSurveys"] = {};
  for (const [k, v] of Object.entries(value)) {
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const entry = v as Record<string, unknown>;
    out[k] = { avgRating: toNumber(entry.avgRating), count: toNumber(entry.count) ?? 0 };
  }
  return out;
}

function normalizeMetrics(value: unknown): OnboardingMetrics {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const n = (k: string) => toNumber(raw[k]) ?? 0;
  const nn = (k: string) => toNumber(raw[k]);
  return {
    sessionsStarted: n("sessionsStarted"),
    sessionsCompleted: n("sessionsCompleted"),
    sessionsInProgress: n("sessionsInProgress"),
    avgDurationSeconds: nn("avgDurationSeconds"),
    medianDurationSeconds: nn("medianDurationSeconds"),
    under10MinRate: nn("under10MinRate"),
    avgRating: nn("avgRating"),
    ratingsCount: n("ratingsCount"),
    avgQualityScore: nn("avgQualityScore"),
    farms: n("farms"),
    blocks: n("blocks"),
    invitations: n("invitations"),
    invitationsAccepted: n("invitationsAccepted"),
    stepFunnel: asRecord(raw.stepFunnel),
    stepCompleted: asRecord(raw.stepCompleted),
    stepSkips: asRecord(raw.stepSkips),
    abandonedByStep: asRecord(raw.abandonedByStep),
    // Campos del diagnóstico: pueden faltar si la base aún tiene la versión anterior de la función.
    diagnosticsCount: n("diagnosticsCount"),
    avgMaturityScore: nn("avgMaturityScore"),
    maturityLevels: asRecord(raw.maturityLevels),
    maturityByDimension: asRecord(raw.maturityByDimension),
    microSurveys: asMicroSurveys(raw.microSurveys),
  };
}

function Metric({
  label,
  value,
  measures,
  children,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  measures: string;
  children?: ReactNode;
  tone?: "default" | "good" | "bad";
}) {
  const valueTone = tone === "good" ? "text-forest" : tone === "bad" ? "text-cherry" : "";
  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className={`mt-2 font-serif text-3xl font-bold tracking-tight ${valueTone}`}>{value}</div>
      {children ? <div className="mt-2">{children}</div> : null}
      <p className="mt-auto pt-3 text-xs leading-5 text-muted">
        <span className="font-semibold text-foreground/70">Qué mide:</span> {measures}
      </p>
    </div>
  );
}

export default async function MetricsPage() {
  const user = await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("onboarding_metrics");
  const m = normalizeMetrics(data);

  const completionRate = m.sessionsStarted > 0 ? (100 * m.sessionsCompleted) / m.sessionsStarted : null;
  const dropOffRate = m.sessionsStarted > 0 ? (100 * m.sessionsInProgress) / m.sessionsStarted : null;
  const activationRate = m.invitations > 0 ? (100 * m.invitationsAccepted) / m.invitations : null;
  const avgOk = m.avgDurationSeconds !== null ? m.avgDurationSeconds <= GOAL_SECONDS : null;

  const firstStepCount = m.stepFunnel[ONBOARDING_STEPS[0].id] ?? 0;
  const funnelBase = firstStepCount || Math.max(0, ...Object.values(m.stepFunnel));
  const funnel: BarDatum[] = ONBOARDING_STEPS.map((s, i) => {
    const reached = m.stepFunnel[s.id] ?? 0;
    const done = m.stepCompleted[s.id] ?? 0;
    return {
      id: s.id,
      label: `${i + 1}. ${s.label}`,
      value: reached,
      secondary: done,
      note: s.id === "listo" ? undefined : `${formatNumber(done)} lo completaron`,
    };
  });

  const skips: BarDatum[] = ONBOARDING_STEPS.map((s) => ({ id: s.id, label: s.label, value: m.stepSkips[s.id] ?? 0 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const abandoned: BarDatum[] = ONBOARDING_STEPS.map((s) => ({
    id: s.id,
    label: s.label,
    value: m.abandonedByStep[s.id] ?? 0,
  })).filter((d) => d.value > 0);

  const biggestDrop = (() => {
    let best: { from: string; to: string; lost: number } | null = null;
    for (let i = 1; i < funnel.length; i++) {
      const lost = funnel[i - 1].value - funnel[i].value;
      if (lost > 0 && (!best || lost > best.lost)) {
        best = { from: ONBOARDING_STEPS[i - 1].label, to: ONBOARDING_STEPS[i].label, lost };
      }
    }
    return best;
  })();

  return (
    <main className="min-h-screen">
      <AppHeader active="metricas" email={user.email} />

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-8 sm:py-12">
        <div className="border-b border-border pb-7">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-forest">Medición del onboarding</p>
          <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">Métricas de onboarding</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
            Indicadores agregados de <strong>todos</strong> los onboardings de la plataforma, sin datos personales. La
            métrica principal es el <strong>Time to First Value</strong>: cuánto tarda alguien nuevo desde que abre el
            asistente hasta ver su fundo con su primer insight. La meta es menos de 10 minutos.
          </p>
        </div>

        {error ? (
          <Card>
            <p className="text-sm text-cherry">
              No pudimos calcular las métricas. Verifica que la migración del onboarding esté aplicada en la base de
              datos.
            </p>
          </Card>
        ) : m.sessionsStarted === 0 ? (
          <EmptyState
            action={
              <Link className={linkButtonClasses.primary} href="/onboarding?nuevo=1">
                Iniciar un onboarding
              </Link>
            }
            description="Todavía nadie ha iniciado el asistente. Cuando alguien lo haga, aquí verás el embudo, los tiempos y la satisfacción."
            icon="▤"
            title="Aún no hay datos de onboarding"
          />
        ) : (
          <>
            {/* Time to First Value */}
            <section aria-labelledby="ttfv-title">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <Card>
                  <SectionHeading
                    description="Duración desde que se abre el asistente hasta que se crea el fundo y aparece el panel."
                    eyebrow="La métrica reina"
                    id="ttfv-title"
                    title="Time to First Value"
                  />
                  <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Promedio</p>
                      <p className={`font-serif text-4xl font-bold ${avgOk === false ? "text-cherry" : "text-forest"}`}>
                        {formatDuration(m.avgDurationSeconds)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Mediana</p>
                      <p className="font-serif text-4xl font-bold">{formatDuration(m.medianDurationSeconds)}</p>
                    </div>
                    <p className="pb-1.5 text-sm text-muted">
                      {avgOk === null
                        ? "Sin onboardings completados todavía."
                        : avgOk
                          ? "Bajo la meta de 10 minutos."
                          : "Sobre la meta de 10 minutos."}
                    </p>
                  </div>
                  <DurationGauge avg={m.avgDurationSeconds} goalSeconds={GOAL_SECONDS} median={m.medianDurationSeconds} />
                </Card>
                <Card>
                  <div className="flex items-center gap-5">
                    <Ring label="Porcentaje de onboardings bajo 10 minutos" pct={m.under10MinRate} />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Bajo 10 minutos</p>
                      <p className="mt-1 text-sm leading-6">
                        De los onboardings completados, el <strong>{formatPercent(m.under10MinRate)}</strong> terminó
                        dentro de la meta.
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 border-t border-border pt-3 text-xs leading-5 text-muted">
                    <span className="font-semibold text-foreground/70">Qué mide:</span> qué tan seguido el asistente
                    cumple la promesa de “tu fundo listo en menos de 10 minutos”.
                  </p>
                </Card>
              </div>
            </section>

            {/* KPIs */}
            <section aria-labelledby="kpis-title">
              <h2 className="mb-4 font-serif text-xl font-bold" id="kpis-title">
                Indicadores clave
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric
                  label="Sesiones iniciadas"
                  measures="cuántas personas abrieron el asistente al menos una vez."
                  value={formatNumber(m.sessionsStarted)}
                >
                  <p className="text-xs text-muted">{formatNumber(m.sessionsInProgress)} siguen en curso</p>
                </Metric>
                <Metric
                  label="Completadas"
                  measures="onboardings que llegaron al final y crearon un fundo."
                  value={formatNumber(m.sessionsCompleted)}
                />
                <Metric
                  label="Tasa de finalización"
                  measures="completadas ÷ iniciadas (Completion Rate). Su complemento es el abandono."
                  tone={completionRate !== null && completionRate >= 70 ? "good" : completionRate !== null && completionRate < 40 ? "bad" : "default"}
                  value={formatPercent(completionRate)}
                >
                  <p className="text-xs text-muted">Abandono o pendientes: {formatPercent(dropOffRate)}</p>
                </Metric>
                <Metric
                  label="Satisfacción"
                  measures="calificación de 1 a 5 que deja el usuario al terminar."
                  value={m.avgRating !== null ? `${formatNumber(m.avgRating, 1)} / 5` : "—"}
                >
                  <Stars value={m.avgRating} />
                  <p className="mt-1 text-xs text-muted">
                    {formatNumber(m.ratingsCount)} respuesta{m.ratingsCount === 1 ? "" : "s"}
                  </p>
                </Metric>
                <Metric
                  label="Calidad de datos promedio"
                  measures="puntaje de validación de las planillas importadas (completitud y validez)."
                  value={m.avgQualityScore !== null ? formatPercent(m.avgQualityScore) : "—"}
                >
                  <QualityBar compact score={m.avgQualityScore} />
                </Metric>
                <Metric
                  label="Fundos creados"
                  measures="fundos que hoy existen en la plataforma gracias al asistente u otras vías."
                  value={formatNumber(m.farms)}
                />
                <Metric
                  label="Cuarteles cargados"
                  measures="cuarteles importados desde mapas y planillas (Time to First Dataset)."
                  value={formatNumber(m.blocks)}
                >
                  <p className="text-xs text-muted">
                    {m.farms > 0 ? `${formatNumber(m.blocks / m.farms, 1)} por fundo en promedio` : ""}
                  </p>
                </Metric>
                <Metric
                  label="Activación del equipo"
                  measures="invitaciones aceptadas ÷ enviadas: cuánto del equipo invitado ya entró a trabajar."
                  tone={activationRate !== null && activationRate >= 50 ? "good" : "default"}
                  value={formatPercent(activationRate)}
                >
                  <p className="text-xs text-muted">
                    {formatNumber(m.invitationsAccepted)} de {formatNumber(m.invitations)} invitaciones aceptadas
                  </p>
                </Metric>
              </div>
            </section>

            {/* Embudo */}
            <section aria-labelledby="funnel-title" className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <Card>
                <SectionHeading
                  description="Sesiones que llegaron a cada paso (barra clara) y que lo completaron (barra oscura). El porcentaje es respecto al primer paso."
                  eyebrow="Step Completion Rate"
                  id="funnel-title"
                  title="Embudo por paso"
                />
                <HorizontalBars
                  data={funnel}
                  max={funnelBase}
                  color="bg-forest/35"
                  secondaryColor="bg-forest"
                  valueLabel={(d) =>
                    `${formatNumber(d.value)} · ${funnelBase > 0 ? formatPercent((100 * d.value) / funnelBase) : "—"}`
                  }
                />
                {biggestDrop ? (
                  <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
                    <strong>Mayor caída:</strong> entre “{biggestDrop.from}” y “{biggestDrop.to}” se pierden{" "}
                    {formatNumber(biggestDrop.lost)} sesión{biggestDrop.lost === 1 ? "" : "es"}. Es el primer lugar
                    donde mejorar el asistente.
                  </p>
                ) : null}
              </Card>

              <div className="space-y-4">
                <Card>
                  <SectionHeading
                    description="Veces que se usó “Completar después” en cada paso."
                    eyebrow="Skip inteligente"
                    title="Pasos más saltados"
                  />
                  <HorizontalBars
                    color="bg-amber-400"
                    data={skips}
                    emptyLabel="Nadie ha saltado pasos todavía."
                  />
                </Card>
                <Card>
                  <SectionHeading
                    description="Sesiones sin terminar, según el paso donde quedaron (Drop-off Rate)."
                    eyebrow="Abandono"
                    title="Dónde quedan a medias"
                  />
                  <HorizontalBars
                    color="bg-cherry/80"
                    data={abandoned}
                    emptyLabel="No hay sesiones a medias."
                  />
                </Card>
              </div>
            </section>

            <div className="grid gap-4">
              <MaturityMetricsSection
                avgScore={m.avgMaturityScore}
                byDimension={m.maturityByDimension}
                count={m.diagnosticsCount}
                levels={m.maturityLevels}
              />
              <MicroSurveysSection data={m.microSurveys} />
            </div>

            <p className="text-xs leading-5 text-muted">
              Fuente: eventos del asistente (vista, completado, salto y reanudación de cada paso, y microencuestas en
              hitos), sesiones de onboarding y encuestas diagnósticas. Las métricas se calculan en la base de datos con la función <code>onboarding_metrics()</code>
              y no exponen nombres ni correos.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
