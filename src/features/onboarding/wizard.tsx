"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/brand";
import {
  completeOnboarding,
  discardOnboarding,
  logOnboardingEvent,
  saveDraft,
} from "@/lib/onboarding/actions";
import type { DiagnosticResult } from "@/lib/onboarding/diagnostic";
import {
  ONBOARDING_STEPS,
  type OnboardingDraft,
  type StepId,
  type StepProps,
} from "@/lib/onboarding/types";
import { ContextPanel } from "@/features/onboarding/shell/context-panel";
import { ONBOARDING_CSS } from "@/features/onboarding/shell/form";
import { StepProgress } from "@/features/onboarding/shell/progress";
import { AutosaveIndicator, Timer } from "@/features/onboarding/shell/status";
import { useAutosave } from "@/features/onboarding/shell/use-autosave";
import { PerfilStep } from "@/features/onboarding/steps/perfil";
import { OperacionStep } from "@/features/onboarding/steps/operacion";
import { FundoStep } from "@/features/onboarding/steps/fundo";
import { CartografiaStep } from "@/features/onboarding/steps/cartografia";
import { DatosStep } from "@/features/onboarding/steps/datos";
import { ValidacionStep } from "@/features/onboarding/steps/validacion";
import { EquipoStep } from "@/features/onboarding/steps/equipo";
import { ListoStep } from "@/features/onboarding/steps/listo";

const STEP_COMPONENTS: Record<StepId, ComponentType<StepProps>> = {
  perfil: PerfilStep,
  operacion: OperacionStep,
  fundo: FundoStep,
  cartografia: CartografiaStep,
  datos: DatosStep,
  validacion: ValidacionStep,
  equipo: EquipoStep,
  listo: ListoStep,
};

const STEP_INTRO: Record<StepId, { subtitle: string; minutes: string }> = {
  perfil: { subtitle: "Así adaptamos CER Analytics a tu trabajo. Toma menos de un minuto.", minutes: "~1 min" },
  operacion: {
    subtitle: "Unas pocas preguntas para personalizar tus análisis, alertas y recomendaciones.",
    minutes: "~1 min",
  },
  fundo: { subtitle: "El fundo agrupa tus cuarteles, tu equipo y tus datos.", minutes: "~1 min" },
  cartografia: {
    subtitle: "Sube un KML o GeoJSON con los polígonos de tus cuarteles. Lo verás en el mapa al instante.",
    minutes: "~2 min",
  },
  datos: {
    subtitle: "Sube tu Excel o CSV tal como lo tienes: detectamos las columnas automáticamente.",
    minutes: "~2 min",
  },
  validacion: {
    subtitle: "Cruzamos el mapa con la planilla y te ayudamos a corregir antes de importar.",
    minutes: "~2 min",
  },
  equipo: { subtitle: "Invita a agrónomos y muestreadores y asígnales sus cuarteles.", minutes: "~1 min" },
  listo: {
    subtitle: "Tu fundo quedó creado. Responde la encuesta de diagnóstico para que adaptemos tu acompañamiento.",
    minutes: "~1 min",
  },
};

export type OnboardingWizardSession = {
  id: string;
  status: "in_progress" | "completed";
  farmId: string | null;
  durationSeconds: number | null;
  /** Diagnóstico de madurez digital ya respondido (si se recarga la pantalla final). */
  diagnostic?: DiagnosticResult | null;
};

function indexOf(step: StepId) {
  return ONBOARDING_STEPS.findIndex((s) => s.id === step);
}

