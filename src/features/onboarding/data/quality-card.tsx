"use client";

import type { IssueGroup } from "@/lib/onboarding/validation";
import type { QualitySummary } from "@/lib/onboarding/types";

function scoreTone(score: number) {
  if (score >= 90) return { label: "Excelente", bar: "bg-emerald-500", text: "text-emerald-700" };
  if (score >= 70) return { label: "Buena, con detalles por revisar", bar: "bg-amber-500", text: "text-amber-700" };
  return { label: "Necesita correcciones", bar: "bg-red-500", text: "text-red-700" };
}

export function QualityCard({
  quality,
  initialScore,
  groups,
  onSelectGroup,
}: {
  quality: QualitySummary;
  /** Puntaje al entrar al paso (para mostrar la mejora tras corregir). */
  initialScore: number | null;
  groups: IssueGroup[];
  onSelectGroup?: (group: IssueGroup) => void;
}) {
  const score = quality.qualityScore;
  const tone = scoreTone(score);
  const filled = Math.round(score / 10);
  const delta = initialScore !== null ? score - initialScore : 0;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Calidad de los datos</p>
          <p className={`mt-1 text-sm font-semibold ${tone.text}`}>{tone.label}</p>
        </div>
        {delta > 0 ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            +{delta} pts con tus correcciones
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div aria-hidden className="flex flex-1 gap-1">
          {Array.from({ length: 10 }, (_, i) => (
            <span
              className={`h-4 flex-1 rounded-sm transition-colors duration-500 ${i < filled ? tone.bar : "bg-mist"}`}
              key={i}
            />
          ))}
        </div>
        <span
          aria-label={`Calidad ${score} por ciento`}
          className="font-serif text-4xl font-semibold tabular-nums text-foreground"
        >
          {score}%
        </span>
      </div>
      {initialScore !== null && initialScore !== score ? (
        <p className="mt-1 text-xs text-muted">Al importar: {initialScore}%</p>
      ) : null}

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-emerald-50 px-2 py-2">
          <dt className="text-[11px] font-semibold text-emerald-800">✓ Válidos</dt>
          <dd className="text-xl font-semibold tabular-nums text-emerald-900">{quality.validCount}</dd>
        </div>
        <div className="rounded-xl bg-amber-50 px-2 py-2">
          <dt className="text-[11px] font-semibold text-amber-800">⚠ Advertencias</dt>
          <dd className="text-xl font-semibold tabular-nums text-amber-900">{quality.warningCount}</dd>
        </div>
        <div className="rounded-xl bg-red-50 px-2 py-2">
          <dt className="text-[11px] font-semibold text-red-800">✕ Errores</dt>
          <dd className="text-xl font-semibold tabular-nums text-red-900">{quality.errorCount}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[11px] text-muted">
        {quality.rowCount} filas revisadas · filas sin observaciones valen 100%, con advertencias 70% y con errores 0%.
      </p>

      {groups.length > 0 ? (
        <ul className="mt-4 space-y-1.5">
          {groups.map((group) => (
            <li key={group.kind}>
              <button
                className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-background"
                onClick={() => onSelectGroup?.(group)}
                type="button"
              >
                <span
                  className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    group.severity === "error" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {group.severity === "error" ? "✕" : "!"}
                </span>
                <span className="min-w-0">
                  <span className="font-semibold text-foreground">{group.label}</span>
                  {group.codes.length ? (
                    <span className="block truncate text-xs text-muted">{group.codes.join(", ")}</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          ✓ Sin observaciones. ¡Tus datos están impecables!
        </p>
      )}
    </section>
  );
}
