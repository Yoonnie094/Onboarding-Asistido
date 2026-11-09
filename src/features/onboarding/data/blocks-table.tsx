"use client";

import { IRRIGATION_TYPES, ROOTSTOCKS, VARIETIES_BY_SPECIES } from "@/lib/onboarding/catalogs";
import { formatHa, type CheckedIssue, type EditableField, type MergedEntry } from "@/lib/onboarding/validation";

const COLUMNS: { field: EditableField; label: string; width: string; list?: string; inputMode?: "numeric" | "decimal" }[] = [
  { field: "code", label: "Código", width: "w-24" },
  { field: "variety", label: "Variedad", width: "w-36", list: "dl-varieties" },
  { field: "plantingYear", label: "Año", width: "w-20", inputMode: "numeric" },
  { field: "density", label: "Plantas/ha", width: "w-24", inputMode: "numeric" },
  { field: "areaHa", label: "Ha", width: "w-20", inputMode: "decimal" },
  { field: "rootstock", label: "Portainjerto", width: "w-28", list: "dl-rootstocks" },
  { field: "irrigation", label: "Riego", width: "w-32", list: "dl-irrigation" },
];

const SOURCE_LABEL = {
  ambos: { text: "Mapa + planilla", cls: "bg-emerald-50 text-emerald-800" },
  planilla: { text: "Solo planilla", cls: "bg-amber-50 text-amber-800" },
  mapa: { text: "Solo mapa", cls: "bg-sky-50 text-sky-800" },
} as const;

function cellClasses(issues: CheckedIssue[]) {
  if (issues.some((i) => i.severity === "error")) return "border-red-400 bg-red-50 text-red-900 focus:border-red-500";
  if (issues.length) return "border-amber-400 bg-amber-50 text-amber-900 focus:border-amber-500";
  return "border-transparent bg-transparent hover:border-border focus:border-forest focus:bg-white";
}

export function BlocksTable({
  entries,
  onEdit,
  selectedKey,
  onSelect,
  species,
}: {
  entries: MergedEntry[];
  onEdit: (key: string, field: EditableField, value: string) => void;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  /** Especie para sugerir variedades en el autocompletado. */
  species: string | null;
}) {
  const varieties = (species && VARIETIES_BY_SPECIES[species]) || VARIETIES_BY_SPECIES.cereza;

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <datalist id="dl-varieties">
        {varieties.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="dl-rootstocks">
        {ROOTSTOCKS.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="dl-irrigation">
        {IRRIGATION_TYPES.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>

      <table className="min-w-full text-left text-sm">
        <thead className="bg-background text-xs font-semibold text-muted">
          <tr>
            <th className="w-8 px-2 py-2" />
            {COLUMNS.map((c) => (
              <th className="whitespace-nowrap px-1.5 py-2" key={c.field}>
                {c.label}
              </th>
            ))}
            <th className="whitespace-nowrap px-2 py-2">Origen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-sm text-muted" colSpan={COLUMNS.length + 2}>
                No hay cuarteles con problemas. ✓
              </td>
            </tr>
          ) : null}
          {entries.map((entry) => {
            const rowIssues = entry.issues.filter((i) => i.field === null || i.field === "geometry" || i.field === "species");
            const selected = selectedKey === entry.key;
            const statusDot =
              entry.status === "error" ? "bg-red-500" : entry.status === "warning" ? "bg-amber-500" : "bg-emerald-500";
            return (
              <tr
                className={`align-top transition-colors ${selected ? "bg-mist" : ""}`}
                id={`bloque-${entry.key}`}
                key={entry.key}
                onFocusCapture={() => onSelect(entry.key)}
              >
                <td className="px-2 py-2.5">
                  <span
                    className={`mt-1.5 block h-2.5 w-2.5 rounded-full ${statusDot}`}
                    title={entry.status === "ok" ? "Sin observaciones" : entry.status === "error" ? "Con errores" : "Con advertencias"}
                  />
                  {entry.rowNumber ? <span className="mt-1 block text-[10px] text-muted">#{entry.rowNumber}</span> : null}
                </td>
                {COLUMNS.map((c) => {
                  const issues = entry.issues.filter((i) => i.field === c.field);
                  const readOnly = c.field === "code" && entry.rowNumber === null;
                  const suggestion = issues.find((i) => i.suggestion)?.suggestion ?? null;
                  const placeholder =
                    c.field === "areaHa" && entry.mapAreaHa ? formatHa(entry.mapAreaHa) : issues.length ? "Completar" : "—";
                  return (
                    <td className="px-1 py-1.5" key={c.field}>
                      <input
                        aria-invalid={issues.some((i) => i.severity === "error")}
                        aria-label={`${c.label} de ${entry.block.code || `fila ${entry.rowNumber}`}`}
                        className={`${c.width} rounded-lg border px-2 py-1.5 text-sm outline-none transition-colors ${
                          readOnly ? "cursor-default font-semibold" : ""
                        } ${c.field === "code" ? "font-semibold" : ""} ${cellClasses(issues)}`}
                        inputMode={c.inputMode}
                        list={c.list}
                        onChange={(event) => onEdit(entry.key, c.field, event.target.value)}
                        placeholder={placeholder}
                        readOnly={readOnly}
                        title={issues.map((i) => i.message).join("\n") || undefined}
                        value={entry.values[c.field]}
                      />
                      {issues.length ? (
                        <p
                          className={`mt-1 max-w-[11rem] text-[11px] leading-tight ${
                            issues.some((i) => i.severity === "error") ? "text-red-700" : "text-amber-700"
                          }`}
                        >
                          {issues[0].message}
                        </p>
                      ) : null}
                      {suggestion ? (
                        <button
                          className="mt-1 rounded-md bg-forest px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-forest-dark"
                          onClick={() => onEdit(entry.key, c.field, suggestion)}
                          type="button"
                        >
                          Aplicar «{suggestion}»
                        </button>
                      ) : null}
                      {c.field === "areaHa" && entry.mapAreaHa && !issues.length ? (
                        <p className="mt-0.5 px-2 text-[10px] text-muted">mapa: {formatHa(entry.mapAreaHa)} ha</p>
                      ) : null}
                    </td>
                  );
                })}
                <td className="px-2 py-2.5">
                  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${SOURCE_LABEL[entry.block.source].cls}`}>
                    {SOURCE_LABEL[entry.block.source].text}
                  </span>
                  {rowIssues.map((issue, index) => (
                    <p
                      className={`mt-1 max-w-[13rem] text-[11px] leading-tight ${
                        issue.severity === "error" ? "text-red-700" : "text-amber-700"
                      }`}
                      key={index}
                    >
                      ⚠ {issue.message}
                    </p>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
