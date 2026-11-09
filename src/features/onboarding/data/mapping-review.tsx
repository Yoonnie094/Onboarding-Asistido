"use client";

import { useMemo } from "react";
import { TARGET_FIELDS } from "@/lib/onboarding/catalogs";
import { fieldLabel, missingRequiredFields, sampleValues, suggestMapping } from "@/lib/onboarding/mapping";
import type { ColumnMapping, SpreadsheetDraft, TargetField } from "@/lib/onboarding/types";

const LEVEL_STYLES = {
  alta: "bg-emerald-50 text-emerald-800 border-emerald-200",
  media: "bg-amber-50 text-amber-800 border-amber-200",
  baja: "bg-slate-50 text-slate-600 border-slate-200",
} as const;

export function MappingReview({
  sheet,
  onChangeMapping,
  onReplace,
}: {
  sheet: SpreadsheetDraft;
  onChangeMapping: (mapping: ColumnMapping) => void;
  onReplace: () => void;
}) {
  const suggestion = useMemo(() => suggestMapping(sheet.headers, sheet.rawRows), [sheet.headers, sheet.rawRows]);
  const mapping = sheet.mapping;
  const missing = missingRequiredFields(mapping);
  const mappedCount = Object.values(mapping).filter((v) => v !== "ignore").length;
  const autoCount = sheet.autoDetected.filter((h) => mapping[h] && mapping[h] === suggestion.mapping[h]).length;

  function setField(header: string, field: TargetField | "ignore") {
    const next: ColumnMapping = { ...mapping };
    if (field !== "ignore") {
      for (const [h, target] of Object.entries(next)) {
        if (target === field && h !== header) next[h] = "ignore";
      }
    }
    next[header] = field;
    onChangeMapping(next);
  }

  const owner = (field: TargetField) => Object.entries(mapping).find(([, t]) => t === field)?.[0] ?? null;
  const previewHeaders = sheet.headers;
  const previewRows = sheet.rawRows.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-mist text-lg text-forest" aria-hidden>
            ▦
          </div>
          <div>
            <p className="font-semibold">{sheet.fileName}</p>
            <p className="text-xs text-muted">
              {sheet.rawRows.length.toLocaleString("es-CL")} filas · {sheet.headers.length} columnas
              {sheet.sheetName ? ` · hoja «${sheet.sheetName}»` : ""}
            </p>
          </div>
        </div>
        <button className="text-sm font-semibold text-forest hover:underline" onClick={onReplace} type="button">
          Cambiar archivo
        </button>
      </div>

      <div>
        <h3 className="font-serif text-xl font-semibold text-foreground">Detectamos estas equivalencias. ¿Son correctas?</h3>
        <p className="mt-1 text-sm text-muted">
          ✨ Reconocimos <strong className="text-forest">{autoCount} de {sheet.headers.length}</strong> columnas automáticamente.
          Revisa y ajusta lo que necesites: tu archivo original no se modifica.
        </p>
      </div>

      {missing.length > 0 ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            missing.includes("code") ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
          role="alert"
        >
          <strong>Faltan campos obligatorios:</strong> {missing.map((f) => fieldLabel(f)).join(", ")}.{" "}
          {missing.includes("code")
            ? "Sin el código de cuartel no podemos unir la planilla con el mapa."
            : "Puedes continuar, pero esos datos quedarán marcados para completar en la validación."}
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          ✓ Todos los campos obligatorios tienen una columna asignada.
        </div>
      )}

      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        <li className="hidden grid-cols-[1.1fr_auto_1.3fr] gap-4 bg-background px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted md:grid">
          <span>Columna en tu planilla</span>
          <span />
          <span>Campo en CER Analytics</span>
        </li>
        {sheet.headers.map((header) => {
          const target = mapping[header] ?? "ignore";
          const isAuto = sheet.autoDetected.includes(header) && target !== "ignore" && target === suggestion.mapping[header];
          const conf = suggestion.confidence[header];
          const field = TARGET_FIELDS.find((f) => f.id === target);
          const samples = sampleValues(sheet.rawRows, header);
          return (
            <li
              className={`grid gap-3 px-4 py-4 md:grid-cols-[1.1fr_auto_1.3fr] md:items-start md:gap-4 ${
                target === "ignore" ? "bg-background/60" : ""
              }`}
              key={header}
            >
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{header}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {samples.length ? (
                    samples.map((value) => (
                      <span className="max-w-[10rem] truncate rounded-md bg-mist px-2 py-0.5 font-mono text-xs text-forest-dark" key={value}>
                        {value}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs italic text-muted">columna vacía</span>
                  )}
                </div>
              </div>
              <span className="hidden pt-2 text-muted md:block" aria-hidden>
                →
              </span>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <select
                    aria-label={`Campo destino para ${header}`}
                    className={`form-input min-h-10! py-2! text-sm ${target === "ignore" ? "text-muted" : "font-semibold"}`}
                    onChange={(event) => setField(header, event.target.value as TargetField | "ignore")}
                    value={target}
                  >
                    <option value="ignore">— Ignorar esta columna —</option>
                    {TARGET_FIELDS.map((f) => {
                      const takenBy = owner(f.id);
                      return (
                        <option key={f.id} value={f.id}>
                          {f.label}
                          {f.required ? " *" : ""}
                          {takenBy && takenBy !== header ? ` (ahora en «${takenBy}»)` : ""}
                        </option>
                      );
                    })}
                  </select>
                  {isAuto ? (
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${LEVEL_STYLES[conf?.level ?? "media"]}`}
                      title={conf?.reason}
                    >
                      ✨ {conf?.level === "alta" ? "Auto" : "Sugerido"}
                    </span>
                  ) : target !== "ignore" ? (
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-muted">
                      Ajustado
                    </span>
                  ) : null}
                </div>
                {field ? (
                  <p className="text-xs text-muted">
                    <span className="font-semibold text-forest">¿Por qué lo pedimos?</span> {field.why}
                  </p>
                ) : (
                  <p className="text-xs text-muted">Esta columna no se importará.</p>
                )}
                {isAuto && conf ? <p className="text-[11px] text-muted/80">{conf.reason}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-muted">
        {mappedCount} columnas se importarán · * campo obligatorio
      </p>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-foreground">Vista previa (primeras {previewRows.length} filas)</h4>
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-background text-xs">
              <tr>
                {previewHeaders.map((header) => {
                  const target = mapping[header] ?? "ignore";
                  return (
                    <th className={`whitespace-nowrap px-3 py-2 ${target === "ignore" ? "opacity-40" : ""}`} key={header}>
                      <span className="block font-semibold text-foreground">{header}</span>
                      <span className={`block font-normal ${target === "ignore" ? "text-muted" : "text-forest"}`}>
                        {target === "ignore" ? "ignorada" : `→ ${fieldLabel(target)}`}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {previewRows.map((row, index) => (
                <tr key={index}>
                  {previewHeaders.map((header) => (
                    <td
                      className={`whitespace-nowrap px-3 py-2 ${mapping[header] === "ignore" ? "text-muted/50" : ""}`}
                      key={header}
                    >
                      {row[header] || <span className="text-muted/60">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
