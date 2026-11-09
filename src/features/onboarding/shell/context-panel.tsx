"use client";

import { useState } from "react";
import {
  COUNTS_SOURCES,
  DATA_SOURCES,
  FARM_COUNT_RANGES,
  GOALS,
  MEMBERSHIP_ROLES,
  REGIONS,
  SPECIES,
  USER_ROLES,
  labelOf,
} from "@/lib/onboarding/catalogs";
import { getRecommendations } from "@/lib/onboarding/recommendations";
import type { OnboardingDraft } from "@/lib/onboarding/types";

type Row = { key: string; icon: string; label: string; value: string | null };

function listLabels<T extends readonly { id: string; label: string }[]>(catalog: T, ids: string[]): string | null {
  if (!ids.length) return null;
  return ids.map((id) => labelOf(catalog, id)).join(", ");
}

function blockStats(draft: OnboardingDraft) {
  const features = draft.cartography && !draft.cartography.skipped ? draft.cartography.features : [];
  const rows = draft.spreadsheet && !draft.spreadsheet.skipped ? draft.spreadsheet.rawRows : [];
  const total = draft.blocks.length || features.length || rows.length;
  const withGeometry = draft.blocks.length
    ? draft.blocks.filter((b) => b.geometry).length
    : features.length;
  const mapAreaHa = features.reduce((sum, f) => sum + (Number.isFinite(f.areaHa) ? f.areaHa : 0), 0);
  const assigned = new Set(draft.team.flatMap((member) => member.blockCodes)).size;
  return { total, withGeometry, mapAreaHa, assigned, features: features.length, rows: rows.length };
}

/** Objeto "perfil de contexto" que CER Analytics construye a partir de las respuestas. */
export function buildContextProfile(draft: OnboardingDraft, elapsedSeconds: number) {
  const stats = blockStats(draft);
  const op = draft.operation;
  return {
    usuario: {
      nombre: draft.profile.fullName || null,
      cargo: draft.profile.jobTitle || null,
      rol: draft.profile.userRole || null,
    },
    operacion: {
      especies: op.species,
      cantidadFundos: op.farmCountRange || null,
      hectareasAprox: op.hectaresApprox,
      fuentesDeDatos: op.dataSources,
      registroConteos: op.countsSource || null,
      objetivos: op.goals,
    },
    fundo: {
      nombre: draft.farm.name || null,
      region: draft.farm.region || null,
      comuna: draft.farm.commune || null,
    },
    cuarteles: {
      total: stats.total,
      conPoligono: stats.withGeometry,
      superficieMapaHa: Math.round(stats.mapAreaHa * 10) / 10,
      archivoMapa: draft.cartography?.skipped ? "omitido" : (draft.cartography?.fileName ?? null),
      archivoPlanilla: draft.spreadsheet?.skipped ? "omitido" : (draft.spreadsheet?.fileName ?? null),
    },
    calidadDatos: draft.quality
      ? {
          puntaje: Math.round(draft.quality.qualityScore),
          filas: draft.quality.rowCount,
          errores: draft.quality.errorCount,
          advertencias: draft.quality.warningCount,
        }
      : null,
    equipo: {
      invitados: draft.team.length,
      cuartelesAsignados: stats.assigned,
    },
    progreso: {
      pasosCompletados: draft.completedSteps,
      segundos: elapsedSeconds,
    },
  };
}

