"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { saveDiagnostic } from "@/lib/onboarding/actions";
import {
  DIAGNOSTIC_QUESTIONS,
  scoreDiagnostic,
  type DiagnosticAnswers,
  type DiagnosticResult,
} from "@/lib/onboarding/diagnostic";

import { DiagnosticResultView } from "./diagnostic-result";

type Phase = "questions" | "saving" | "error" | "result" | "later";

const AUTO_ADVANCE_MS = 380;
const TOTAL = DIAGNOSTIC_QUESTIONS.length;

/**
 * Encuesta de diagnóstico de madurez digital (6 preguntas, una a la vez) + resultado.
 * Si la sesión ya tenía un diagnóstico guardado, parte mostrando el resultado.
 */
export function DiagnosticSurvey({
  sessionId,
  initialResult,
  onResult,
}: {
  sessionId: string;
  initialResult: DiagnosticResult | null;
  onResult?: (result: DiagnosticResult) => void;
}) {
  const [phase, setPhase] = useState<Phase>(initialResult ? "result" : "questions");
  const [result, setResult] = useState<DiagnosticResult | null>(initialResult);
  const [saved, setSaved] = useState(Boolean(initialResult));
  const [answers, setAnswers] = useState<DiagnosticAnswers>({});
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<DiagnosticResult | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const keepFocusRef = useRef(false);

  const question = DIAGNOSTIC_QUESTIONS[index];
  const answeredCount = DIAGNOSTIC_QUESTIONS.filter((q) => answers[q.id] !== undefined).length;
  const isLast = index === TOTAL - 1;
  const currentAnswer = answers[question.id];

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // Al cambiar de pregunta con teclado, el foco pasa a la opción elegida (o la primera) de la nueva pregunta.
  useEffect(() => {
    if (!keepFocusRef.current) return;
    keepFocusRef.current = false;
    const card = cardRef.current;
    const target =
      card?.querySelector<HTMLButtonElement>('[role="radio"][aria-checked="true"]') ??
      card?.querySelector<HTMLButtonElement>('[role="radio"]');
    target?.focus();
  }, [index]);

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  async function submit(finalAnswers: DiagnosticAnswers) {
    const scored = scoreDiagnostic(finalAnswers);
    setPending(scored);
    setPhase("saving");
    setError(null);
    try {
      const response = await saveDiagnostic(sessionId, scored);
      if (!response.ok) {
        setError(response.error ?? "No pudimos guardar tu diagnóstico.");
        setPhase("error");
        return;
      }
      setResult(scored);
      setSaved(true);
      setPending(null);
      setPhase("result");
      onResult?.(scored);
    } catch {
      setError("No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.");
      setPhase("error");
    }
  }

  function goTo(nextIndex: number) {
    clearTimer();
    keepFocusRef.current = Boolean(cardRef.current?.contains(document.activeElement));
    setIndex(Math.max(0, Math.min(TOTAL - 1, nextIndex)));
  }

  function choose(value: 1 | 2 | 3 | 4) {
    clearTimer();
    const next = { ...answers, [question.id]: value };
    setAnswers(next);
    const focusInside = Boolean(cardRef.current?.contains(document.activeElement));
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const firstMissing = DIAGNOSTIC_QUESTIONS.findIndex((q) => next[q.id] === undefined);
      if (isLast) {
        if (firstMissing === -1) void submit(next);
        else {
          keepFocusRef.current = focusInside;
          setIndex(firstMissing);
        }
        return;
      }
      keepFocusRef.current = focusInside;
      setIndex(index + 1);
    }, AUTO_ADVANCE_MS);
  }

  function onOptionsKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const number = Number(event.key);
    if (number >= 1 && number <= question.options.length) {
      event.preventDefault();
      choose(question.options[number - 1].value);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "ArrowRight" || event.key === "ArrowLeft") {
      const radios = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
      const current = radios.findIndex((radio) => radio === document.activeElement);
      if (current === -1) return;
      event.preventDefault();
      const delta = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
      radios[(current + delta + radios.length) % radios.length]?.focus();
    }
  }

  function restart() {
    clearTimer();
    setAnswers({});
    setIndex(0);
    setError(null);
    setPhase("questions");
  }

  function cancelRestart() {
    clearTimer();
    setPhase("result");
  }

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-forest">
          Encuesta de diagnóstico
          <span className="rounded-full bg-forest px-2 py-0.5 text-[11px] normal-case tracking-normal text-white">
            1 min
          </span>
        </p>
        <h2 className="mt-1 font-serif text-2xl font-bold tracking-tight sm:text-3xl" id="diagnostic-title">
          Madurez digital de tu operación
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
          {phase === "result"
            ? "Así está hoy tu operación. Con esto, el equipo de CER adapta el acompañamiento a tu realidad."
            : "6 preguntas rápidas para que el equipo de CER adapte el acompañamiento a tu realidad. No hay respuestas correctas: responde cómo trabajan hoy."}
        </p>
      </div>
    </div>
  );

  if (phase === "later") {
    return (
      <section
        aria-labelledby="diagnostic-later-title"
        className="onb-reveal flex flex-col gap-3 rounded-2xl border-2 border-dashed border-forest/30 bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-forest">Encuesta de diagnóstico · pendiente</p>
          <h2 className="mt-1 text-base font-semibold" id="diagnostic-later-title">
            Te falta 1 minuto para conocer la madurez digital de tu fundo
          </h2>
          <p className="text-sm text-muted">Con tus respuestas, CER adapta el acompañamiento a tu realidad.</p>
        </div>
        <Button className="shrink-0" onClick={() => setPhase(result ? "result" : "questions")} type="button">
          Responder ahora
        </Button>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="diagnostic-title"
      className="relative overflow-hidden rounded-2xl border border-forest/30 bg-card p-5 shadow-md ring-1 ring-forest/10 sm:p-7"
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-forest" />
      {header}

      <div className="mt-6">
        {phase === "result" && result ? (
          <DiagnosticResultView
            onRepeat={restart}
            onRetrySave={saved ? undefined : () => void submit(result.answers)}
            result={result}
            saved={saved}
          />
        ) : phase === "saving" ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center" role="status">
            <span className="size-9 animate-spin rounded-full border-[3px] border-forest/20 border-t-forest" />
            <p className="text-sm font-semibold">Calculando y guardando tu diagnóstico…</p>
          </div>
        ) : phase === "error" ? (
          <div className="rounded-xl border border-cherry/40 bg-cherry/5 p-5" role="alert">
            <p className="text-sm font-semibold text-cherry">No pudimos guardar tu diagnóstico.</p>
            <p className="mt-1 text-sm text-cherry">{error}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={() => void submit(answers)} type="button">
                Reintentar
              </Button>
              {pending ? (
                <button
                  className="text-sm font-semibold text-muted underline-offset-4 hover:text-forest hover:underline"
                  onClick={() => {
                    setResult(pending);
                    setSaved(false);
                    setPhase("result");
                  }}
                  type="button"
                >
                  Ver mi resultado sin guardar
                </button>
              ) : null}
              <button
                className="text-sm font-semibold text-muted underline-offset-4 hover:text-forest hover:underline"
                onClick={() => setPhase("questions")}
                type="button"
              >
                Revisar respuestas
              </button>
            </div>
          </div>
        ) : (
          <div ref={cardRef}>
            <div className="flex items-center justify-between gap-3 text-xs font-semibold">
              <span className="text-forest" aria-live="polite">
                Pregunta {index + 1} de {TOTAL}
              </span>
              <span className="text-muted">
                {answeredCount} de {TOTAL} respondidas
              </span>
            </div>
            <div
              aria-label="Avance del diagnóstico"
              aria-valuemax={TOTAL}
              aria-valuemin={0}
              aria-valuenow={answeredCount}
              className="mt-2 flex gap-1"
              role="progressbar"
            >
              {DIAGNOSTIC_QUESTIONS.map((q, i) => (
                <span
                  aria-hidden="true"
                  className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                    answers[q.id] !== undefined ? "bg-forest" : i === index ? "bg-forest/35" : "bg-mist"
                  }`}
                  key={q.id}
                />
              ))}
            </div>

            <div className="onb-reveal mt-5" key={question.id}>
              <p className="inline-block rounded-full bg-mist px-2.5 py-0.5 text-[11px] font-semibold text-forest">
                {question.dimension}
              </p>
              <h3 className="mt-2 text-lg font-semibold leading-snug sm:text-xl" id={`diag-q-${question.id}`}>
                {question.question}
              </h3>
              <div
                aria-labelledby={`diag-q-${question.id}`}
                className="mt-4 grid gap-2.5 sm:grid-cols-2"
                onKeyDown={onOptionsKeyDown}
                role="radiogroup"
              >
                {question.options.map((option, optionIndex) => {
                  const selected = currentAnswer === option.value;
                  const tabbable = currentAnswer === undefined ? optionIndex === 0 : selected;
                  return (
                    <button
                      aria-checked={selected}
                      className={`group flex min-h-16 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${
                        selected
                          ? "border-forest bg-forest/5 shadow-sm ring-1 ring-forest"
                          : "border-border bg-white hover:border-forest/50 hover:bg-mist/60"
                      }`}
                      key={option.value}
                      onClick={() => choose(option.value)}
                      role="radio"
                      tabIndex={tabbable ? 0 : -1}
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                          selected ? "bg-forest text-white" : "bg-mist text-forest"
                        }`}
                      >
                        {option.value}
                      </span>
                      <span className="flex-1 text-sm font-semibold">{option.label}</span>
                      <span
                        aria-hidden="true"
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
                          selected ? "border-forest bg-forest text-white" : "border-border bg-white text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 hidden text-xs text-muted sm:block">
                Atajo: presiona 1, 2, 3 o 4 para responder. Avanzamos solos al elegir.
              </p>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                {result ? (
                  <button
                    className="text-sm font-semibold text-muted underline-offset-4 hover:text-forest hover:underline"
                    onClick={cancelRestart}
                    type="button"
                  >
                    Cancelar y ver resultado anterior
                  </button>
                ) : (
                  <button
                    className="text-sm font-semibold text-muted underline-offset-4 hover:text-forest hover:underline"
                    onClick={() => {
                      clearTimer();
                      setPhase("later");
                    }}
                    type="button"
                  >
                    Responder después
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <Button disabled={index === 0} onClick={() => goTo(index - 1)} type="button" variant="secondary">
                  ← Anterior
                </Button>
                {isLast ? (
                  <Button
                    disabled={answeredCount < TOTAL}
                    onClick={() => {
                      clearTimer();
                      void submit(answers);
                    }}
                    type="button"
                  >
                    Ver mi resultado →
                  </Button>
                ) : (
                  <Button disabled={currentAnswer === undefined} onClick={() => goTo(index + 1)} type="button">
                    Siguiente →
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
