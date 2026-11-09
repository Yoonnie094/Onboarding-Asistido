"use client";

import { useEffect, useRef, useState } from "react";
import {
  COUNTS_SOURCES,
  DATA_SOURCES,
  FARM_COUNT_RANGES,
  GOALS,
  SPECIES,
  type CountsSourceId,
  type DataSourceId,
  type FarmCountRangeId,
  type GoalId,
  type SpeciesId,
} from "@/lib/onboarding/catalogs";
import type { OperationAnswers, StepProps } from "@/lib/onboarding/types";
import { StepFooter } from "@/features/onboarding/step-footer";
import { ChoiceCard, FieldError, Question } from "@/features/onboarding/shell/form";

const MAX_GOALS = 3;
const FIELD_ROLES = new Set(["agronomo", "encargado_campo", "muestreador"]);

type QuestionId = "species" | "farmCount" | "hectares" | "dataSources" | "counts" | "goals";

/** "1.200" o "1200" -> 1200 · "45,5" o "45.5" -> 45.5 */
function parseHectares(text: string): number | null {
  const t = text.trim().replace(/\s/g, "");
  if (!t) return null;
  let normalized = t;
  if (t.includes(",")) normalized = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) normalized = t.replace(/\./g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function SkipQuestion({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="text-xs font-semibold text-muted underline-offset-4 hover:text-forest hover:underline"
      onClick={onClick}
      type="button"
    >
      Prefiero no responder
    </button>
  );
}

export function OperacionStep({ draft, update, goNext, goBack, skip }: StepProps) {
  const op = draft.operation;
  const [passed, setPassed] = useState<Set<QuestionId>>(() => new Set());
  const [hectaresText, setHectaresText] = useState(op.hectaresApprox !== null ? String(op.hectaresApprox) : "");
  const [hectaresTouched, setHectaresTouched] = useState(false);

  const setOp = (patch: Partial<OperationAnswers>) => update({ operation: { ...op, ...patch } });
  const pass = (id: QuestionId) => setPassed((prev) => new Set(prev).add(id));

  const showCounts = op.species.includes("cereza") || FIELD_ROLES.has(draft.profile.userRole);

  const hectaresValue = parseHectares(hectaresText);
  const hectaresError =
    hectaresText.trim() === ""
      ? null
      : !Number.isFinite(hectaresValue) || (hectaresValue ?? 0) <= 0
        ? "Ingresa un número mayor a 0."
        : (hectaresValue ?? 0) > 100000
          ? "Revisa la cifra: parece demasiado alta."
          : null;

  const order: { id: QuestionId; answered: boolean }[] = [
    { id: "species", answered: op.species.length > 0 },
    { id: "farmCount", answered: op.farmCountRange !== "" },
    { id: "hectares", answered: op.hectaresApprox !== null },
    { id: "dataSources", answered: op.dataSources.length > 0 },
    ...(showCounts ? [{ id: "counts" as const, answered: op.countsSource !== "" }] : []),
    { id: "goals", answered: op.goals.length > 0 },
  ];

  // Perfilamiento progresivo: una pregunta aparece cuando la anterior tiene respuesta
  // (o si alguna posterior ya estaba respondida, p. ej. al retomar el borrador).
  const lastAnswered = order.reduce((acc, q, i) => (q.answered ? i : acc), -1);
  let visibleCount = 1;
  for (let i = 0; i < order.length - 1; i += 1) {
    if (order[i].answered || passed.has(order[i].id) || i < lastAnswered) visibleCount = i + 2;
    else break;
  }
  const visible = new Set(order.slice(0, visibleCount).map((q) => q.id));
  const numberOf = (id: QuestionId) => order.findIndex((q) => q.id === id) + 1;

  // Lleva la vista a la pregunta recién revelada.
  const prevVisible = useRef(visibleCount);
  useEffect(() => {
    if (visibleCount > prevVisible.current) {
      const id = order[visibleCount - 1]?.id;
      const el = id ? document.getElementById(`pregunta-${id}`) : null;
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    prevVisible.current = visibleCount;
  });

  const missing: string[] = [];
  if (op.species.length === 0) missing.push("al menos una especie");
  if (op.goals.length === 0) missing.push("al menos un objetivo");
  const canContinue = missing.length === 0 && !hectaresError;
  const hint = canContinue
    ? null
    : missing.length
      ? `Para continuar, elige ${missing.join(" y ")}. También puedes completarlo después.`
      : "Corrige la superficie o déjala en blanco.";

  return (
    <div className="space-y-4">
      {visible.has("species") ? (
        <Question
          id="pregunta-species"
          number={numberOf("species")}
          title="¿Qué especies produces?"
          why="Define qué modelos de predicción y alertas se activan para tus cuarteles."
          aside={<span className="text-xs font-semibold text-cherry">Obligatorio · puedes elegir varias</span>}
        >
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {SPECIES.map((s) => (
              <ChoiceCard
                compact
                icon={s.icon}
                key={s.id}
                label={s.label}
                multi
                onToggle={() => setOp({ species: toggle(op.species, s.id as SpeciesId) })}
                selected={op.species.includes(s.id)}
              />
            ))}
          </div>
        </Question>
      ) : null}

      {visible.has("farmCount") ? (
        <Question
          aside={<SkipQuestion onClick={() => pass("farmCount")} />}
          id="pregunta-farmCount"
          number={numberOf("farmCount")}
          title="¿Cuántos fundos manejas?"
          why="Si son varios, te mostraremos comparaciones entre fundos en tu panel."
        >
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" role="radiogroup">
            {FARM_COUNT_RANGES.map((range) => (
              <ChoiceCard
                compact
                key={range.id}
                label={range.label}
                onToggle={() => setOp({ farmCountRange: range.id as FarmCountRangeId })}
                selected={op.farmCountRange === range.id}
              />
            ))}
          </div>
        </Question>
      ) : null}

      {visible.has("hectares") ? (
        <Question
          aside={<SkipQuestion onClick={() => pass("hectares")} />}
          id="pregunta-hectares"
          number={numberOf("hectares")}
          title="¿Cuántas hectáreas plantadas tienes, aproximadamente?"
          why="Nos permite dimensionar el muestreo y estimar producción total. Un número aproximado basta."
        >
          <div className="flex max-w-xs items-center gap-2">
            <input
              aria-describedby={hectaresError ? "operacion-ha-error" : undefined}
              aria-invalid={Boolean(hectaresTouched && hectaresError)}
              aria-label="Hectáreas aproximadas"
              className="form-input"
              id="operacion-ha"
              inputMode="decimal"
              onBlur={() => setHectaresTouched(true)}
              onChange={(e) => {
                const text = e.target.value;
                setHectaresText(text);
                const n = parseHectares(text);
                const valid = n !== null && Number.isFinite(n) && n > 0 && n <= 100000;
                setOp({ hectaresApprox: valid ? n : null });
              }}
              placeholder="Ej.: 45"
              value={hectaresText}
            />
            <span className="text-sm font-semibold text-muted">ha</span>
          </div>
          <FieldError id="operacion-ha-error" message={hectaresTouched || hectaresText.length > 2 ? hectaresError : null} />
        </Question>
      ) : null}

      {visible.has("dataSources") ? (
        <Question
          aside={<SkipQuestion onClick={() => pass("dataSources")} />}
          id="pregunta-dataSources"
          number={numberOf("dataSources")}
          title="¿Dónde registras hoy tus datos?"
          why="Así te sugerimos el formato de carga más cómodo y qué integraciones priorizar."
        >
          <div className="grid gap-2.5 sm:grid-cols-2">
            {DATA_SOURCES.map((source) => (
              <ChoiceCard
                compact
                icon={source.icon}
                key={source.id}
                label={source.label}
                multi
                onToggle={() => setOp({ dataSources: toggle(op.dataSources, source.id as DataSourceId) })}
                selected={op.dataSources.includes(source.id)}
              />
            ))}
          </div>
        </Question>
      ) : null}

      {showCounts && visible.has("counts") ? (
        <Question
          aside={<SkipQuestion onClick={() => pass("counts")} />}
          id="pregunta-counts"
          number={numberOf("counts")}
          title="¿Dónde registras tus conteos en terreno?"
          why={
            op.species.includes("cereza")
              ? "En cerezos los conteos de yemas, flores y frutos son la base de la estimación de cosecha."
              : "Los conteos en terreno alimentan las alertas y la estimación de producción."
          }
        >
          <div className="grid gap-2.5 sm:grid-cols-2" role="radiogroup">
            {COUNTS_SOURCES.map((source) => (
              <ChoiceCard
                compact
                key={source.id}
                label={source.label}
                onToggle={() => setOp({ countsSource: source.id as CountsSourceId })}
                selected={op.countsSource === source.id}
              />
            ))}
          </div>
        </Question>
      ) : null}

      {visible.has("goals") ? (
        <Question
          aside={
            <span className="text-xs font-semibold text-cherry">
              Obligatorio · {op.goals.length} de {MAX_GOALS}
            </span>
          }
          id="pregunta-goals"
          number={numberOf("goals")}
          title="¿Qué quieres conseguir con CER Analytics?"
          why="Elige hasta 3. Ordenamos tu panel y tus primeras recomendaciones según estos objetivos."
        >
          <div className="grid gap-2.5 sm:grid-cols-2">
            {GOALS.map((goal) => {
              const selected = op.goals.includes(goal.id);
              return (
                <ChoiceCard
                  compact
                  disabled={!selected && op.goals.length >= MAX_GOALS}
                  icon={goal.icon}
                  key={goal.id}
                  label={goal.label}
                  multi
                  onToggle={() => setOp({ goals: toggle(op.goals, goal.id as GoalId) })}
                  selected={selected}
                />
              );
            })}
          </div>
          {op.goals.length >= MAX_GOALS ? (
            <p className="mt-2 text-xs text-muted">Llegaste al máximo de 3. Desmarca uno para elegir otro.</p>
          ) : null}
        </Question>
      ) : null}

      {visibleCount < order.length ? (
        <p className="text-center text-xs text-muted">
          Quedan {order.length - visibleCount} pregunta(s) más; aparecerán a medida que respondas.
        </p>
      ) : null}

      <StepFooter hint={hint} nextDisabled={!canContinue} onBack={goBack} onNext={goNext} onSkip={skip} />
    </div>
  );
}
