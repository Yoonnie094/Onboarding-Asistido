"use client";

import "leaflet/dist/leaflet.css";
import "./blocks-map.css";

import type * as Leaflet from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BlockGeometry } from "@/lib/onboarding/types";

export type MapBlock = {
  code: string;
  label?: string | null;
  geometry: BlockGeometry | null;
  /** Color de relleno (hex). Si no se indica, se usa el color por defecto. */
  color?: string;
  /** Texto extra para el popup (variedad, año, etc.). */
  details?: string[];
};

export type BlocksMapProps = {
  blocks: MapBlock[];
  /** Alto en px (por defecto 380). */
  height?: number;
  /** Códigos a destacar (borde más grueso). */
  highlightCodes?: string[];
  onSelect?: (code: string) => void;
  /** Usar imagen satelital (Esri) en vez de mapa base OSM. Por defecto true. */
  satellite?: boolean;
};

type LeafletModule = typeof Leaflet;

const DEFAULT_COLOR = "#1f6b4a";
const HIGHLIGHT_COLOR = "#facc15";
/** Vista inicial cuando no hay cuarteles: zona central de Chile (Rengo, O'Higgins). */
const DEFAULT_CENTER: [number, number] = [-34.405, -70.862];

const BASE_LAYERS = {
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    options: {
      attribution: "Imágenes &copy; Esri, Maxar, Earthstar Geographics",
      maxNativeZoom: 18,
      maxZoom: 20,
    },
  },
  streets: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxNativeZoom: 19,
      maxZoom: 20,
    },
  },
} as const;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);
}

/** GeoJSON [lon, lat] -> Leaflet [lat, lon]; Polygon -> anillos, MultiPolygon -> lista de polígonos. */
function toLatLngs(geometry: BlockGeometry): Leaflet.LatLngExpression[][] | Leaflet.LatLngExpression[][][] {
  const ring = (r: number[][]) => r.map((p) => [p[1], p[0]] as [number, number]);
  if (geometry.type === "Polygon") return geometry.coordinates.map(ring);
  return geometry.coordinates.map((polygon) => polygon.map(ring));
}

function popupHtml(block: MapBlock): string {
  const title = block.label && block.label !== block.code ? `<span class="cer-popup-title">${escapeHtml(block.label)}</span>` : "";
  const details = block.details?.length
    ? `<ul class="cer-popup-details">${block.details.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>`
    : "";
  return `<span class="cer-popup-code">${escapeHtml(block.code)}</span>${title}${details}`;
}

/**
 * Mapa de cuarteles con Leaflet (solo cliente). Dibuja cada cuartel como polígono con su código,
 * ajusta la vista a todos los polígonos y permite destacar y seleccionar cuarteles.
 */