export function OnboardingWizard({
  session,
  initialDraft,
  initialStep,
  startedAt,
  userEmail,
  resumed = false,
}: {
  session: OnboardingWizardSession;
  initialDraft: OnboardingDraft;
  initialStep: StepId;
  startedAt: string;
  userEmail: string | null;
  resumed?: boolean;
}) {
  const router = useRouter();
  const sessionId = session.id;
  const isCompletedSession = session.status === "completed";

  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft);
  const [currentStep, setCurrentStep] = useState<StepId>(isCompletedSession ? "listo" : initialStep);
  const [farmId, setFarmId] = useState<string | null>(session.farmId);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [frozenElapsed, setFrozenElapsed] = useState<number | null>(
    isCompletedSession ? (session.durationSeconds ?? 0) : null,
  );
  const [startedAtMs] = useState(() => Date.parse(startedAt));
  const [nowMs, setNowMs] = useState(startedAtMs);
  const [showResumeBanner, setShowResumeBanner] = useState(resumed);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const draftRef = useRef(initialDraft);
  const stepRef = useRef<StepId>(isCompletedSession ? "listo" : initialStep);
  const stepEnteredAtRef = useRef<number | null>(null);
  const lastViewedRef = useRef<StepId | null>(null);

  const { status: saveStatus, controller } = useAutosave(() =>
    saveDraft(sessionId, draftRef.current, stepRef.current),
  );

  // Reloj (cronómetro + "guardado hace Xs").
  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const first = setTimeout(tick, 0);
    const interval = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, []);

  // Quita ?nuevo=1 de la URL: si la página se vuelve a renderizar, retoma esta sesión en vez de crear otra.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("nuevo") || url.searchParams.has("r")) {
      url.searchParams.delete("nuevo");
      url.searchParams.delete("r");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  const liveElapsed = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
  const elapsedSeconds = frozenElapsed ?? liveElapsed;

  // Evento step_view al entrar a cada paso.
  useEffect(() => {
    if (lastViewedRef.current === currentStep) return;
    lastViewedRef.current = currentStep;
    stepEnteredAtRef.current = Date.now();
    if (isCompletedSession) return;
    void logOnboardingEvent(sessionId, currentStep, "step_view").catch(() => undefined);
  }, [currentStep, sessionId, isCompletedSession]);

  const update = useCallback(
    (patch: Partial<OnboardingDraft>) => {
      const next = { ...draftRef.current, ...patch };
      draftRef.current = next;
      setDraft(next);
      controller.schedule();
    },
    [controller],
  );

  const moveTo = useCallback(
    (step: StepId) => {
      stepRef.current = step;
      setCurrentStep(step);
      void controller.flushNow(true);
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    },
    [controller],
  );

  const secondsOnStep = () =>
    stepEnteredAtRef.current ? Math.round((Date.now() - stepEnteredAtRef.current) / 1000) : null;

  const markCompleted = useCallback((step: StepId) => {
    const current = draftRef.current;
    if (current.completedSteps.includes(step)) return;
    const next = { ...current, completedSteps: [...current.completedSteps, step] };
    draftRef.current = next;
    setDraft(next);
  }, []);

  const finish = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    setFinishError(null);
    try {
      markCompleted("equipo");
      await controller.flushNow(true);
      void logOnboardingEvent(sessionId, "equipo", "step_complete", {
        secondsOnStep: secondsOnStep(),
        elapsedSeconds,
      }).catch(() => undefined);
      const result = await completeOnboarding(sessionId);
      if (!result.ok) {
        setFinishError(result.error);
        return;
      }
      setFarmId(result.farmId);
      setFrozenElapsed(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
      stepRef.current = "listo";
      setCurrentStep("listo");
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    } catch {
      setFinishError("No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setFinishing(false);
    }
  }, [controller, elapsedSeconds, finishing, markCompleted, sessionId, startedAtMs]);

  const goNext = useCallback(() => {
    const step = stepRef.current;
    if (step === "listo") return;
    if (step === "equipo") {
      void finish();
      return;
    }
    const next = ONBOARDING_STEPS[indexOf(step) + 1]?.id;
    if (!next) return;
    markCompleted(step);
    void logOnboardingEvent(sessionId, step, "step_complete", {
      secondsOnStep: secondsOnStep(),
      elapsedSeconds,
    }).catch(() => undefined);
    moveTo(next);
  }, [elapsedSeconds, finish, markCompleted, moveTo, sessionId]);

  const goBack = useCallback(() => {
    const step = stepRef.current;
    if (step === "listo") return;
    const prev = ONBOARDING_STEPS[indexOf(step) - 1]?.id;
    if (prev) moveTo(prev);
  }, [moveTo]);

  const skip = useCallback(() => {
    const step = stepRef.current;
    if (step === "listo") return;
    if (step === "equipo") {
      void finish();
      return;
    }
    const next = ONBOARDING_STEPS[indexOf(step) + 1]?.id;
    if (!next) return;
    void logOnboardingEvent(sessionId, step, "step_skip", {
      secondsOnStep: secondsOnStep(),
      elapsedSeconds,
    }).catch(() => undefined);
    moveTo(next);
  }, [elapsedSeconds, finish, moveTo, sessionId]);

  const jumpTo = useCallback(
    (step: StepId) => {
      if (stepRef.current === "listo" || step === "listo") return;
      moveTo(step);
    },
    [moveTo],
  );

  async function saveAndExit() {
    setLeaving(true);
    try {
      await controller.flushNow();
    } finally {
      router.push("/dashboard");
    }
  }

  async function discard() {
    const ok = window.confirm(
      "¿Descartar este borrador? Se borrarán las respuestas y archivos cargados en este onboarding.",
    );
    if (!ok) return;
    const result = await discardOnboarding(sessionId);
    if (!result.ok) {
      window.alert("No pudimos descartar el borrador. Inténtalo nuevamente.");
      return;
    }
    controller.dispose();
    // URL distinta (r=…) para forzar un render nuevo en el servidor: la página crea otra sesión y
    // remonta el asistente (key = id de sesión).
    router.replace(`/onboarding?nuevo=1&r=${Date.now()}`);
  }

  const isDone = currentStep === "listo";
  const stepIndex = indexOf(currentStep);
  const stepMeta = ONBOARDING_STEPS[stepIndex];
  const intro = STEP_INTRO[currentStep];
  const StepComponent = STEP_COMPONENTS[currentStep];
  const displayName = draft.profile.fullName.trim();

  const stepProps: StepProps = {
    sessionId,
    draft,
    update,
    goNext,
    goBack,
    skip,
    finish,
    finishing,
    finishError,
    farmId,
    elapsedSeconds,
  };

  const panel = (
    <ContextPanel
      canDiscard={!isDone && !isCompletedSession}
      draft={draft}
      elapsedSeconds={elapsedSeconds}
      onDiscard={discard}
    />
  );

  return (
    <main className="min-h-screen pb-16">
      <style>{ONBOARDING_CSS}</style>

      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Brand />
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="max-w-56 truncate text-sm font-semibold">{displayName || "Configurando tu fundo"}</p>
              <p className="max-w-56 truncate text-xs text-muted">{userEmail ?? "Cuenta activa"}</p>
            </div>
            {isDone ? (
              <button
                className="inline-flex min-h-10 items-center rounded-lg border border-forest bg-forest px-3 text-xs font-semibold text-white hover:bg-forest-dark"
                onClick={() => router.push("/dashboard")}
                type="button"
              >
                Ir a mi panel →
              </button>
            ) : (
              <button
                className="inline-flex min-h-10 items-center rounded-lg border border-border bg-white px-3 text-xs font-semibold hover:bg-mist disabled:opacity-60"
                disabled={leaving}
                onClick={saveAndExit}
                type="button"
              >
                {leaving ? "Guardando…" : "Guardar y salir"}
              </button>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-5 pb-4 sm:px-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-forest">
              Paso {stepIndex + 1} de {ONBOARDING_STEPS.length}
              <span className="ml-2 font-semibold normal-case tracking-normal text-muted">· {stepMeta.label}</span>
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {!isCompletedSession ? <AutosaveIndicator nowMs={nowMs} status={saveStatus} /> : null}
              <Timer elapsedSeconds={elapsedSeconds} finished={isDone} />
            </div>
          </div>
          <StepProgress
            completedSteps={draft.completedSteps}
            currentStep={currentStep}
            locked={isDone}
            onJump={jumpTo}
          />
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 pt-6 sm:px-8 sm:pt-8">
        {showResumeBanner && !isDone ? (
          <div
            className="onb-reveal mb-5 flex items-start justify-between gap-3 rounded-2xl border border-forest/25 bg-forest/5 px-4 py-3 text-sm text-forest-dark"
            role="status"
          >
            <p>
              <span className="font-semibold">Retomamos donde quedaste.</span> Tu avance se guardó automáticamente;
              estás en el paso «{stepMeta.label}».
            </p>
            <button
              aria-label="Cerrar aviso"
              className="text-forest-dark/70 hover:text-forest-dark"
              onClick={() => setShowResumeBanner(false)}
              type="button"
            >
              ✕
            </button>
          </div>
        ) : null}

        <div className="mb-5 lg:hidden">
          <button
            aria-expanded={mobilePanelOpen}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-left text-sm font-semibold shadow-sm"
            onClick={() => setMobilePanelOpen((open) => !open)}
            type="button"
          >
            <span>
              <span className="text-forest">Perfil de contexto</span> · lo que CER Analytics va sabiendo
            </span>
            <span aria-hidden="true" className="text-muted">
              {mobilePanelOpen ? "▲" : "▼"}
            </span>
          </button>
          {mobilePanelOpen ? <div className="mt-3">{panel}</div> : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <section
            aria-label={isDone ? `${stepMeta.title} · Encuesta de diagnóstico` : undefined}
            aria-labelledby={isDone ? undefined : "step-title"}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8"
            key={currentStep}
          >
            {/* En "Listo" (Diagnóstico) el propio paso muestra su encabezado de éxito y la encuesta. */}
            {!isDone ? (
            <div className="onb-reveal mb-6">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">
                  {stepIndex + 1}. {stepMeta.label}
                </p>
                {intro.minutes ? (
                  <span className="rounded-full bg-mist px-2 py-0.5 text-[11px] font-semibold text-forest">
                    {intro.minutes}
                  </span>
                ) : null}
              </div>
              <h1 className="mt-2 font-serif text-2xl font-bold tracking-tight sm:text-3xl" id="step-title">
                {stepMeta.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{intro.subtitle}</p>
            </div>
            ) : null}
            <div className="onb-reveal">
              {isDone ? (
                <ListoStep {...stepProps} initialDiagnostic={session.diagnostic ?? null} />
              ) : (
                <StepComponent {...stepProps} />
              )}
            </div>
          </section>

          <aside aria-label="Perfil de contexto" className="hidden lg:sticky lg:top-44 lg:block">
            {panel}
          </aside>
        </div>
      </div>
    </main>
  );
}
