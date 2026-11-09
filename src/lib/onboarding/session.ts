// Funciones de servidor (no son Server Actions) para cargar o crear la sesión de onboarding.
// Solo deben importarse desde Server Components (p. ej. src/app/onboarding/page.tsx).

import type { Database, Json } from "@/lib/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EMPTY_DRAFT, normalizeDraft, type OnboardingDraft } from "@/lib/onboarding/types";

export type OnboardingSessionRow = Database["public"]["Tables"]["onboarding_sessions"]["Row"];

export type SessionLoadResult =
  | {
      kind: "ok";
      session: OnboardingSessionRow;
      /** "new": recién creada · "resumed": en curso con avance · "fresh": en curso sin avance · "completed": terminada hace poco. */
      mode: "new" | "resumed" | "fresh" | "completed";
    }
  | { kind: "redirect-dashboard" }
  | { kind: "missing-migration"; detail: string }
  | { kind: "error"; detail: string };

/** Ventana en la que, al recargar /onboarding tras terminar, se sigue mostrando la pantalla "Listo". */
const COMPLETED_WINDOW_MS = 60 * 60 * 1000;

const SESSION_COLUMNS =
  "id, user_id, status, current_step, data, farm_id, rating, feedback, diagnostic, started_at, updated_at, completed_at, duration_seconds";

function isMissingMigration(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.code === "42703" ||
    message.includes("could not find the table") ||
    message.includes("does not exist")
  );
}

/** Tiene avance real (para registrar "resumed"). */
export function sessionHasProgress(session: OnboardingSessionRow): boolean {
  const draft = normalizeDraft(session.data);
  return session.current_step !== "perfil" || draft.completedSteps.length > 0 || draft.profile.fullName !== "";
}

/** Lee el perfil guardado para precargar el paso "Perfil" (útil al configurar un segundo fundo). */
export async function loadProfilePrefill(userId: string): Promise<Partial<OnboardingDraft["profile"]> | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, job_title, phone, user_role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  if (!data.full_name && !data.job_title && !data.phone && !data.user_role) return null;

  return {
    fullName: data.full_name ?? "",
    jobTitle: data.job_title ?? "",
    phone: data.phone ?? "",
    userRole: (data.user_role ?? "") as OnboardingDraft["profile"]["userRole"],
  };
}

/** Mezcla el perfil guardado en el borrador solo si el borrador aún no tiene datos de perfil. */
export function applyProfilePrefill(
  draft: OnboardingDraft,
  prefill: Partial<OnboardingDraft["profile"]> | null,
): OnboardingDraft {
  if (!prefill) return draft;
  const p = draft.profile;
  const isEmpty = !p.fullName && !p.jobTitle && !p.phone && !p.userRole;
  if (!isEmpty) return draft;
  return { ...draft, profile: { ...p, ...prefill } };
}

/**
 * Busca la sesión en curso del usuario; si no hay, la crea.
 * - Si no hay sesión en curso, no se pide `forceNew` y el usuario terminó un onboarding hace menos de 1 hora,
 *   se devuelve esa sesión completada (así recargar la página sigue mostrando "Tu fundo está listo").
 * - Si terminó hace más tiempo y no se pide `forceNew`, se sugiere volver al panel.
 * - `forceNew` (?nuevo=1) crea una sesión nueva cuando no hay otra en curso (p. ej. para un segundo fundo).
 */
export async function getOrCreateSession(
  userId: string,
  { forceNew = false }: { forceNew?: boolean } = {},
): Promise<SessionLoadResult> {
  const supabase = await createSupabaseServerClient();

  const { data: current, error: currentError } = await supabase
    .from("onboarding_sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .maybeSingle();

  if (currentError) {
    if (isMissingMigration(currentError)) {
      return { kind: "missing-migration", detail: currentError.message };
    }
    return { kind: "error", detail: currentError.message };
  }

  if (current) {
    return { kind: "ok", session: current, mode: sessionHasProgress(current) ? "resumed" : "fresh" };
  }

  if (!forceNew) {
    const { data: lastCompleted } = await supabase
      .from("onboarding_sessions")
      .select(SESSION_COLUMNS)
      .eq("user_id", userId)
      .eq("status", "completed")
      .not("farm_id", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastCompleted) {
      const completedAt = lastCompleted.completed_at ? Date.parse(lastCompleted.completed_at) : 0;
      if (Date.now() - completedAt < COMPLETED_WINDOW_MS) {
        return { kind: "ok", session: lastCompleted, mode: "completed" };
      }
      return { kind: "redirect-dashboard" };
    }
  }

  const prefill = await loadProfilePrefill(userId);
  const initialDraft = applyProfilePrefill(EMPTY_DRAFT, prefill);

  const { data: created, error: insertError } = await supabase
    .from("onboarding_sessions")
    .insert({ user_id: userId, current_step: "perfil", data: initialDraft as unknown as Json })
    .select(SESSION_COLUMNS)
    .single();

  if (insertError) {
    // Carrera: otra petición creó la sesión en paralelo (índice único de "una en curso por usuario").
    if (insertError.code === "23505") {
      const { data: retry } = await supabase
        .from("onboarding_sessions")
        .select(SESSION_COLUMNS)
        .eq("user_id", userId)
        .eq("status", "in_progress")
        .maybeSingle();
      if (retry) return { kind: "ok", session: retry, mode: "fresh" };
    }
    if (isMissingMigration(insertError)) {
      return { kind: "missing-migration", detail: insertError.message };
    }
    return { kind: "error", detail: insertError.message };
  }

  return { kind: "ok", session: created, mode: "new" };
}
