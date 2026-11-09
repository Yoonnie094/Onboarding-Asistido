"use client";

import Link from "next/link";
import { useState } from "react";

import type { DiagnosticResult } from "@/lib/onboarding/diagnostic";
import { getRecommendations } from "@/lib/onboarding/recommendations";
import type { StepProps } from "@/lib/onboarding/types";
import { DiagnosticSurvey } from "@/features/onboarding/diagnostic/diagnostic-survey";
import { EaseSurvey } from "@/features/onboarding/team/ease-survey";
import { qualityTone } from "@/features/onboarding/team/final-summary";
import { formatHa, ownerByCode, totalHectares } from "@/features/onboarding/team/team-utils";

const GOAL_SECONDS = 10 * 60;

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const PRIORITY_STYLES = {
  alta: "bg-cherry/10 text-cherry",
  media: "bg-amber-100 text-amber-800",
  baja: "bg-mist text-forest",
} as const;

export type ListoStepProps = StepProps & {
  /** Diagnóstico ya guardado en la sesión (al recargar la pantalla final se muestra el resultado). */
  initialDiagnostic?: DiagnosticResult | null;
};

export function ListoStep({ sessionId, draft, farmId, elapsedSeconds, initialDiagnostic = null }: ListoStepProps) {
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(initialDiagnostic);
  const blocks = draft.blocks;
  const blockCount = blocks.length;
  const blocksWithGeometry = blocks.filter((block) => block.geometry).length;
  const ha = totalHectares(blocks);
  const codes = new Set(blocks.map((block) => block.code));
  const assignedBlockCount = [...ownerByCode(draft.team).keys()].filter((code) => codes.has(code)).length;
  const teamCount = draft.team.length;
  const qualityScore = draft.quality ? Math.round(draft.quality.qualityScore) : null;
  const errorCount = draft.quality?.errorCount ?? 0;
  const tone = qualityTone(qualityScore);
  const underGoal = elapsedSeconds > 0 && elapsedSeconds <= GOAL_SECONDS;
  const completed = new Set(draft.completedSteps);

  const checklist = [
    { label: "Cuenta creada", done: true },
    { label: "Perfil", done: completed.has("perfil") || Boolean(draft.profile.fullName.trim()) },
    { label: "Operación", done: completed.has("operacion") || draft.operation.species.length > 0 },
    { label: "Fundo", done: Boolean(farmId) },
    {
      label: "Cartografía",
      done: blocksWithGeometry > 0,
      hint: blocksWithGeometry > 0 ? `${blocksWithGeometry} polígonos` : "Pendiente",
    },
    {
      label: "Datos de cuarteles",
      done: Boolean(draft.quality) || (Boolean(draft.spreadsheet) && !draft.spreadsheet?.skipped),
      hint: draft.quality ? `${draft.quality.rowCount} filas` : "Pendiente",
    },
    {
      label: "Equipo",
      done: teamCount > 0,
      hint: teamCount > 0 ? `${teamCount} invitado${teamCount === 1 ? "" : "s"}` : "Pendiente",
    },
    {
      label: "Diagnóstico de madurez digital",
      done: Boolean(diagnostic),
      hint: diagnostic ? `${Math.round(diagnostic.score)}/100` : "Pendiente",
    },
  ];
  const donePercent = Math.round((checklist.filter((item) => item.done).length / checklist.length) * 100);

  const recommendations = getRecommendations({
    userRole: draft.profile.userRole || null,
    operation: draft.operation,
    blockCount,
    blocksWithGeometry,
    qualityScore,
    errorCount,
    teamCount,
    assignedBlockCount,
  }).slice(0, 3);

  const stats = [
    {
      label: "Tiempo",
      value: formatClock(elapsedSeconds),
      detail: underGoal ? "¡Bajo la meta de 10:00!" : `Meta ${formatClock(GOAL_SECONDS)}`,
      highlight: underGoal,
      valueClass: underGoal ? "text-forest" : undefined,
    },
    {
      label: "Cuarteles",
      value: String(blockCount),
      detail: blockCount ? `${formatHa(ha)} ha` : "Cárgalos en el panel",
    },
    {
      label: "Calidad",
      value: qualityScore === null ? "—" : `${qualityScore}%`,
      detail: tone.label,
      valueClass: tone.className,
    },
    {
      label: "Invitados",
      value: String(teamCount),
      detail: teamCount ? `${assignedBlockCount} cuarteles asignados` : "Invita después",
    },
  ];

  return (
    <div className="grid gap-6">
      <section
        aria-labelledby="listo-title"
        className="rounded-2xl border border-forest/20 bg-mist/50 p-4 sm:p-5"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-forest text-xl text-white shadow-sm"
            >
              ✓
            </span>
            <div className="min-w-0">
              <h1 className="font-serif text-2xl font-semibold leading-tight" id="listo-title">
                🎉 Tu fundo está listo
              </h1>
              <p className="text-sm text-muted">
                {draft.farm.name.trim() ? (
                  <strong className="text-foreground">{draft.farm.name.trim()}</strong>
                ) : (
                  "Tu fundo"
                )}{" "}
                ya está en CER Analytics
                {teamCount > 0 ? " y tu equipo verá sus cuarteles apenas se registre." : "."}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4 lg:shrink-0">
            {stats.map((stat) => (
              <div className="min-w-0" key={stat.label}>
                <dt className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted">{stat.label}</dt>
                <dd className={`text-xl font-semibold tabular-nums leading-tight ${stat.valueClass ?? ""}`}>
                  {stat.value}
                </dd>
                <dd className={`truncate text-[11px] ${stat.highlight ? "font-semibold text-forest" : "text-muted"}`}>
                  {stat.detail}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <DiagnosticSurvey initialResult={initialDiagnostic} onResult={setDiagnostic} sessionId={sessionId} />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="checklist-title">
          <div className="flex items-baseline justify-between">
            <h3 className="text-base font-semibold" id="checklist-title">
              Configuración
            </h3>
            <span className="text-sm font-semibold text-forest">{donePercent}% completo</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-mist">
            <div className="h-full rounded-full bg-forest" style={{ width: `${donePercent}%` }} />
          </div>
          <ul className="mt-4 grid gap-2">
            {checklist.map((item) => (
              <li className="flex items-center gap-3 text-sm" key={item.label}>
                <span
                  aria-hidden
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    item.done ? "bg-forest text-white" : "border-2 border-border text-muted"
                  }`}
                >
                  {item.done ? "✓" : ""}
                </span>
                <span className={item.done ? "" : "text-muted"}>{item.label}</span>
                {item.hint ? <span className="ml-auto text-xs text-muted">{item.hint}</span> : null}
                <span className="sr-only">{item.done ? "completado" : "pendiente"}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="recs-title">
          <h3 className="text-base font-semibold" id="recs-title">
            Primer objetivo recomendado
          </h3>
          <p className="text-sm text-muted">Según lo que nos contaste y los datos que cargaste.</p>
          {recommendations.length === 0 ? (
            <p className="mt-4 rounded-xl bg-mist p-4 text-sm">
              Tu fundo quedó completo. Explora el panel para ver tus cuarteles en el mapa.
            </p>
          ) : (
            <ol className="mt-4 grid gap-3">
              {recommendations.map((rec, index) => (
                <li
                  className={`flex gap-3 rounded-xl border p-4 ${index === 0 ? "border-forest/40 bg-mist" : "border-border"}`}
                  key={rec.id}
                >
                  <span aria-hidden className="text-2xl leading-none">
                    {rec.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{rec.title}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${PRIORITY_STYLES[rec.priority]}`}
                      >
                        Prioridad {rec.priority}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm">{rec.description}</p>
                    <p className="mt-1 text-xs text-muted">
                      <strong>Por qué:</strong> {rec.reason}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <EaseSurvey sessionId={sessionId} />

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Link
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-white px-5 py-3 text-sm font-semibold shadow-sm hover:bg-mist"
          href="/onboarding?nuevo=1"
        >
          Configurar otro fundo
        </Link>
        {farmId ? (
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-forest bg-forest px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-forest-dark"
            href={`/dashboard/${farmId}`}
          >
            Ir a mi panel →
          </Link>
        ) : (
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-forest bg-forest px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-forest-dark"
            href="/dashboard"
          >
            Ir a mi panel →
          </Link>
        )}
      </div>
    </div>
  );
}
