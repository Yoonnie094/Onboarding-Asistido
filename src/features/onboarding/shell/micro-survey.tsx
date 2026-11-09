"use client";

import { useEffect, useId, useState } from "react";

import { logOnboardingEvent } from "@/lib/onboarding/actions";
import { MICRO_SURVEYS, type MicroSurveyMilestone } from "@/lib/onboarding/diagnostic";
import type { OnboardingDraft, StepId } from "@/lib/onboarding/types";

const STAR_LABELS = ["", "Muy difícil", "Difícil", "Normal", "Fácil", "Muy fácil"];

type Phase = "ask" | "thanks" | "collapsing" | "hidden";

/**
 * Microencuesta contextual de 1 a 5 estrellas en un hito del onboarding.
 * Registra un evento "micro_survey" y guarda la nota en draft.microSurveys para no volver a preguntarla.
 */
export function MicroSurvey({
  sessionId,
  step,
  milestone,
  draft,
  update,
}: {
  sessionId: string;
  step: StepId;
  milestone: MicroSurveyMilestone;
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
}) {
  const titleId = useId();
  const [phase, setPhase] = useState<Phase>("ask");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const survey = MICRO_SURVEYS[milestone];
  const alreadyAnswered = typeof draft.microSurveys?.[milestone] === "number";

  // Tras agradecer, la tarjeta se colapsa y desaparece.
  useEffect(() => {
    if (phase === "thanks") {
      const timer = setTimeout(() => setPhase("collapsing"), 2200);
      return () => clearTimeout(timer);
    }
    if (phase === "collapsing") {
      const timer = setTimeout(() => setPhase("hidden"), 550);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  if (phase === "hidden") return null;
  if (phase === "ask" && alreadyAnswered) return null;

  function choose(value: number) {
    setRating(value);
    setPhase("thanks");
    void logOnboardingEvent(sessionId, step, "micro_survey", {
      milestone,
      rating: value,
      question: survey.question,
    }).catch(() => undefined);
    update({ microSurveys: { ...draft.microSurveys, [milestone]: value } });
  }

  const shown = hover || rating;
  const collapsed = phase === "collapsing";

  return (
    <div
      aria-hidden={collapsed || undefined}
      className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out ${
        collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
      }`}
    >
      <div className="min-h-0 overflow-hidden">
        <section
          aria-labelledby={titleId}
          className="onb-reveal rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 sm:px-5"
        >
          {phase === "ask" ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-800">
                  Pregunta rápida · 1 clic
                </p>
                <h3 className="text-sm font-semibold text-foreground" id={titleId}>
                  {survey.question}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <div
                  aria-labelledby={titleId}
                  className="flex"
                  onMouseLeave={() => setHover(0)}
                  role="group"
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      aria-label={`${value} de 5 estrellas: ${STAR_LABELS[value]}`}
                      className={`flex size-11 items-center justify-center rounded-lg text-[2rem] leading-none transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest ${
                        value <= shown ? "text-amber-500" : "text-amber-900/20"
                      }`}
                      key={value}
                      onBlur={() => setHover(0)}
                      onClick={() => choose(value)}
                      onFocus={() => setHover(value)}
                      onMouseEnter={() => setHover(value)}
                      title={STAR_LABELS[value]}
                      type="button"
                    >
                      ★
                    </button>
                  ))}
                </div>
                <span aria-hidden="true" className="hidden w-20 text-xs font-medium text-muted md:inline">
                  {shown ? STAR_LABELS[shown] : ""}
                </span>
                <button
                  className="text-xs font-semibold text-muted underline-offset-4 hover:text-forest hover:underline"
                  onClick={() => setPhase("hidden")}
                  type="button"
                >
                  Omitir
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3" role="status">
              <span aria-hidden="true" className="onb-pop text-2xl text-amber-500">
                {"★".repeat(rating)}
                <span className="text-amber-900/20">{"★".repeat(5 - rating)}</span>
              </span>
              <p className="text-sm font-semibold text-foreground" id={titleId}>
                ¡Gracias! Nos ayuda a mejorar
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
