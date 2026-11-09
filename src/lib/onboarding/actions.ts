"use server";

import type { Json } from "@/lib/database.types";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DIAGNOSTIC_QUESTIONS,
  isDiagnosticResult,
  MICRO_SURVEYS,
  scoreDiagnostic,
  type DiagnosticAnswers,
  type DiagnosticResult,
  type MicroSurveyMilestone,
} from "@/lib/onboarding/diagnostic";
import { ONBOARDING_STEPS, type OnboardingDraft, type StepId } from "@/lib/onboarding/types";

type OnboardingEventName = "step_view" | "step_complete" | "step_skip" | "resumed" | "micro_survey";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STEP_IDS = new Set<string>(ONBOARDING_STEPS.map((step) => step.id));
const EVENTS = new Set<OnboardingEventName>(["step_view", "step_complete", "step_skip", "resumed", "micro_survey"]);

function isValidSessionId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function isValidStep(value: unknown): value is StepId {
  return typeof value === "string" && STEP_IDS.has(value);
}

type PgError = { code?: string; message?: string; details?: string | null; hint?: string | null };

function translateError(error: PgError | null | undefined, fallback: string): string {
  if (!error) return fallback;
  const message = (error.message ?? "").toLowerCase();

  if (error.code === "PGRST202" || message.includes("could not find the function")) {
    return "La base de datos aún no tiene la migración del onboarding. Aplica supabase/migrations/20261109000100_onboarding_asistido.sql.";
  }
  if (error.code === "42P01" || error.code === "PGRST205" || message.includes("could not find the table")) {
    return "Faltan tablas del onboarding en la base de datos. Aplica la migración del onboarding asistido.";
  }
  if (error.code === "28000" || message.includes("no autenticado") || message.includes("jwt")) {
    return "Tu sesión expiró. Vuelve a iniciar sesión para continuar.";
  }
  if (error.code === "42501" || message.includes("permission denied") || message.includes("row-level security")) {
    return "No tienes permisos para realizar esta acción.";
  }
  if (message.includes("falta el nombre del fundo")) {
    return "Falta el nombre del fundo. Vuelve al paso «Fundo» para completarlo.";
  }
  if (message.includes("sesión de onboarding no encontrada")) {
    return "No encontramos tu sesión de onboarding. Recarga la página para continuar.";
  }
  if (error.code === "23505") {
    return "Hay datos duplicados (por ejemplo, un correo invitado dos veces). Revisa y vuelve a intentar.";
  }
  if (error.code === "22P02" || error.code === "22003") {
    return "Uno de los valores no tiene el formato esperado. Revisa la planilla en el paso «Validación».";
  }
  if (message.includes("fetch failed") || message.includes("network")) {
    return "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
  }
  return fallback;
}

export async function saveDraft(
  sessionId: string,
  draft: OnboardingDraft,
  currentStep: StepId,
): Promise<{ ok: true; savedAt: string } | { ok: false; error: string }> {
  await requireAuthenticatedUser();

  if (!isValidSessionId(sessionId)) return { ok: false, error: "Sesión inválida." };
  if (!isValidStep(currentStep)) return { ok: false, error: "Paso inválido." };
  if (!draft || typeof draft !== "object") return { ok: false, error: "Borrador inválido." };

  try {
    const supabase = await createSupabaseServerClient();
    const savedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from("onboarding_sessions")
      .update({ data: draft as unknown as Json, current_step: currentStep, updated_at: savedAt })
      .eq("id", sessionId)
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, error: translateError(error, "No se pudo guardar el avance.") };
    if (!data) return { ok: false, error: "No encontramos tu sesión de onboarding. Recarga la página." };

    return { ok: true, savedAt };
  } catch (error) {
    return { ok: false, error: translateError(error as PgError, "No se pudo guardar el avance.") };
  }
}