export function ContextPanel({
  draft,
  elapsedSeconds,
  onDiscard,
  canDiscard,
}: {
  draft: OnboardingDraft;
  elapsedSeconds: number;
  onDiscard?: () => void;
  canDiscard: boolean;
}) {
  const [showJson, setShowJson] = useState(false);
  const stats = blockStats(draft);
  const op = draft.operation;

  const roleLabel = draft.profile.userRole ? labelOf(USER_ROLES, draft.profile.userRole) : null;
  const teamRoles = draft.team.length
    ? `${draft.team.length} invitado(s) · ${[...new Set(draft.team.map((m) => labelOf(MEMBERSHIP_ROLES, m.role)))].join(", ")}`
    : null;

  const rows: Row[] = [
    {
      key: "rol",
      icon: "👤",
      label: "Rol",
      value: roleLabel
        ? `${roleLabel}${draft.profile.jobTitle ? ` · ${draft.profile.jobTitle}` : ""}`
        : null,
    },
    {
      key: "especies",
      icon: "🍒",
      label: "Especies",
      value: listLabels(SPECIES, op.species),
    },
    {
      key: "superficie",
      icon: "📏",
      label: "Superficie",
      value:
        op.hectaresApprox !== null || op.farmCountRange
          ? [
              op.hectaresApprox !== null ? `~${op.hectaresApprox.toLocaleString("es-CL")} ha` : null,
              op.farmCountRange
                ? `${labelOf(FARM_COUNT_RANGES, op.farmCountRange)}${op.farmCountRange === "1" ? "" : " fundos"}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : null,
    },
    {
      key: "fuentes",
      icon: "🗄️",
      label: "Fuentes de datos",
      value: [listLabels(DATA_SOURCES, op.dataSources), op.countsSource ? `Conteos: ${labelOf(COUNTS_SOURCES, op.countsSource)}` : null]
        .filter(Boolean)
        .join(" · ") || null,
    },
    { key: "objetivos", icon: "🎯", label: "Objetivos", value: listLabels(GOALS, op.goals) },
    {
      key: "fundo",
      icon: "🏡",
      label: "Fundo",
      value: draft.farm.name
        ? `${draft.farm.name}${draft.farm.commune ? ` · ${draft.farm.commune}` : ""}${draft.farm.region ? ` (${labelOf(REGIONS, draft.farm.region)})` : ""}`
        : null,
    },
    {
      key: "cuarteles",
      icon: "🗺️",
      label: "Cuarteles",
      value: stats.total
        ? `${stats.total} cuarteles${stats.withGeometry ? ` · ${stats.withGeometry} con polígono` : ""}${stats.mapAreaHa ? ` · ${stats.mapAreaHa.toFixed(1)} ha en mapa` : ""}`
        : draft.cartography?.skipped && draft.spreadsheet?.skipped
          ? "Omitido por ahora"
          : null,
    },
    {
      key: "calidad",
      icon: "✅",
      label: "Calidad de datos",
      value: draft.quality
        ? `${Math.round(draft.quality.qualityScore)}% · ${draft.quality.errorCount} errores · ${draft.quality.warningCount} advertencias`
        : null,
    },
    {
      key: "equipo",
      icon: "👥",
      label: "Equipo",
      value: teamRoles ? `${teamRoles}${stats.assigned ? ` · ${stats.assigned} cuarteles asignados` : ""}` : null,
    },
  ];

  const known = rows.filter((row) => row.value).length;
  const percent = Math.round((known / rows.length) * 100);

  const recommendations = getRecommendations({
    userRole: draft.profile.userRole || null,
    operation: draft.operation,
    blockCount: stats.total,
    blocksWithGeometry: stats.withGeometry,
    qualityScore: draft.quality ? draft.quality.qualityScore : null,
    errorCount: draft.quality?.errorCount ?? 0,
    teamCount: draft.team.length,
    assignedBlockCount: stats.assigned,
  }).slice(0, 3);

  const hasAnyAnswer = known > 0;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-forest">Perfil de contexto</p>
            <h2 className="mt-1 font-serif text-lg font-bold leading-snug">Lo que CER Analytics sabe de tu operación</h2>
          </div>
          <span className="rounded-full bg-mist px-2.5 py-1 text-xs font-bold text-forest tabular-nums">
            {known}/{rows.length}
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-mist">
          <div className="h-full rounded-full bg-forest transition-all duration-500" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-xs leading-5 text-muted">
          Cada respuesta ajusta tus alertas, reportes y recomendaciones. Se actualiza en vivo.
        </p>

        {showJson ? (
          <pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-[#13261b] p-3 text-[11px] leading-4 text-[#cfe9d8]">
            {JSON.stringify(buildContextProfile(draft, elapsedSeconds), null, 2)}
          </pre>
        ) : (
          <dl className="mt-4 space-y-2.5">
            {rows.map((row) => (
              <div className="flex gap-3" key={row.key}>
                <dt className="flex w-6 shrink-0 justify-center pt-0.5 text-base" aria-hidden="true">
                  {row.icon}
                </dt>
                <dd className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{row.label}</p>
                  {row.value ? (
                    <p className="onb-flash text-sm font-semibold leading-5 text-foreground" key={row.value}>
                      {row.value}
                    </p>
                  ) : (
                    <p className="text-sm italic leading-5 text-muted/70">Aún no lo sabemos</p>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <button
          aria-pressed={showJson}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted hover:border-forest hover:text-forest"
          onClick={() => setShowJson((value) => !value)}
          type="button"
        >
          <span aria-hidden="true">{"{ }"}</span>
          {showJson ? "Ver resumen" : "Ver JSON"}
        </button>
      </section>

      {hasAnyAnswer && recommendations.length ? (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-forest">Recomendaciones en vivo</p>
          <ul className="mt-3 space-y-3">
            {recommendations.map((rec) => (
              <li className="onb-reveal flex gap-3" key={rec.id}>
                <span aria-hidden="true" className="text-lg">
                  {rec.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-5">
                    {rec.title}
                    {rec.priority === "alta" ? (
                      <span className="ml-2 rounded-full bg-cherry/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cherry">
                        Alta
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs leading-5 text-muted">{rec.reason}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canDiscard && onDiscard ? (
        <button
          className="w-full text-center text-xs font-semibold text-muted underline-offset-4 hover:text-cherry hover:underline"
          onClick={onDiscard}
          type="button"
        >
          Descartar borrador y empezar de nuevo
        </button>
      ) : null}
    </div>
  );
}