export function BlocksMap({ blocks, height = 380, highlightCodes, onSelect, satellite = true }: BlocksMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const baseLayerRef = useRef<Leaflet.TileLayer | null>(null);
  const blocksLayerRef = useRef<Leaflet.FeatureGroup | null>(null);
  const lastFitKeyRef = useRef<string>("");
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [useSatellite, setUseSatellite] = useState(satellite);
  const [lastSatelliteProp, setLastSatelliteProp] = useState(satellite);

  // Si el padre cambia la prop, la respetamos (sin perder el toggle interno en otros casos).
  if (lastSatelliteProp !== satellite) {
    setLastSatelliteProp(satellite);
    setUseSatellite(satellite);
  }

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const drawable = useMemo(() => blocks.filter((b) => b.geometry !== null), [blocks]);
  const highlightKey = (highlightCodes ?? []).join("|");
  /** Cambia solo si cambian las geometrías (no al destacar), para no re-encuadrar sin motivo. */
  const fitKey = useMemo(
    () => drawable.map((b) => `${b.code}:${JSON.stringify(b.geometry).length}`).join("|"),
    [drawable],
  );

  // 1) Crear el mapa una sola vez (compatible con StrictMode: cleanup destruye la instancia).
  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    import("leaflet")
      .then((mod) => {
        const L = ((mod as unknown as { default?: LeafletModule }).default ?? mod) as LeafletModule;
        const container = containerRef.current;
        if (cancelled || !container || mapRef.current) return;
        leafletRef.current = L;
        const map = L.map(container, {
          center: DEFAULT_CENTER,
          zoom: 14,
          zoomControl: true,
          scrollWheelZoom: false,
          attributionControl: true,
        });
        map.attributionControl.setPrefix(false);
        L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
        // Activa el zoom con rueda solo después de hacer clic (evita "secuestrar" el scroll de la página).
        map.once("click", () => map.scrollWheelZoom.enable());
        blocksLayerRef.current = L.featureGroup().addTo(map);
        mapRef.current = map;
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => map.invalidateSize());
          resizeObserver.observe(container);
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      blocksLayerRef.current = null;
      baseLayerRef.current = null;
      lastFitKeyRef.current = "";
      setReady(false);
    };
  }, []);

  // 2) Capa base (satélite u OSM).
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!ready || !map || !L) return;
    baseLayerRef.current?.remove();
    const config = useSatellite ? BASE_LAYERS.satellite : BASE_LAYERS.streets;
    const layer = L.tileLayer(config.url, { ...config.options });
    layer.addTo(map);
    layer.bringToBack();
    baseLayerRef.current = layer;
  }, [ready, useSatellite]);

  // 3) Polígonos de cuarteles.
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    const group = blocksLayerRef.current;
    if (!ready || !map || !L || !group) return;

    group.clearLayers();
    const highlighted = new Set(highlightKey ? highlightKey.split("|") : []);

    for (const block of drawable) {
      if (!block.geometry) continue;
      const isHighlighted = highlighted.has(block.code);
      const fillColor = block.color ?? DEFAULT_COLOR;
      const baseStyle: Leaflet.PathOptions = {
        color: isHighlighted ? HIGHLIGHT_COLOR : "#ffffff",
        weight: isHighlighted ? 4 : 1.5,
        opacity: 1,
        fillColor,
        fillOpacity: isHighlighted ? 0.6 : 0.45,
      };
      const polygon = L.polygon(toLatLngs(block.geometry), baseStyle);
      polygon.bindTooltip(escapeHtml(block.code), {
        permanent: true,
        direction: "center",
        className: `cer-block-label${isHighlighted ? " is-highlighted" : ""}`,
        opacity: 1,
      });
      polygon.bindPopup(popupHtml(block), { closeButton: true, autoPanPadding: [24, 24] });
      polygon.on("mouseover", () => polygon.setStyle({ fillOpacity: 0.7 }));
      polygon.on("mouseout", () => polygon.setStyle({ fillOpacity: baseStyle.fillOpacity }));
      polygon.on("click", () => onSelectRef.current?.(block.code));
      polygon.addTo(group);
      if (isHighlighted) polygon.bringToFront();
    }

    if (drawable.length > 0 && lastFitKeyRef.current !== fitKey) {
      const bounds = group.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [28, 28], maxZoom: 18, animate: false });
        lastFitKeyRef.current = fitKey;
      }
    }
  }, [ready, drawable, fitKey, highlightKey]);

  const isEmpty = drawable.length === 0;

  return (
    <div
      className="cer-map relative isolate overflow-hidden rounded-2xl border border-border bg-mist"
      style={{ height }}
    >
      <div ref={containerRef} className="absolute inset-0" aria-label="Mapa de cuarteles" role="region" />

      {ready ? (
        <div className="absolute right-3 top-3 z-[1000] flex overflow-hidden rounded-lg border border-white/70 bg-white/90 text-xs font-semibold shadow-sm backdrop-blur">
          <button
            className={`px-3 py-1.5 transition-colors ${useSatellite ? "bg-forest text-white" : "text-foreground hover:bg-mist"}`}
            onClick={() => setUseSatellite(true)}
            type="button"
          >
            Satélite
          </button>
          <button
            className={`px-3 py-1.5 transition-colors ${!useSatellite ? "bg-forest text-white" : "text-foreground hover:bg-mist"}`}
            onClick={() => setUseSatellite(false)}
            type="button"
          >
            Mapa
          </button>
        </div>
      ) : null}

      {!ready && !loadError ? (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-mist text-sm text-muted">
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-forest/30 border-t-forest" />
            Cargando mapa…
          </span>
        </div>
      ) : null}

      {loadError ? (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-mist p-6 text-center text-sm text-muted">
          No pudimos cargar el mapa. Revisa tu conexión y recarga la página.
        </div>
      ) : null}

      {ready && isEmpty ? (
        <div className="pointer-events-none absolute inset-0 z-[999] flex items-center justify-center bg-forest-dark/35 p-6">
          <div className="max-w-xs rounded-2xl border border-white/60 bg-white/95 px-5 py-4 text-center shadow-lg">
            <p className="font-serif text-lg text-forest">Aún no hay cuarteles en el mapa</p>
            <p className="mt-1 text-sm text-muted">Sube un archivo KML o GeoJSON para ver aquí los polígonos de tu fundo.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
