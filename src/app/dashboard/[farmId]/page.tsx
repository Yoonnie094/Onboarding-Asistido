import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BlocksMap } from "@/components/map/blocks-map";
import { MEMBERSHIP_ROLES, REGIONS, labelOf } from "@/lib/onboarding/catalogs";
import { getRecommendations } from "@/lib/onboarding/recommendations";
import type { OperationAnswers } from "@/lib/onboarding/types";
import { isDiagnosticResult } from "@/lib/onboarding/diagnostic";
import { AppHeader } from "@/features/dashboard/app-header";
import {
  buildVarietyColoring,
  computeInsights,
  computeKpis,
  toMapBlocks,
  type BlockRow,
} from "@/features/dashboard/farm-analytics";
import {
  BlocksTable,
  ContextCard,
  InsightsCard,
  NoBlocksState,
  QualityCard,
  RecommendationsCard,
  TeamCard,
  VarietyLegend,
  type FarmImportRow,
  type TeamRow,
} from "@/features/dashboard/farm-sections";
import { MaturityCard } from "@/features/dashboard/maturity";
import { formatDate, formatDuration, formatHa, formatNumber, formatPercent, toNumber } from "@/features/dashboard/format";
import { Card, Chip, KpiCard, SectionHeading } from "@/features/dashboard/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Panel del fundo" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TTFV_GOAL_SECONDS = 600;

type FarmContext = {
  operation?: Partial<OperationAnswers> | null;
  profileRole?: string | null;
  createdFromSession?: string | null;
  diagnostic?: unknown;
};

