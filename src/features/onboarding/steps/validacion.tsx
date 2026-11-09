"use client";

import { useMemo, useState } from "react";
import { BlocksMap, type MapBlock } from "@/components/map/blocks-map";
import { BlocksTable } from "@/features/onboarding/data/blocks-table";
import { QualityCard } from "@/features/onboarding/data/quality-card";
import { StepFooter } from "@/features/onboarding/step-footer";
import type { SpreadsheetDraft, StepProps } from "@/lib/onboarding/types";
import {
  formatHa,
  groupIssues,
  speciesLabel,
  validateAndMerge,
  type CellEdits,
  type EditableField,
  type IssueGroup,
  type SpreadsheetDraftWithEdits,
} from "@/lib/onboarding/validation";

const STATUS_COLORS = { ok: "#16a34a", warning: "#f59e0b", error: "#dc2626" } as const;

function placeholderSheet(): SpreadsheetDraftWithEdits {
  return {
    fileName: "",
    sheetName: null,
    headers: [],
    rawRows: [],
    mapping: {},
    autoDetected: [],
    mappingConfirmed: false,
    skipped: true,
    uploadedAt: new Date().toISOString(),
  };
}

export function ValidacionStep({ draft, update, goNext, goBack, skip }: StepProps) {
  const speciesDefault = draft.operation.species[0] ?? "cereza";
  const result = useMemo(
    () =>
      validateAndMerge({
        spreadsheet: draft.spreadsheet,
        cartography: draft.cartography,
        speciesDefault,
      }),
    [draft.spreadsheet, draft.cartography, speciesDefault],
  );

  const [initialScore] = useState<number | null>(() => result.quality?.qualityScore ?? null);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [kindFilter, setKindFilter] = useState<IssueGroup | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const groups = useMemo(() => groupIssues(result.issues), [result.issues]);
  const errorIssues = result.issues.filter((i) => i.severity === "error").length;
  const problemCount = result.entries.filter((e) => e.status !== "ok").length;
  const edits: CellEdits = (draft.spreadsheet as SpreadsheetDraftWithEdits | null)?.edits ?? {};
  const editCount = Object.values(edits).reduce((n, e) => n + Object.keys(e).length, 0);

  const visibleEntries = result.entries.filter((entry) => {
    if (kindFilter) return entry.issues.some((i) => i.kind === kindFilter.kind);
    if (onlyProblems) return entry.status !== "ok";
    return true;
  });

  const mapBlocks: MapBlock[] = useMemo(
    () =>
      result.entries
        .filter((e) => e.block.geometry)
        .map((e) => ({
          code: e.block.code,
          label: e.block.name,
          geometry: e.block.geometry,
          color: STATUS_COLORS[e.status],
          details: [
            [e.block.variety ?? "Sin variedad", e.block.plantingYear ? String(e.block.plantingYear) : null]
              .filter(Boolean)
              .join(" · "),
            e.block.areaHa ? `${formatHa(e.block.areaHa)} ha` : "",
            e.status === "ok" ? "✓ Sin observaciones" : `${e.issues.length} observación(es)`,
          ].filter(Boolean),
        })),
    [result.entries],
  );
  const selectedCode = result.entries.find((e) => e.key === selectedKey)?.block.code ?? null;

  function setEdit(key: string, field: EditableField, value: string) {
    const base: SpreadsheetDraftWithEdits = (draft.spreadsheet as SpreadsheetDraftWithEdits | null) ?? placeholderSheet();
    const nextEdits: CellEdits = { ...(base.edits ?? {}) };
    nextEdits[key] = { ...(nextEdits[key] ?? {}), [field]: value };
    const next: SpreadsheetDraftWithEdits = { ...base, edits: nextEdits };
    update({ spreadsheet: next as SpreadsheetDraft });
  }

  function resetEdits() {
    if (!draft.spreadsheet) return;
    const next: SpreadsheetDraftWithEdits = { ...draft.spreadsheet, edits: {} };
    update({ spreadsheet: next as SpreadsheetDraft });
  }

  function selectFromMap(code: string) {
    const entry = result.entries.find((e) => e.block.code === code);
    if (!entry) return;
    setKindFilter(null);
    setOnlyProblems(false);
    setSelectedKey(entry.key);
    requestAnimationFrame(() => {
      document.getElementById(`bloque-${entry.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function handleContinue() {
    update({ blocks: result.blocks, quality: result.quality });
    goNext();
  }

  function handleSkip() {
    const okKeys = new Set(result.entries.filter((e) => e.status !== "error").map((e) => e.key));
    update({
      blocks: result.entries.filter((e) => okKeys.has(e.key)).map((e) => e.block),
      quality: result.quality,
    });
    skip();
  }

  // Sin mapa ni planilla.
  if (!result.hasCartography && !result.hasSpreadsheet) {
    return (
      <div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="font-serif text-xl font-semibold">No hay cuarteles para revisar</p>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Omitiste el mapa y la planilla. Puedes continuar: tu fundo se creará sin cuarteles y podrás cargarlos más
            adelante desde la configuración del fundo. También puedes volver atrás y usar los archivos de ejemplo.
          </p>
        </div>
        <StepFooter
          onBack={goBack}
          onNext={() => {
            update({ blocks: [], quality: null });
            goNext();
          }}
          nextLabel="Continuar sin cuarteles"
        />
      </div>
    );
  }

  const withGeometry = result.entries.filter((e) => e.block.geometry).length;

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted">
        Unimos tu {result.hasCartography ? "mapa" : ""}
        {result.hasCartography && result.hasSpreadsheet ? " y tu " : ""}
        {result.hasSpreadsheet ? "planilla" : ""} en <strong className="text-foreground">{result.entries.length} cuarteles</strong>.
        Corrige aquí mismo lo que esté marcado: los cambios se revisan al instante y se guardan en tu borrador.
      </p>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {result.quality ? (
          <QualityCard
            groups={groups}
            initialScore={initialScore}
            onSelectGroup={(group) => {
              setOnlyProblems(false);
              setKindFilter((current) => (current?.kind === group.kind ? null : group));
            }}
            quality={result.quality}
          />
        ) : (
          <section className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Solo mapa</p>
            <p className="mt-2 font-serif text-xl font-semibold">{result.entries.length} cuarteles desde tu cartografía</p>
            <p className="mt-2 text-sm text-muted">
              No subiste planilla, así que no calculamos el puntaje de calidad. Los cuarteles se crearán con su polígono
              y superficie; puedes completar variedad, año y densidad en la tabla o más adelante.
            </p>
            <p className="mt-3 text-xs text-muted">Especie asumida: {speciesLabel(speciesDefault)}</p>
          </section>
        )}

        <section className="rounded-2xl border border-border bg-card p-3">
          {withGeometry > 0 ? (
            <>
              <BlocksMap
                blocks={mapBlocks}
                height={320}
                highlightCodes={selectedCode ? [selectedCode] : []}
                onSelect={selectFromMap}
              />
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-muted">
                <Legend color={STATUS_COLORS.ok} label="Sin observaciones" />
                <Legend color={STATUS_COLORS.warning} label="Advertencia" />
                <Legend color={STATUS_COLORS.error} label="Error" />
                <span className="ml-auto">Haz clic en un cuartel para ubicarlo en la tabla</span>
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-xl bg-mist p-6 text-center text-sm text-muted">
              <p className="font-semibold text-foreground">Sin mapa de cuarteles</p>
              <p className="mt-1 max-w-xs">
                Los cuarteles se crearán sin geometría. Puedes volver al paso Cartografía para subir tu KML o GeoJSON.
              </p>
            </div>
          )}
        </section>
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h3 className="font-serif text-lg font-semibold">Cuarteles</h3>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm">
            <input
              checked={onlyProblems}
              className="accent-forest"
              onChange={(event) => {
                setKindFilter(null);
                setOnlyProblems(event.target.checked);
              }}
              type="checkbox"
            />
            Solo con problemas ({problemCount})
          </label>
          {kindFilter ? (
            <button
              className="rounded-full bg-forest/10 px-3 py-1.5 text-sm font-semibold text-forest"
              onClick={() => setKindFilter(null)}
              type="button"
            >
              {kindFilter.label} ✕
            </button>
          ) : null}
          {editCount > 0 ? (
            <button className="ml-auto text-sm font-semibold text-muted hover:text-forest" onClick={resetEdits} type="button">
              Deshacer mis {editCount} correcciones
            </button>
          ) : null}
        </div>
        <BlocksTable
          entries={visibleEntries}
          onEdit={setEdit}
          onSelect={setSelectedKey}
          selectedKey={selectedKey}
          species={speciesDefault}
        />
        <p className="mt-2 text-[11px] text-muted">
          Reglas de validación de demostración (rangos de referencia, no reglas aprobadas por CER): año{" "}
          1980–{new Date().getFullYear()}, densidad 100–5.000 plantas/ha, diferencia de superficie mapa/planilla ≤ 15%.
        </p>
      </section>

      <StepFooter
        hint={
          errorIssues > 0
            ? `Corrige ${errorIssues} ${errorIssues === 1 ? "error" : "errores"} para continuar. Las advertencias no bloquean.`
            : null
        }
        nextDisabled={errorIssues > 0}
        nextLabel={`Continuar con ${result.entries.length} cuarteles`}
        onBack={goBack}
        onNext={handleContinue}
        onSkip={handleSkip}
      />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
