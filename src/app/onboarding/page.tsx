import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { OnboardingWizard } from "@/features/onboarding/wizard";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isDiagnosticResult } from "@/lib/onboarding/diagnostic";
import {
  applyProfilePrefill,
  getOrCreateSession,
  loadProfilePrefill,
} from "@/lib/onboarding/session";
import { ONBOARDING_STEPS, normalizeDraft, type StepId } from "@/lib/onboarding/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Configura tu fundo · CER Analytics",
};

const STEP_IDS = new Set<string>(ONBOARDING_STEPS.map((step) => step.id));

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireAuthenticatedUser();
  const params = await searchParams;
  const forceNew = params.nuevo === "1" || params.nuevo === "true";

  const result = await getOrCreateSession(user.id, { forceNew });

  if (result.kind === "redirect-dashboard") {
    redirect("/dashboard");
  }

  if (result.kind === "missing-migration" || result.kind === "error") {
    return <SetupNotice missingMigration={result.kind === "missing-migration"} detail={result.detail} />;
  }

  const { session, mode } = result;
  let draft = normalizeDraft(session.data);

  // Segundo fundo: si el borrador no trae perfil, se precarga desde profiles.
  if (mode !== "completed" && mode !== "new") {
    draft = applyProfilePrefill(draft, await loadProfilePrefill(user.id));
  }

  if (mode === "resumed") {
    const supabase = await createSupabaseServerClient();
    await supabase.from("onboarding_events").insert({
      session_id: session.id,
      step: STEP_IDS.has(session.current_step) ? session.current_step : "perfil",
      event: "resumed",
      metadata: { completedSteps: draft.completedSteps.length },
    });
  }

  const initialStep: StepId =
    mode === "completed"
      ? "listo"
      : STEP_IDS.has(session.current_step)
        ? (session.current_step as StepId)
        : "perfil";

  return (
    <OnboardingWizard
      initialDraft={draft}
      initialStep={initialStep}
      key={session.id}
      resumed={mode === "resumed"}
      session={{
        id: session.id,
        status: session.status,
        farmId: session.farm_id,
        durationSeconds: session.duration_seconds,
        diagnostic: isDiagnosticResult(session.diagnostic) ? session.diagnostic : null,
      }}
      startedAt={session.started_at}
      userEmail={user.email}
    />
  );
}

function SetupNotice({ missingMigration, detail }: { missingMigration: boolean; detail: string }) {
  return (
    <main className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <Brand />
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-5 py-14 sm:px-8">
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-7 shadow-sm sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-800">
            {missingMigration ? "Falta configurar la base de datos" : "No pudimos iniciar el asistente"}
          </p>
          <h1 className="mt-3 font-serif text-2xl font-bold text-amber-950">
            {missingMigration
              ? "Aplica la migración del onboarding asistido"
              : "Tuvimos un problema al cargar tu sesión"}
          </h1>
          {missingMigration ? (
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-amber-950">
              <li>Abre el SQL Editor de tu proyecto en Supabase.</li>
              <li>
                Pega y ejecuta el contenido de{" "}
                <code className="rounded bg-white/70 px-1.5 py-0.5 text-xs">
                  supabase/migrations/20261109000100_onboarding_asistido.sql
                </code>
                .
              </li>
              <li>Vuelve a esta página y recárgala.</li>
            </ol>
          ) : (
            <p className="mt-4 text-sm leading-6 text-amber-950">
              Inténtalo nuevamente en unos momentos. Si el problema continúa, revisa la conexión con Supabase.
            </p>
          )}
          <p className="mt-5 break-words rounded-xl bg-white/60 px-3 py-2 font-mono text-xs text-amber-900">
            {detail}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="inline-flex min-h-11 items-center rounded-xl border border-forest bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-dark"
              href="/onboarding"
            >
              Reintentar
            </Link>
            <Link
              className="inline-flex min-h-11 items-center rounded-xl border border-border bg-white px-4 text-sm font-semibold hover:bg-mist"
              href="/dashboard"
            >
              Ir al panel
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