export default async function FarmPage({ params }: { params: Promise<{ farmId: string }> }) {
  const { farmId } = await params;
  if (!UUID_RE.test(farmId)) notFound();

  const user = await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();

  const { data: farm, error: farmError } = await supabase
    .from("farms")
    .select("id, name, region, commune, created_at, context")
    .eq("id", farmId)
    .maybeSingle();

  if (farmError) throw new Error("No fue posible cargar el fundo.");
  if (!farm) notFound();

  const context = (farm.context && typeof farm.context === "object" && !Array.isArray(farm.context)
    ? farm.context
    : {}) as FarmContext;

  const [membershipResult, blocksResult, importsResult, teamResult, sessionResult] = await Promise.all([
    supabase
      .from("farm_memberships")
      .select("role")
      .eq("farm_id", farmId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase.from("blocks").select("*").eq("farm_id", farmId).order("code"),
    supabase.from("farm_imports").select("*").eq("farm_id", farmId).order("created_at", { ascending: false }),
    supabase.rpc("get_farm_team", { p_farm_id: farmId }),
    typeof context.createdFromSession === "string" && UUID_RE.test(context.createdFromSession)
      ? supabase
          .from("onboarding_sessions")
          .select("duration_seconds")
          .eq("id", context.createdFromSession)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (blocksResult.error) throw new Error("No fue posible cargar los cuarteles.");

  const role = membershipResult.data?.role ?? null;
  const blocks: BlockRow[] = blocksResult.data ?? [];
  const imports: FarmImportRow[] = importsResult.data ?? [];
  const team: TeamRow[] = (teamResult.data as TeamRow[] | null) ?? [];
  const spreadsheetImport = imports.find((i) => i.source_type === "planilla") ?? null;
  const cartographyImport = imports.find((i) => i.source_type === "cartografia") ?? null;
  const setupSeconds = toNumber(sessionResult.data?.duration_seconds);

  // Muestreador(es) por código de cuartel, desde el equipo (miembros + invitaciones pendientes).
  const samplersByCode = new Map<string, string[]>();
  for (const row of team) {
    const name = row.full_name?.trim() || row.email || "Sin nombre";
    const label = row.kind === "invitation" ? `${name} (invitado)` : name;
    for (const code of row.block_codes ?? []) {
      samplersByCode.set(code, [...(samplersByCode.get(code) ?? []), label]);
    }
  }
  const myCodes = team.find((r) => r.kind === "member" && r.user_id === user.id)?.block_codes ?? [];
  const isSampler = role === "muestreador";
  const highlightCodes = new Set(myCodes);

  const coloring = buildVarietyColoring(blocks);
  const kpis = computeKpis(blocks, samplersByCode);
  const insights = computeInsights(blocks, kpis, samplersByCode);
  const mapBlocks = toMapBlocks(blocks, coloring.colorOf, samplersByCode);

  const recommendations = getRecommendations({
    userRole: context.profileRole ?? role,
    operation: context.operation ?? null,
    blockCount: blocks.length,
    blocksWithGeometry: kpis.withGeometryCount,
    qualityScore: spreadsheetImport ? toNumber(spreadsheetImport.quality_score) : null,
    errorCount: spreadsheetImport?.error_count ?? 0,
    teamCount: team.filter((r) => r.user_id !== user.id).length,
    assignedBlockCount: kpis.withSamplerCount,
  });

  const diagnostic = isDiagnosticResult(context.diagnostic) ? context.diagnostic : null;

  const location = [farm.commune, farm.region ? labelOf(REGIONS, farm.region) : null].filter(Boolean).join(" · ");

  return (
    <main className="min-h-screen">
      <AppHeader active="fundos" email={user.email} />

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-8 sm:py-10">
        {/* Encabezado del fundo */}
        <div className="border-b border-border pb-6">
          <Link className="text-sm font-semibold text-muted hover:text-forest" href="/dashboard">
            ← Mis fundos
          </Link>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-forest">Panel del fundo</p>
              <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">{farm.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
                <span>{location || "Ubicación sin definir"}</span>
                <span aria-hidden="true">·</span>
                <span>Creado el {formatDate(farm.created_at)}</span>
                {role ? <Chip tone="forest">{labelOf(MEMBERSHIP_ROLES, role)}</Chip> : null}
              </div>
            </div>
            {setupSeconds !== null ? (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  setupSeconds <= TTFV_GOAL_SECONDS ? "border-forest/30 bg-forest/10" : "border-amber-200 bg-amber-50"
                }`}
              >
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Tiempo hasta el primer valor</p>
                <p className="mt-0.5">
                  <strong className="font-serif text-xl">{formatDuration(setupSeconds)}</strong>{" "}
                  <span className="text-muted">
                    {setupSeconds <= TTFV_GOAL_SECONDS ? "· bajo la meta de 10 min" : "· sobre la meta de 10 min"}
                  </span>
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {isSampler ? (
          <div className="rounded-2xl border border-cherry/30 bg-cherry/5 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wide text-cherry">Vista de muestreador</p>
            <p className="mt-1 text-sm leading-6">
              {myCodes.length > 0 ? (
                <>
                  Tienes <strong>{myCodes.length}</strong> cuartel{myCodes.length === 1 ? "" : "es"} asignado
                  {myCodes.length === 1 ? "" : "s"}: <strong>{myCodes.join(", ")}</strong>. Aparecen destacados en el
                  mapa y en la tabla.
                </>
              ) : (
                "Aún no tienes cuarteles asignados en este fundo. Pídele al administrador que te asigne."
              )}
            </p>
          </div>
        ) : null}

        {/* KPIs de primer valor */}
        <section aria-labelledby="kpis-title">
          <h2 className="sr-only" id="kpis-title">
            Indicadores del fundo
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              accent
              hint={kpis.withGeometryCount < kpis.blockCount ? `${kpis.withGeometryCount} con polígono en el mapa` : "Calculada desde el mapa"}
              label="Superficie total"
              value={blocks.length ? formatHa(kpis.totalHa) : "—"}
            />
            <KpiCard hint="Unidades de manejo registradas" label="Cuarteles" value={formatNumber(kpis.blockCount)} />
            <KpiCard
              hint={coloring.legend[0] && coloring.legend[0].label !== "Sin variedad" ? `Principal: ${coloring.legend[0].label}` : "Distintas en el fundo"}
              label="Variedades"
              value={formatNumber(kpis.varietyCount)}
            />
            <KpiCard
              hint="Promedio desde el año de plantación"
              label="Edad del huerto"
              value={kpis.avgAgeYears !== null ? `${formatNumber(kpis.avgAgeYears, 1)} años` : "—"}
            />
            <KpiCard
              hint="Plantas por hectárea"
              label="Densidad media"
              value={kpis.avgDensity !== null ? formatNumber(kpis.avgDensity) : "—"}
            />
            <KpiCard
              hint={`${kpis.withSamplerCount} de ${kpis.blockCount} cuarteles`}
              label="Con muestreador"
              value={formatPercent(kpis.withSamplerPct)}
            />
          </div>
        </section>

        {blocks.length === 0 ? (
          <NoBlocksState />
        ) : (
          <>
            <InsightsCard insights={insights} />

            <section aria-label="Mapa de cuarteles" className="grid gap-4 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <BlocksMap
                  blocks={mapBlocks}
                  height={480}
                  highlightCodes={[...highlightCodes]}
                />
              </div>
              <Card>
                <SectionHeading
                  description="Color por variedad. Toca un cuartel en el mapa para ver su detalle."
                  title="Mapa de cuarteles"
                />
                <VarietyLegend items={coloring.legend} totalHa={kpis.totalHa} />
                {highlightCodes.size > 0 ? (
                  <p className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted">
                    <span aria-hidden="true" className="h-3.5 w-3.5 rounded-sm border-2 border-foreground" />
                    Borde grueso: tus cuarteles asignados
                  </p>
                ) : null}
              </Card>
            </section>

            <MaturityCard diagnostic={diagnostic} />

            <RecommendationsCard recommendations={recommendations} />

            <BlocksTable
              blocks={blocks}
              colorOf={coloring.colorOf}
              highlightCodes={highlightCodes}
              samplersByCode={samplersByCode}
            />
          </>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <QualityCard cartography={cartographyImport} spreadsheet={spreadsheetImport} />
          <TeamCard currentUserId={user.id} error={Boolean(teamResult.error)} team={team} />
          <ContextCard mappedHa={kpis.totalHa} operation={context.operation ?? null} profileRole={context.profileRole ?? null} />
        </div>

        {blocks.length === 0 ? (
          <>
            <MaturityCard diagnostic={diagnostic} />
            <RecommendationsCard recommendations={recommendations} />
          </>
        ) : null}
      </div>
    </main>
  );
}
