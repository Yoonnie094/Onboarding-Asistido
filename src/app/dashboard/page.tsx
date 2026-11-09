import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BlocksMap } from "@/components/map/blocks-map";
import { MEMBERSHIP_ROLES, REGIONS, labelOf } from "@/lib/onboarding/catalogs";
import { ONBOARDING_STEPS, normalizeDraft } from "@/lib/onboarding/types";
import { AppHeader } from "@/features/dashboard/app-header";
import { MaturityBadge } from "@/features/dashboard/maturity";
import { isDiagnosticResult } from "@/lib/onboarding/diagnostic";
import { isGeometry } from "@/features/dashboard/farm-analytics";
import { formatHa, formatNumber, formatRelative, toNumber } from "@/features/dashboard/format";
import { Chip, EmptyState, QualityBar, SectionHeading, linkButtonClasses } from "@/features/dashboard/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Mis fundos" };

const ASSIGNED_COLOR = "#e11d48";

export default async function DashboardPage() {
  const user = await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();

  const [membershipsResult, sessionsResult, profileResult] = await Promise.all([
    supabase.from("farm_memberships").select("farm_id, role").eq("user_id", user.id).eq("status", "active"),
    supabase
      .from("onboarding_sessions")
      .select("id, status, current_step, data, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);

  if (membershipsResult.error) {
    throw new Error("No fue posible consultar tus fundos.");
  }

  const memberships = membershipsResult.data ?? [];
  const sessions = sessionsResult.data ?? [];
  const inProgress = sessions.find((s) => s.status === "in_progress") ?? null;
  const hasCompleted = sessions.some((s) => s.status === "completed");

  // Enrutamiento post-login: un usuario nuevo (sin fundos, sin borrador y sin onboarding terminado) va directo
  // al asistente. Si ya tiene un borrador en curso, se queda aquí y ve el aviso "Continuar configuración"
  // (así "Guardar y salir" no lo devuelve al asistente).
  if (memberships.length === 0 && !hasCompleted && !inProgress) {
    redirect("/onboarding");
  }

  const farmIds = [...new Set(memberships.map((m) => m.farm_id))];
  const roleByFarm = new Map(memberships.map((m) => [m.farm_id, m.role]));

  const [farmsResult, blocksResult, importsResult, assignmentsResult] = await Promise.all([
    farmIds.length
      ? supabase.from("farms").select("id, name, region, commune, created_at, context").in("id", farmIds).order("name")
      : Promise.resolve({ data: [], error: null }),
    farmIds.length
      ? supabase.from("blocks").select("farm_id, area_ha").in("farm_id", farmIds)
      : Promise.resolve({ data: [], error: null }),
    farmIds.length
      ? supabase
          .from("farm_imports")
          .select("farm_id, quality_score, created_at")
          .eq("source_type", "planilla")
          .in("farm_id", farmIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase.from("block_assignments").select("block_id, farm_id").eq("user_id", user.id),
  ]);

  if (farmsResult.error) {
    throw new Error("No fue posible consultar tus fundos.");
  }

  const farms = farmsResult.data ?? [];
  const farmNameById = new Map(farms.map((f) => [f.id, f.name]));

  const statsByFarm = new Map<string, { count: number; ha: number }>();
  for (const block of blocksResult.data ?? []) {
    const s = statsByFarm.get(block.farm_id) ?? { count: 0, ha: 0 };
    s.count += 1;
    s.ha += Number(block.area_ha) || 0;
    statsByFarm.set(block.farm_id, s);
  }

  const qualityByFarm = new Map<string, number | null>();
  for (const imp of importsResult.data ?? []) {
    if (!qualityByFarm.has(imp.farm_id)) qualityByFarm.set(imp.farm_id, toNumber(imp.quality_score));
  }

  // Vista del muestreador: cuarteles asignados a este usuario.
  const assignedIds = [...new Set((assignmentsResult.data ?? []).map((a) => a.block_id))];
  const assignedBlocks = assignedIds.length
    ? ((
        await supabase
          .from("blocks")
          .select("id, farm_id, code, name, variety, planting_year, area_ha, geometry")
          .in("id", assignedIds)
          .order("code")
      ).data ?? [])
    : [];

  const totals = farms.reduce(
    (acc, f) => {
      const s = statsByFarm.get(f.id);
      return { blocks: acc.blocks + (s?.count ?? 0), ha: acc.ha + (s?.ha ?? 0) };
    },
    { blocks: 0, ha: 0 },
  );

  const firstName = profileResult.data?.full_name?.trim().split(/\s+/)[0] ?? null;

  return (
    <main className="min-h-screen">
      <AppHeader active="fundos" email={user.email} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
        <div className="mb-8 flex flex-col gap-4 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-forest">Espacio de trabajo</p>
            <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
              {firstName ? `Hola, ${firstName}` : "Tus fundos"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              {farms.length > 0
                ? `Tienes acceso a ${farms.length} fundo${farms.length === 1 ? "" : "s"} con ${formatNumber(
                    totals.blocks,
                  )} cuarteles y ${formatHa(totals.ha)} registradas.`
                : "Aquí verás los fundos asociados a tu cuenta de CER Analytics."}
            </p>
          </div>
          <Link className={linkButtonClasses.primary} href="/onboarding?nuevo=1">
            + Agregar fundo
          </Link>
        </div>

        {inProgress ? <ResumeBanner session={inProgress} /> : null}

        {assignedBlocks.length > 0 ? (
          <section aria-labelledby="assigned-title" className="mb-10">
            <SectionHeading
              description="Estos son los cuarteles donde te toca registrar conteos. Tócalos en el mapa para ver su detalle."
              eyebrow="Vista de muestreador"
              title="Tus cuarteles asignados"
            />
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <BlocksMap
                  blocks={assignedBlocks.map((b) => ({
                    code: b.code,
                    label: b.name,
                    geometry: isGeometry(b.geometry) ? b.geometry : null,
                    color: ASSIGNED_COLOR,
                    details: [
                      farmNameById.get(b.farm_id) ?? "Fundo",
                      ...(b.variety ? [`Variedad: ${b.variety}`] : []),
                      ...(b.area_ha !== null ? [`Superficie: ${formatHa(Number(b.area_ha))}`] : []),
                    ],
                  }))}
                  height={300}
                  highlightCodes={assignedBlocks.map((b) => b.code)}
                />
              </div>
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <ul className="divide-y divide-border">
                  {assignedBlocks.map((b) => (
                    <li key={b.id}>
                      <Link
                        className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-mist"
                        href={`/dashboard/${b.farm_id}`}
                      >
                        <div className="min-w-0">
                          <p className="font-semibold">
                            {b.code}
                            {b.name ? <span className="font-normal text-muted"> · {b.name}</span> : null}
                          </p>
                          <p className="truncate text-xs text-muted">
                            {farmNameById.get(b.farm_id) ?? "Fundo"}
                            {b.variety ? ` · ${b.variety}` : ""}
                            {b.planting_year ? ` · ${b.planting_year}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-forest">{formatHa(toNumber(b.area_ha))}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ) : null}

        {farms.length === 0 ? (
          <EmptyState
            action={
              <Link className={linkButtonClasses.primary} href="/onboarding?nuevo=1">
                Configurar un fundo
              </Link>
            }
            description="Todavía no tienes fundos activos. Configura uno con el asistente: toma menos de 10 minutos y puedes usar los archivos de ejemplo."
            title="Aún no hay fundos asociados"
          />
        ) : (
          <section aria-labelledby="farms-title">
            <h2 className="sr-only" id="farms-title">
              Fundos
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {farms.map((farm) => {
                const stats = statsByFarm.get(farm.id) ?? { count: 0, ha: 0 };
                const quality = qualityByFarm.has(farm.id) ? (qualityByFarm.get(farm.id) ?? null) : null;
                const rawDiagnostic =
                  farm.context && typeof farm.context === "object" && !Array.isArray(farm.context)
                    ? (farm.context as { diagnostic?: unknown }).diagnostic
                    : null;
                const diagnostic = isDiagnosticResult(rawDiagnostic) ? rawDiagnostic : null;
                const location = [farm.commune, farm.region ? labelOf(REGIONS, farm.region) : null]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={farm.id}>
                    <Link
                      className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-forest/50 hover:shadow-md"
                      href={`/dashboard/${farm.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Fundo</p>
                          <h3 className="mt-1 truncate font-serif text-xl font-bold">{farm.name}</h3>
                          <p className="mt-1 text-sm text-muted">{location || "Ubicación sin definir"}</p>
                          {diagnostic ? (
                            <div className="mt-2">
                              <MaturityBadge diagnostic={diagnostic} />
                            </div>
                          ) : null}
                        </div>
                        <Chip tone="forest">{labelOf(MEMBERSHIP_ROLES, roleByFarm.get(farm.id))}</Chip>
                      </div>

                      <dl className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-mist px-3 py-2.5">
                          <dt className="text-xs text-muted">Cuarteles</dt>
                          <dd className="font-serif text-2xl font-bold">{formatNumber(stats.count)}</dd>
                        </div>
                        <div className="rounded-xl bg-mist px-3 py-2.5">
                          <dt className="text-xs text-muted">Superficie</dt>
                          <dd className="font-serif text-2xl font-bold">{stats.count ? formatHa(stats.ha) : "—"}</dd>
                        </div>
                      </dl>

                      <div className="mt-5">
                        <QualityBar compact score={quality} />
                      </div>

                      <p className="mt-auto pt-5 text-sm font-semibold text-forest group-hover:underline">
                        Ver panel del fundo →
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

function ResumeBanner({
  session,
}: {
  session: { current_step: string; data: unknown; updated_at: string };
}) {
  const draft = normalizeDraft(session.data);
  const total = ONBOARDING_STEPS.length;
  const index = Math.max(
    0,
    ONBOARDING_STEPS.findIndex((s) => s.id === session.current_step),
  );
  const step = ONBOARDING_STEPS[index];
  const completed = new Set(draft.completedSteps).size;
  const pct = Math.round((Math.max(completed, index) / total) * 100);

  return (
    <section
      aria-labelledby="resume-title"
      className="mb-10 overflow-hidden rounded-2xl border border-forest/40 bg-linear-to-r from-forest to-forest-dark p-6 text-white shadow-md sm:p-7"
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/75">Onboarding en curso</p>
          <h2 className="mt-1 font-serif text-2xl font-bold" id="resume-title">
            Tienes una configuración a medias
          </h2>
          <p className="mt-1 text-sm text-white/85">
            Paso {index + 1} de {total} ({pct}%) · {step.label}
            {draft.farm.name ? ` · ${draft.farm.name}` : ""} · guardado {formatRelative(session.updated_at)}
          </p>
          <div className="mt-4 h-2 w-full max-w-md overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <Link
          className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-bold text-forest shadow-sm transition-colors hover:bg-mist"
          href="/onboarding"
        >
          Continuar configuración →
        </Link>
      </div>
    </section>
  );
}
