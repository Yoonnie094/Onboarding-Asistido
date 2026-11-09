"use client";

import { Button } from "@/components/ui/button";

/** Pie de navegación común a todos los pasos del asistente. */
export function StepFooter({
  onBack,
  onNext,
  onSkip,
  nextLabel = "Continuar",
  nextDisabled = false,
  busy = false,
  hint,
}: {
  onBack?: () => void;
  onNext: () => void;
  onSkip?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  busy?: boolean;
  /** Texto breve que explica por qué "Continuar" está deshabilitado. */
  hint?: string | null;
}) {
  return (
    <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        {onBack ? (
          <Button onClick={onBack} type="button" variant="secondary">
            ← Volver
          </Button>
        ) : null}
        {onSkip ? (
          <button
            className="text-sm font-semibold text-muted underline-offset-4 hover:text-forest hover:underline"
            onClick={onSkip}
            type="button"
          >
            Completar después
          </button>
        ) : null}
      </div>
      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        <Button disabled={nextDisabled || busy} onClick={onNext} type="button">
          {busy ? "Guardando…" : `${nextLabel} →`}
        </Button>
        {hint && nextDisabled ? <p className="text-xs text-muted sm:text-right">{hint}</p> : null}
      </div>
    </div>
  );
}
