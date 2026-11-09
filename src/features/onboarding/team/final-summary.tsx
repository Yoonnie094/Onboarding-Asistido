"use client";

import { labelOf, REGIONS } from "@/lib/onboarding/catalogs";
import type { OnboardingDraft } from "@/lib/onboarding/types";

import { formatHa, ownerByCode, totalHectares } from "./team-utils";

export function qualityTone(score: number | null): { label: string; className: string } {
  if (score === null) return { label: "Sin planilla", className: "text-muted" };
  if (score >= 85) return { label: "Buena", className: "text-forest" };
  if (score >= 60) return { label: "Aceptable", className: "text-amber-700" };
  return { label: "Por mejorar", className: "text-cherry" };
}

export function FinalSummary({ draft, skippedTeam }: { draft: OnboardingDraft; skippedTeam: boolean }) {
  const blocks = draft.blocks;
  const ha = totalHectares(blocks);
  const withGeometry = blocks.filter((block) => block.geometry).length;
  const codes = new Set(blocks.map((block) => block.code));
  const assigned = [...ownerByCode(draft.team).keys()].filter((code) => codes.has(code)).length;
  const score = draft.quality ? Math.round(draft.quality.qualityScore) : null;
  const tone = qualityTone(score);
  const location = [draft.farm.commune.trim(), draft.farm.region ? labelOf(REGIONS, draft.farm.region) : ""]
    .filter(Boolean)
    .join(", ");

  const items = [
    {
      label: "Fundo",
      value: draft.farm.name.trim() || "Sin nombre",
      detail: location || "Ubicación pendiente",
    },
    {
      label: "Cuarteles",
      value: String(blocks.length),
      detail: blocks.length ? `${formatHa(ha)} ha · ${withGeometry} con polígono` : "Puedes cargarlos después",
    },
    {
      label: "Calidad de datos",
      value: score === null ? "—" : `${score}%`,
      detail: draft.quality
        ? `${tone.label} · ${draft.quality.errorCount} error${draft.quality.errorCount === 1 ? "" : "es"}, ${draft.quality.warningCount} advertencia${draft.quality.warningCount === 1 ? "" : "s"}`
        : tone.label,
      valueClass: tone.className,
    },
    {
      label: "Equipo",
      value: skippedTeam ? "—" : String(draft.team.length),
      detail: skippedTeam
        ? "Invitarás a tu equipo después"
        : draft.team.length
          ? `${assigned} de ${blocks.length} cuarteles asignados`
          : "Sin invitaciones",
    },
  ];

  return (
    <section className="rounded-2xl border-2 border-forest/30 bg-card p-5" aria-labelledby="final-summary-title">
      <h3 className="font-serif text-xl font-semibold" id="final-summary-title">
        Resumen antes de crear tu fundo
      </h3>
      <p className="text-sm text-muted">Revisa que todo esté bien. Podrás editar cualquier dato desde el panel.</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div className="rounded-xl bg-mist p-4" key={item.label}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{item.label}</dt>
            <dd className={`mt-1 truncate text-2xl font-semibold ${item.valueClass ?? ""}`}>{item.value}</dd>
            <dd className="text-xs text-muted">{item.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
