"use client";

import { ONBOARDING_STEPS, type StepId } from "@/lib/onboarding/types";

/** Barra de progreso con los 8 pasos. Pasos completados (o ya visitados) son clicables. */
export function StepProgress({
  currentStep,
  completedSteps,
  onJump,
  locked,
}: {
  currentStep: StepId;
  completedSteps: StepId[];
  onJump: (step: StepId) => void;
  /** En "listo" ya no se puede volver atrás. */
  locked: boolean;
}) {
  const currentIndex = ONBOARDING_STEPS.findIndex((step) => step.id === currentStep);
  const doneCount = ONBOARDING_STEPS.filter((s) => completedSteps.includes(s.id)).length;
  const percent = locked ? 100 : Math.round((doneCount / (ONBOARDING_STEPS.length - 1)) * 100);

  return (
    <nav aria-label="Progreso del onboarding">
      <ol className="flex items-start">
        {ONBOARDING_STEPS.map((step, index) => {
          const isCurrent = step.id === currentStep;
          const isDone = completedSteps.includes(step.id) || (locked && step.id !== "listo");
          const isSkipped = !isDone && index < currentIndex;
          const clickable = !locked && !isCurrent && (isDone || index < currentIndex);
          const isLast = index === ONBOARDING_STEPS.length - 1;

          const circle = (
            <span
              className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                isCurrent
                  ? "border-forest bg-white text-forest ring-4 ring-forest/15"
                  : isDone
                    ? "border-forest bg-forest text-white"
                    : isSkipped
                      ? "border-amber-400 bg-amber-50 text-amber-800"
                      : "border-border bg-white text-muted"
              }`}
            >
              {isDone && !isCurrent ? "✓" : isSkipped ? "–" : index + 1}
            </span>
          );

          return (
            <li className="relative flex flex-1 flex-col items-center" key={step.id}>
              {!isLast ? (
                <span
                  aria-hidden="true"
                  className={`absolute left-1/2 top-4 h-0.5 w-full ${
                    isDone || (locked && !isLast) ? "bg-forest" : "bg-border"
                  }`}
                />
              ) : null}
              {clickable ? (
                <button
                  aria-label={`Volver al paso ${index + 1}: ${step.label}`}
                  className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest hover:scale-105"
                  onClick={() => onJump(step.id)}
                  title={`Volver a ${step.label}`}
                  type="button"
                >
                  {circle}
                </button>
              ) : (
                <span aria-current={isCurrent ? "step" : undefined}>{circle}</span>
              )}
              <span
                className={`mt-1.5 hidden text-center text-[11px] font-semibold leading-tight md:block ${
                  isCurrent ? "text-forest" : isDone ? "text-foreground" : "text-muted"
                }`}
              >
                {step.label}
                {isSkipped ? <span className="block font-normal text-amber-700">pendiente</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex items-center gap-3 md:hidden">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-mist">
          <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${percent}%` }} />
        </div>
        <span className="text-xs font-semibold text-muted">{percent}%</span>
      </div>
    </nav>
  );
}
