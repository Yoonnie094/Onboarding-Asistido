"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { BlocksMap } from "@/components/map/blocks-map";
import { Button } from "@/components/ui/button";
import { StepFooter } from "@/features/onboarding/step-footer";
import {
  CartographyParseError,
  parseCartographyFile,
  parseCartographyText,
  totalAreaHa,
  type CartographyParseResult,
} from "@/lib/onboarding/cartography";
import { DEMO_FILES } from "@/lib/onboarding/catalogs";
import { formatHa } from "@/lib/onboarding/geo";
import type { StepProps } from "@/lib/onboarding/types";

const ACCEPT = ".kml,.geojson,.json,application/vnd.google-earth.kml+xml,application/geo+json,application/json";

type LoadingSource = "file" | "demo-geojson" | "demo-kml" | null;

function formatLabel(format: "geojson" | "kml") {
  return format === "kml" ? "KML (Google Earth)" : "GeoJSON";
}

export function CartografiaStep({ draft, update, goNext, goBack, skip }: StepProps) {
  const cartography = draft.cartography;
  const hasData = !!cartography && !cartography.skipped && cartography.features.length > 0;
  const features = hasData ? cartography.features : [];

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState<LoadingSource>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  function apply(result: CartographyParseResult) {
    update({
      cartography: {
        fileName: result.fileName,
        format: result.format,
        features: result.features,
        warnings: result.warnings,
        skipped: false,
        uploadedAt: new Date().toISOString(),
      },
    });
    setSelected(null);
    setError(null);
  }

  async function run(source: Exclude<LoadingSource, null>, task: () => Promise<CartographyParseResult>) {
    setLoading(source);
    setError(null);
    try {
      apply(await task());
    } catch (e) {
      setError(
        e instanceof CartographyParseError
          ? e.message
          : "No pudimos leer el archivo. Revisa que sea un KML o GeoJSON válido e inténtalo de nuevo.",
      );
    } finally {
      setLoading(null);
    }
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    void run("file", () => parseCartographyFile(file));
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    handleFile(event.target.files?.[0]);
    event.target.value = ""; // permite volver a elegir el mismo archivo
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    handleFile(event.dataTransfer.files?.[0]);
  }

  function loadDemo(kind: "geojson" | "kml") {
    const url = DEMO_FILES[kind];
    void run(kind === "kml" ? "demo-kml" : "demo-geojson", async () => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new CartographyParseError("No encontramos el archivo de ejemplo en el servidor.");
      const name = url.split("/").pop() ?? `cuarteles-demo.${kind}`;
      return parseCartographyText(name, await response.text());
    });
  }

  function removeMap() {
    update({ cartography: null });
    setSelected(null);
    setError(null);
  }

  function handleSkip() {
    update({
      cartography: {
        fileName: cartography?.fileName ?? "",
        format: cartography?.format ?? "geojson",
        features: [],
        warnings: [],
        skipped: true,
        uploadedAt: new Date().toISOString(),
      },
    });
    skip();
  }

  const total = totalAreaHa(features);
  const busy = loading !== null;

  return (
    <div>
      <input accept={ACCEPT} className="hidden" onChange={handleInput} ref={inputRef} type="file" />

      <p className="max-w-2xl text-sm leading-6 text-muted">
        Si tienes el mapa de tus cuarteles en Google Earth o QGIS, súbelo aquí y lo verás sobre la imagen satelital.
        Cada polígono se une con tu planilla <span className="font-semibold text-foreground">por el código de cuartel</span>{" "}
        (por ejemplo, <code className="rounded bg-mist px-1 text-forest">C-01</code>).
      </p>

      {error ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          <p className="font-semibold">No pudimos usar ese archivo</p>
          <p className="mt-0.5">{error}</p>
        </div>
      ) : null}

      {!hasData ? (
        <>
          {cartography?.skipped ? (
            <div className="mt-5 rounded-xl border border-border bg-mist/60 px-4 py-3 text-sm text-muted">
              Dejaste el mapa para después. Puedes subirlo ahora o seguir sin él.
            </div>
          ) : null}

          <div
            className={`mt-5 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragOver ? "border-forest bg-forest/5" : "border-border bg-background/50"
            }`}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
              setDragOver(false);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }}
            onDrop={handleDrop}
          >
            <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mist text-forest">
              <svg fill="none" height="28" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="28">
                <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5V4l-6 2.5L9 4Z" />
                <path d="M9 4v13M15 6.5v13" />
              </svg>
            </span>
            <p className="mt-4 font-serif text-xl text-foreground">
              {loading === "file" ? "Leyendo tu mapa…" : "Arrastra aquí tu archivo de cuarteles"}
            </p>
            <p className="mt-1 text-sm text-muted">o elígelo desde tu computador</p>
            <Button className="mt-4" disabled={busy} onClick={() => inputRef.current?.click()} type="button">
              {loading === "file" ? "Leyendo…" : "Seleccionar archivo"}
            </Button>
            <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-muted">
              {[".kml", ".geojson", ".json"].map((ext) => (
                <span className="rounded-full border border-border bg-white px-2.5 py-0.5 font-semibold" key={ext}>
                  {ext}
                </span>
              ))}
              <span className="px-1 py-0.5">· hasta 15 MB · coordenadas WGS84</span>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">¿No tienes un mapa a mano?</p>
              <p className="text-xs text-muted">Prueba con el Fundo Santa Elena: 10 cuarteles de cerezo en Rengo.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => loadDemo("geojson")} type="button" variant="secondary">
                {loading === "demo-geojson" ? "Cargando…" : "Usar mapa de ejemplo (GeoJSON)"}
              </Button>
              <Button disabled={busy} onClick={() => loadDemo("kml")} type="button" variant="secondary">
                {loading === "demo-kml" ? "Cargando…" : "Usar mapa de ejemplo (KML)"}
              </Button>
            </div>
          </div>

          <details className="group mt-4 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
            <summary className="cursor-pointer select-none font-semibold text-forest">¿Cómo exporto el mapa de mis cuarteles?</summary>
            <ul className="mt-3 space-y-2 text-muted">
              <li>
                <span className="font-semibold text-foreground">Google Earth:</span> clic derecho sobre la carpeta de tus
                cuarteles → «Guardar lugar como…» → formato KML.
              </li>
              <li>
                <span className="font-semibold text-foreground">QGIS:</span> clic derecho sobre la capa → Exportar → «Guardar
                objetos como…» → formato GeoJSON y SRC EPSG:4326 (WGS84).
              </li>
              <li>
                Cada cuartel debe ser un <span className="font-semibold text-foreground">polígono</span> con su código en el
                nombre o en un campo «codigo». Los puntos y líneas se ignoran.
              </li>
            </ul>
          </details>

          <p className="mt-4 text-xs text-muted">
            ¿No tienes el mapa ahora? Usa «Completar después»: podrás dibujar o subir el mapa más adelante desde el panel del
            fundo, y tus cuarteles igual se crearán desde la planilla.
          </p>
        </>
      ) : (
        <>
          <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-forest/30 bg-forest/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest text-sm font-bold text-white">
                ✓
              </span>
              <div>
                <p className="font-semibold text-foreground">
                  Leímos {features.length} {features.length === 1 ? "cuartel" : "cuarteles"} · {formatHa(total)}
                </p>
                <p className="text-xs text-muted">
                  {cartography.fileName} · {formatLabel(cartography.format)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled={busy} onClick={() => inputRef.current?.click()} type="button" variant="secondary">
                {loading === "file" ? "Leyendo…" : "Reemplazar archivo"}
              </Button>
              <button className="text-sm font-semibold text-muted underline-offset-4 hover:text-cherry hover:underline" onClick={removeMap} type="button">
                Quitar
              </button>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Cuarteles", value: String(features.length) },
              { label: "Superficie total", value: formatHa(total, 1) },
              { label: "Promedio", value: formatHa(total / features.length, 1) },
              { label: "Formato", value: cartography.format === "kml" ? "KML" : "GeoJSON" },
            ].map((item) => (
              <div className="rounded-2xl border border-border bg-card px-4 py-3" key={item.label}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{item.label}</dt>
                <dd className="mt-1 font-serif text-2xl text-forest">{item.value}</dd>
              </div>
            ))}
          </dl>

          {cartography.warnings.length > 0 ? (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">
                {cartography.warnings.length === 1 ? "Una advertencia" : `${cartography.warnings.length} advertencias`} (puedes continuar igual)
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {cartography.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <BlocksMap
              blocks={features.map((f) => ({
                code: f.code,
                label: f.name,
                geometry: f.geometry,
                details: [`Superficie: ${formatHa(f.areaHa)}`],
              }))}
              height={420}
              highlightCodes={selected ? [selected] : []}
              onSelect={(code) => setSelected((current) => (current === code ? null : code))}
            />

            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
                <span>Código</span>
                <span>Superficie</span>
              </div>
              <ul className="max-h-[370px] overflow-y-auto">
                {features.map((f, i) => {
                  const isSelected = selected === f.code;
                  return (
                    <li key={`${f.code}-${i}`}>
                      <button
                        className={`flex w-full items-center justify-between gap-3 border-b border-border/60 px-4 py-2 text-left text-sm transition-colors last:border-b-0 ${
                          isSelected ? "bg-amber-50" : "hover:bg-mist/60"
                        }`}
                        onClick={() => setSelected(isSelected ? null : f.code)}
                        type="button"
                      >
                        <span className="min-w-0">
                          <span className={`block font-semibold ${f.code.startsWith("SIN-CODIGO") ? "text-cherry" : "text-forest"}`}>{f.code}</span>
                          {f.name ? <span className="block truncate text-xs text-muted">{f.name}</span> : null}
                        </span>
                        <span className="shrink-0 tabular-nums text-foreground">{formatHa(f.areaHa)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted">
            Toca un cuartel en el mapa o en la lista para destacarlo. En el siguiente paso uniremos cada polígono con su fila de
            la planilla usando el código.
          </p>
        </>
      )}

      <StepFooter
        busy={false}
        hint="Sube un mapa o usa el de ejemplo para continuar. También puedes completarlo después."
        nextDisabled={!hasData || busy}
        onBack={goBack}
        onNext={goNext}
        onSkip={hasData ? undefined : handleSkip}
      />
    </div>
  );
}