export async function logOnboardingEvent(
  sessionId: string,
  step: StepId,
  event: OnboardingEventName,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await requireAuthenticatedUser();

  if (!isValidSessionId(sessionId) || !isValidStep(step) || !EVENTS.has(event)) return;

  if (event === "micro_survey") {
    const rating = Math.round(Number(metadata?.rating));
    const milestone = metadata?.milestone;
    if (typeof milestone !== "string" || !Object.hasOwn(MICRO_SURVEYS, milestone)) return;
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) return;
    metadata = {
      milestone,
      rating,
      question: MICRO_SURVEYS[milestone as MicroSurveyMilestone].question,
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("onboarding_events").insert({
      session_id: sessionId,
      step,
      event,
      metadata: (metadata ?? {}) as Json,
    });
    if (error) console.warn("[onboarding] No se pudo registrar el evento", event, step, error.message);
  } catch (error) {
    console.warn("[onboarding] Error al registrar evento", error);
  }
}

export async function completeOnboarding(
  sessionId: string,
): Promise<{ ok: true; farmId: string } | { ok: false; error: string }> {
  await requireAuthenticatedUser();

  if (!isValidSessionId(sessionId)) return { ok: false, error: "Sesión inválida." };

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("complete_onboarding", { p_session_id: sessionId });

    if (error) {
      return { ok: false, error: translateError(error, "No pudimos crear tu fundo. Inténtalo nuevamente.") };
    }
    if (!data) {
      return { ok: false, error: "No pudimos crear tu fundo. Inténtalo nuevamente." };
    }

    return { ok: true, farmId: data };
  } catch (error) {
    return {
      ok: false,
      error: translateError(error as PgError, "No pudimos crear tu fundo. Inténtalo nuevamente."),
    };
  }
}

export async function rateOnboarding(
  sessionId: string,
  rating: number,
  feedback: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAuthenticatedUser();

  if (!isValidSessionId(sessionId)) return { ok: false, error: "Sesión inválida." };
  const value = Math.round(Number(rating));
  if (!Number.isFinite(value) || value < 1 || value > 5) {
    return { ok: false, error: "Elige una nota entre 1 y 5." };
  }
  const text = typeof feedback === "string" ? feedback.trim().slice(0, 2000) : "";

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("onboarding_sessions")
      .update({ rating: value, feedback: text || null, updated_at: new Date().toISOString() })
      .eq("id", sessionId)
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, error: translateError(error, "No se pudo guardar tu evaluación.") };
    if (!data) return { ok: false, error: "No encontramos tu sesión de onboarding." };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: translateError(error as PgError, "No se pudo guardar tu evaluación.") };
  }
}

/** Rehace el resultado en el servidor a partir de las respuestas (no se confía en el puntaje del cliente). */
function sanitizeDiagnostic(result: DiagnosticResult): DiagnosticResult | null {
  const raw = (result.answers ?? {}) as Record<string, unknown>;
  const answers: DiagnosticAnswers = {};
  for (const question of DIAGNOSTIC_QUESTIONS) {
    const value = Number(raw[question.id]);
    if (value === 1 || value === 2 || value === 3 || value === 4) answers[question.id] = value;
  }
  if (Object.keys(answers).length === 0) return null;
  const scored = scoreDiagnostic(answers);
  const completedAt =
    typeof result.completedAt === "string" && !Number.isNaN(Date.parse(result.completedAt))
      ? new Date(result.completedAt).toISOString()
      : scored.completedAt;
  return { ...scored, completedAt };
}

export async function saveDiagnostic(
  sessionId: string,
  result: DiagnosticResult,
): Promise<{ ok: boolean; error?: string }> {
  await requireAuthenticatedUser();

  if (!isValidSessionId(sessionId)) return { ok: false, error: "Sesión inválida." };
  if (!isDiagnosticResult(result)) return { ok: false, error: "Diagnóstico inválido." };
  const clean = sanitizeDiagnostic(result);
  if (!clean) return { ok: false, error: "Responde al menos una pregunta del diagnóstico." };

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("save_diagnostic", {
      p_session_id: sessionId,
      p_diagnostic: clean as unknown as Json,
    });
    if (error) return { ok: false, error: translateError(error, "No se pudo guardar tu diagnóstico.") };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: translateError(error as PgError, "No se pudo guardar tu diagnóstico.") };
  }
}

export async function discardOnboarding(sessionId: string): Promise<{ ok: boolean }> {
  await requireAuthenticatedUser();

  if (!isValidSessionId(sessionId)) return { ok: false };

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("onboarding_sessions")
      .delete()
      .eq("id", sessionId)
      .eq("status", "in_progress");

    if (error) {
      console.warn("[onboarding] No se pudo descartar la sesión", error.message);
      return { ok: false };
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
