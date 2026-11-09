"use client";

import { useRef, useState, type DragEvent } from "react";
import { DEMO_FILES, TARGET_FIELDS } from "@/lib/onboarding/catalogs";
import { parseSpreadsheetFile, SpreadsheetError, type ParsedSpreadsheet } from "@/lib/onboarding/spreadsheet";

const DEMO_XLSX = "/demo/planilla-cuarteles-demo.xlsx";

export function UploadDropzone({
  onParsed,
  mapBlockCount,
  onCancel,
}: {
  onParsed: (fileName: string, parsed: ParsedSpreadsheet) => void;
  /** Cantidad de cuarteles que trae el mapa (para el mensaje de contexto). */
  mapBlockCount: number;
  onCancel?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFields, setShowFields] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setLoading(`Leyendo ${file.name}…`);
    try {
      const parsed = await parseSpreadsheetFile(file);
      onParsed(file.name, parsed);
    } catch (err) {
      setError(err instanceof SpreadsheetError ? err.message : "No pudimos leer el archivo. Intenta con otro formato (.xlsx o .csv).");
    } finally {
      setLoading(null);
    }
  }

  async function loadDemo() {
    setError(null);
    setLoading("Cargando planilla de ejemplo…");
    try {
      const response = await fetch(DEMO_FILES.csv);
      if (!response.ok) throw new Error(String(response.status));
      const blob = await response.blob();
      const file = new File([blob], "planilla-cuarteles-demo.csv", { type: "text/csv" });
      const parsed = await parseSpreadsheetFile(file);
      onParsed(file.name, parsed);
    } catch {
      setError("No pudimos cargar la planilla de ejemplo. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setLoading(null);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="space-y-5">
      {mapBlockCount > 0 ? (
        <div className="rounded-2xl border border-forest/20 bg-mist px-4 py-3 text-sm text-forest-dark">
          Tu mapa tiene <strong>{mapBlockCount} cuarteles</strong>. Usaremos el código de cada fila para unirla con su polígono.
        </div>
      ) : null}

      <div
        className={`flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging ? "border-forest bg-mist" : "border-border bg-card"
        }`}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDrop={onDrop}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mist text-2xl text-forest" aria-hidden>
          ⇪
        </div>
        <div>
          <p className="font-semibold text-foreground">Arrastra tu planilla aquí</p>
          <p className="mt-1 text-sm text-muted">
            Excel (.xlsx) o CSV · hasta 5 MB · no necesitas cambiar el nombre de tus columnas
          </p>
        </div>
        {loading ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-forest" role="status">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-forest border-t-transparent" />
            {loading}
          </p>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-white px-5 text-sm font-semibold hover:bg-mist"
              onClick={() => inputRef.current?.click()}
              type="button"
            >
              Elegir archivo
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-forest bg-forest px-5 text-sm font-semibold text-white hover:bg-forest-dark"
              onClick={loadDemo}
              type="button"
            >
              Usar planilla de ejemplo
            </button>
          </div>
        )}
        <input
          accept=".xlsx,.xlsm,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = "";
          }}
          ref={inputRef}
          type="file"
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          <strong>No pudimos importar el archivo.</strong> {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <button
          className="font-semibold text-forest underline-offset-4 hover:underline"
          onClick={() => setShowFields((v) => !v)}
          type="button"
        >
          {showFields ? "Ocultar" : "¿Qué columnas necesita mi planilla?"}
        </button>
        <span className="text-muted">
          Descarga el ejemplo:{" "}
          <a className="font-semibold text-forest hover:underline" download href={DEMO_FILES.csv}>
            CSV
          </a>{" "}
          ·{" "}
          <a className="font-semibold text-forest hover:underline" download href={DEMO_XLSX}>
            Excel
          </a>
        </span>
      </div>

      {showFields ? (
        <div className="grid gap-2 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
          {TARGET_FIELDS.map((field) => (
            <div className="rounded-xl bg-background px-3 py-2" key={field.id}>
              <p className="text-sm font-semibold">
                {field.label}{" "}
                {field.required ? (
                  <span className="rounded-full bg-cherry/10 px-2 py-0.5 text-[11px] font-semibold text-cherry">obligatorio</span>
                ) : (
                  <span className="text-[11px] text-muted">opcional</span>
                )}
              </p>
              <p className="text-xs text-muted">{field.why}</p>
            </div>
          ))}
        </div>
      ) : null}

      {onCancel ? (
        <button className="text-sm font-semibold text-muted hover:text-forest" onClick={onCancel} type="button">
          ← Volver a la planilla anterior
        </button>
      ) : null}
    </div>
  );
}
