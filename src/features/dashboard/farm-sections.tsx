import Link from "next/link";
import type { ReactNode } from "react";
import type { Database } from "@/lib/database.types";
import {
  COUNTS_SOURCES,
  DATA_SOURCES,
  FARM_COUNT_RANGES,
  GOALS,
  MEMBERSHIP_ROLES,
  SPECIES,
  TARGET_FIELDS,
  USER_ROLES,
  labelOf,
} from "@/lib/onboarding/catalogs";
import type { Recommendation } from "@/lib/onboarding/recommendations";
import type { OperationAnswers, ValidationIssue } from "@/lib/onboarding/types";
import { SOURCE_LABELS, type BlockRow, type Insight, type LegendItem } from "@/features/dashboard/farm-analytics";
import { formatDate, formatHa, formatNumber, formatPercent, toNumber } from "@/features/dashboard/format";
import { Card, Chip, QualityBar, SectionHeading, linkButtonClasses } from "@/features/dashboard/ui";

export type FarmImportRow = Database["public"]["Tables"]["farm_imports"]["Row"];
export type TeamRow = Database["public"]["Functions"]["get_farm_team"]["Returns"][number];

/* ------------------------------------------------------------------ */
/* Leyenda del mapa                                                    */
/* ------------------------------------------------------------------ */

export function VarietyLegend({ items, totalHa }: { items: LegendItem[]; totalHa: number }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const share = totalHa > 0 ? (100 * item.areaHa) / totalHa : 0;
        return (
          <li key={item.label} className="text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 rounded-sm border border-black/10"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate font-semibold">{item.label}</span>
              </span>
              <span className="shrink-0 text-xs text-muted">
                {item.count} · {formatHa(item.areaHa)}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-mist">
              <div className="h-full rounded-full" style={{ width: `${share}%`, backgroundColor: item.color }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Primer insight                                                      */
/* ------------------------------------------------------------------ */

const INSIGHT_TONES = {
  info: { box: "border-sky-200 bg-sky-50", dot: "bg-sky-500", label: "Hallazgo" },
  warning: { box: "border-amber-200 bg-amber-50", dot: "bg-amber-500", label: "Atención" },
  positive: { box: "border-emerald-200 bg-emerald-50", dot: "bg-forest", label: "Bien" },
} as const;

export function InsightsCard({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;
  return (
    <Card>
      <SectionHeading
        description="Hallazgos automáticos calculados con los datos que cargaste. Son simples a propósito: cada uno indica de dónde sale."
        eyebrow="Tu primer insight"
        title="Lo que ya podemos decirte de tu fundo"
      />
      <ul className="grid gap-3 md:grid-cols-2">
        {insights.map((insight) => {
          const tone = INSIGHT_TONES[insight.tone];
          return (
            <li key={insight.id} className={`rounded-xl border p-4 ${tone.box}`}>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-foreground/70">
                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${tone.dot}`} />
                {tone.label}
              </p>
              <h3 className="mt-1.5 font-semibold">{insight.title}</h3>
              <p className="mt-1 text-sm leading-6 text-foreground/80">{insight.body}</p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Tabla de cuarteles                                                  */
/* ------------------------------------------------------------------ */

export function BlocksTable({
  blocks,
  samplersByCode,
  colorOf,
  highlightCodes,
}: {
  blocks: BlockRow[];
  samplersByCode: Map<string, string[]>;
  colorOf: (variety: string | null) => string;
  highlightCodes: Set<string>;
}) {
  return (
    <Card className="p-0! sm:p-0!">
      <div className="p-5 pb-0 sm:p-6 sm:pb-0">
        <SectionHeading
          description={`${blocks.length} cuartel${blocks.length === 1 ? "" : "es"} unidos desde el mapa y la planilla.`}
          title="Cuarteles"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-y border-border bg-mist/60 text-xs uppercase tracking-wide text-muted">
            <tr>
              {["Código", "Nombre", "Variedad", "Portainjerto", "Año", "Densidad", "Superficie", "Riego", "Origen", "Muestreador"].map(
                (h) => (
                  <th key={h} className="px-4 py-3 font-semibold" scope="col">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {blocks.map((b) => {
              const samplers = samplersByCode.get(b.code) ?? [];
              const mine = highlightCodes.has(b.code);
              return (
                <tr key={b.id} className={mine ? "bg-cherry/5" : "hover:bg-mist/40"}>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">
                    {b.code}
                    {mine ? <span className="ml-2 text-xs font-bold text-cherry">Tuyo</span> : null}
                  </td>
                  <td className="px-4 py-3 text-muted">{b.name ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: colorOf(b.variety) }}
                      />
                      {b.variety ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{b.rootstock ?? "—"}</td>
                  <td className="px-4 py-3">{b.planting_year ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {b.density !== null ? `${formatNumber(Number(b.density))} pl/ha` : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{formatHa(toNumber(b.area_ha))}</td>
                  <td className="px-4 py-3">{b.irrigation ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Chip tone={b.source === "ambos" ? "forest" : "amber"}>{SOURCE_LABELS[b.source] ?? b.source}</Chip>
                  </td>
                  <td className="px-4 py-3">
                    {samplers.length ? samplers.join(", ") : <span className="text-cherry">Sin asignar</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Calidad de datos                                                    */
/* ------------------------------------------------------------------ */

function asIssues(value: unknown): ValidationIssue[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (i): i is ValidationIssue => Boolean(i) && typeof i === "object" && typeof (i as ValidationIssue).message === "string",
  );
}

function fieldLabel(field: ValidationIssue["field"]): string {
  if (field === "geometry") return "Geometría";
  if (!field) return "Cruce mapa / planilla";
  return TARGET_FIELDS.find((f) => f.id === field)?.label ?? field;
}

export function QualityCard({
  spreadsheet,
  cartography,
}: {
  spreadsheet: FarmImportRow | null;
  cartography: FarmImportRow | null;
}) {
  const score = spreadsheet ? toNumber(spreadsheet.quality_score) : null;
  const issues = asIssues(spreadsheet?.issues);
  const groups = new Map<string, { severity: ValidationIssue["severity"]; label: string; items: ValidationIssue[] }>();
  for (const issue of issues) {
    const key = `${issue.severity}:${issue.field ?? "none"}`;
    const g = groups.get(key) ?? { severity: issue.severity, label: fieldLabel(issue.field), items: [] };
    g.items.push(issue);
    groups.set(key, g);
  }
  const sortedGroups = [...groups.values()].sort(
    (a, b) => (a.severity === b.severity ? b.items.length - a.items.length : a.severity === "error" ? -1 : 1),
  );

  return (
    <Card>
      <SectionHeading
        description="Resultado de la validación hecha durante el onboarding."
        eyebrow="Datos"
        title="Calidad de datos"
      />

      <div className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Planilla</p>
          {spreadsheet ? (
            <>
              <p className="mb-2 truncate text-sm font-semibold" title={spreadsheet.file_name ?? undefined}>
                {spreadsheet.file_name ?? "Planilla sin nombre"}
              </p>
              <QualityBar score={score} />
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-emerald-50 px-2 py-2">
                  <dt className="text-[11px] text-muted">Válidas</dt>
                  <dd className="text-lg font-bold text-forest">{spreadsheet.valid_count}</dd>
                </div>
                <div className="rounded-lg bg-amber-50 px-2 py-2">
                  <dt className="text-[11px] text-muted">Advertencias</dt>
                  <dd className="text-lg font-bold text-amber-700">{spreadsheet.warning_count}</dd>
                </div>
                <div className="rounded-lg bg-rose-50 px-2 py-2">
                  <dt className="text-[11px] text-muted">Errores</dt>
                  <dd className="text-lg font-bold text-cherry">{spreadsheet.error_count}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-muted">
                {spreadsheet.row_count} filas revisadas · {formatDate(spreadsheet.created_at)}
              </p>

              {sortedGroups.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {sortedGroups.map((g) => (
                    <li
                      key={`${g.severity}-${g.label}`}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        g.severity === "error" ? "border-rose-200 bg-rose-50/60" : "border-amber-200 bg-amber-50/60"
                      }`}
                    >
                      <p className="font-semibold">
                        {g.label}{" "}
                        <span className={g.severity === "error" ? "text-cherry" : "text-amber-700"}>
                          · {g.items.length} {g.severity === "error" ? "error" : "advertencia"}
                          {g.items.length === 1 ? "" : g.severity === "error" ? "es" : "s"}
                        </span>
                      </p>
                      <ul className="mt-1 space-y-0.5 text-xs text-foreground/75">
                        {g.items.slice(0, 3).map((item, i) => (
                          <li key={i}>
                            {item.blockCode ? <strong>{item.blockCode}: </strong> : null}
                            {item.message}
                          </li>
                        ))}
                        {g.items.length > 3 ? <li className="text-muted">y {g.items.length - 3} más…</li> : null}
                      </ul>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-forest">
                  Sin observaciones pendientes en la planilla.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">No se cargó planilla en el onboarding.</p>
          )}
        </div>

        <div className="border-t border-border pt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Cartografía</p>
          {cartography ? (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-semibold" title={cartography.file_name ?? undefined}>
                {cartography.file_name ?? "Archivo de mapa"}
              </span>
              <span className="shrink-0 text-muted">
                {cartography.row_count} polígono{cartography.row_count === 1 ? "" : "s"}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted">No se cargó cartografía.</p>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Equipo                                                              */
/* ------------------------------------------------------------------ */

function initials(name: string): string {
  const parts = name.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

function TeamList({ rows, currentUserId, pending }: { rows: TeamRow[]; currentUserId: string; pending?: boolean }) {
  return (
    <ul className="space-y-2">
      {rows.map((row, i) => {
        const name = row.full_name?.trim() || row.email || "Sin nombre";
        const isMe = row.user_id === currentUserId;
        return (
          <li key={`${row.kind}-${row.email ?? i}`} className="flex items-start gap-3 rounded-xl border border-border px-3 py-2.5">
            <span
              aria-hidden="true"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                pending ? "border border-dashed border-muted text-muted" : "bg-forest text-white"
              }`}
            >
              {initials(name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold">
                <span className="truncate">{name}</span>
                {isMe ? <span className="text-xs font-bold text-forest">(tú)</span> : null}
              </p>
              <p className="truncate text-xs text-muted">
                {labelOf(MEMBERSHIP_ROLES, row.role)}
                {row.full_name && row.email ? ` · ${row.email}` : ""}
                {pending ? " · invitación pendiente" : ""}
              </p>
              {row.block_codes.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {row.block_codes.map((code) => (
                    <span key={code} className="rounded-md bg-mist px-1.5 py-0.5 text-[11px] font-semibold text-forest">
                      {code}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function TeamCard({
  team,
  error,
  currentUserId,
}: {
  team: TeamRow[];
  error: boolean;
  currentUserId: string;
}) {
  const members = team.filter((r) => r.kind === "member" && r.status === "active");
  const pending = team.filter((r) => r.kind === "invitation");
  return (
    <Card>
      <SectionHeading eyebrow="Personas" title="Equipo" />
      {error ? (
        <p className="text-sm text-muted">No pudimos cargar el equipo en este momento.</p>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Miembros activos · {members.length}</p>
            {members.length ? <TeamList currentUserId={currentUserId} rows={members} /> : <p className="text-sm text-muted">Sin miembros.</p>}
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
              Invitaciones pendientes · {pending.length}
            </p>
            {pending.length ? (
              <>
                <TeamList currentUserId={currentUserId} pending rows={pending} />
                <p className="mt-2 text-xs leading-5 text-muted">
                  Cuando se registren con ese correo entrarán directo a sus cuarteles asignados.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted">No hay invitaciones pendientes.</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Perfil de contexto                                                  */
/* ------------------------------------------------------------------ */

function labels<T extends readonly { id: string; label: string }[]>(catalog: T, ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is string => typeof id === "string").map((id) => labelOf(catalog, id));
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[10rem_1fr] sm:gap-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-muted">Sin respuesta</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Chip key={item}>{item}</Chip>
      ))}
    </span>
  );
}

export function ContextCard({
  operation,
  profileRole,
  mappedHa,
}: {
  operation: Partial<OperationAnswers> | null;
  profileRole: string | null;
  mappedHa: number;
}) {
  const declared = toNumber(operation?.hectaresApprox);
  const diffPct = declared && declared > 0 && mappedHa > 0 ? ((mappedHa - declared) / declared) * 100 : null;
  const hasAnswers =
    operation &&
    ((operation.species?.length ?? 0) > 0 ||
      declared !== null ||
      (operation.dataSources?.length ?? 0) > 0 ||
      (operation.goals?.length ?? 0) > 0 ||
      Boolean(operation.countsSource) ||
      Boolean(operation.farmCountRange));

  return (
    <Card>
      <SectionHeading
        description="Lo que nos contaste en el onboarding. Lo usamos para priorizar recomendaciones."
        eyebrow="Contexto"
        title="Perfil de contexto"
      />
      {!hasAnswers ? (
        <p className="text-sm text-muted">
          Este fundo no tiene respuestas de contexto (el paso “Operación” se dejó para después).
        </p>
      ) : (
        <>
          <dl className="divide-y divide-border">
            {profileRole ? <Row label="Tu rol">{labelOf(USER_ROLES, profileRole)}</Row> : null}
            <Row label="Especies">
              <ChipList items={labels(SPECIES, operation?.species)} />
            </Row>
            <Row label="Nº de fundos">{labelOf(FARM_COUNT_RANGES, operation?.farmCountRange)}</Row>
            <Row label="Hectáreas">
              <span>
                Declaradas: <strong>{declared !== null ? formatHa(declared) : "—"}</strong> · Mapeadas:{" "}
                <strong>{mappedHa > 0 ? formatHa(mappedHa) : "—"}</strong>
              </span>
            </Row>
            <Row label="Fuentes de datos">
              <ChipList items={labels(DATA_SOURCES, operation?.dataSources)} />
            </Row>
            <Row label="Conteos hoy">{labelOf(COUNTS_SOURCES, operation?.countsSource)}</Row>
            <Row label="Objetivos">
              <ChipList items={labels(GOALS, operation?.goals)} />
            </Row>
          </dl>
          {diffPct !== null && Math.abs(diffPct) > 20 ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
              <strong>Observación:</strong> declaraste {formatHa(declared)} pero los cuarteles mapeados suman{" "}
              {formatHa(mappedHa)} ({diffPct > 0 ? "+" : "−"}
              {formatPercent(Math.abs(diffPct))}). Puede que falten cuarteles por cargar o que la superficie declarada
              incluya zonas sin plantar.
            </p>
          ) : null}
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Próximos pasos                                                      */
/* ------------------------------------------------------------------ */

const PRIORITY_TONE = { alta: "cherry", media: "amber", baja: "neutral" } as const;

export function RecommendationsCard({ recommendations }: { recommendations: Recommendation[] }) {
  return (
    <Card>
      <SectionHeading
        description="Sugerencias según tu perfil de contexto y el estado de tus datos."
        eyebrow="Siguiente paso"
        title="Próximos pasos recomendados"
      />
      {recommendations.length === 0 ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-forest">
          Tu fundo está completo. No hay acciones pendientes por ahora.
        </p>
      ) : (
        <ol className="grid gap-3 md:grid-cols-2">
          {recommendations.slice(0, 6).map((rec) => (
            <li key={rec.id} className="flex gap-3 rounded-xl border border-border p-4">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mist text-lg"
              >
                {rec.icon}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{rec.title}</h3>
                  <Chip tone={PRIORITY_TONE[rec.priority]}>Prioridad {rec.priority}</Chip>
                </div>
                <p className="mt-1 text-sm leading-6 text-foreground/80">{rec.description}</p>
                <p className="mt-1 text-xs text-muted">Por qué: {rec.reason}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function NoBlocksState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center sm:px-10">
      <div
        aria-hidden="true"
        className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-mist text-2xl text-forest"
      >
        ▦
      </div>
      <h2 className="font-serif text-2xl font-bold">Este fundo aún no tiene cuarteles</h2>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted">
        Carga el mapa (KML o GeoJSON) y la planilla de cuarteles para ver superficie, variedades, edad del huerto y tus
        primeros hallazgos. Puedes usar los archivos de ejemplo del asistente.
      </p>
      <div className="mt-6 flex justify-center">
        <Link className={linkButtonClasses.primary} href="/onboarding?nuevo=1">
          Abrir el asistente
        </Link>
      </div>
    </div>
  );
}
