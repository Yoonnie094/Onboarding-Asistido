// Utilidades geográficas sin dependencias (WGS84, lon/lat en grados).
import type { Position } from "geojson";
import type { BlockGeometry } from "@/lib/onboarding/types";

/** Radio ecuatorial WGS84 en metros (mismo valor que usa turf/mapbox para áreas). */
const EARTH_RADIUS_M = 6378137;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Área esférica de un anillo (m², siempre positiva).
 * Fórmula de exceso esférico de Chamberlain & Duquette (NASA JPL, 2007).
 */
export function ringAreaM2(ring: Position[]): number {
  const n = ring.length;
  if (n < 3) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % n];
    total += toRad(p2[0] - p1[0]) * (2 + Math.sin(toRad(p1[1])) + Math.sin(toRad(p2[1])));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

/** Área de un polígono (anillo exterior menos agujeros), en m². */
export function polygonAreaM2(rings: Position[][]): number {
  if (rings.length === 0) return 0;
  const [outer, ...holes] = rings;
  const area = ringAreaM2(outer) - holes.reduce((sum, hole) => sum + ringAreaM2(hole), 0);
  return Math.max(area, 0);
}

/** Área de un Polygon o MultiPolygon en m². */
export function geometryAreaM2(geometry: BlockGeometry): number {
  if (geometry.type === "Polygon") return polygonAreaM2(geometry.coordinates);
  return geometry.coordinates.reduce((sum, polygon) => sum + polygonAreaM2(polygon), 0);
}

/** Área de un Polygon o MultiPolygon en hectáreas (redondeada a 2 decimales). */
export function geometryAreaHa(geometry: BlockGeometry): number {
  return Math.round((geometryAreaM2(geometry) / 10000) * 100) / 100;
}

/** Todos los anillos exteriores de la geometría. */
export function outerRings(geometry: BlockGeometry): Position[][] {
  return geometry.type === "Polygon" ? [geometry.coordinates[0] ?? []] : geometry.coordinates.map((p) => p[0] ?? []);
}

export type Bounds = { minLon: number; minLat: number; maxLon: number; maxLat: number };

/** Caja envolvente de una lista de geometrías (null si no hay coordenadas). */
export function geometriesBounds(geometries: BlockGeometry[]): Bounds | null {
  let b: Bounds | null = null;
  for (const geometry of geometries) {
    for (const ring of outerRings(geometry)) {
      for (const [lon, lat] of ring) {
        if (!b) b = { minLon: lon, minLat: lat, maxLon: lon, maxLat: lat };
        else {
          b.minLon = Math.min(b.minLon, lon);
          b.minLat = Math.min(b.minLat, lat);
          b.maxLon = Math.max(b.maxLon, lon);
          b.maxLat = Math.max(b.maxLat, lat);
        }
      }
    }
  }
  return b;
}

/** Centro aproximado (promedio de vértices del anillo exterior más grande). */
export function geometryCenter(geometry: BlockGeometry): [number, number] | null {
  const rings = outerRings(geometry);
  let best: Position[] | null = null;
  let bestArea = -1;
  for (const ring of rings) {
    const a = ringAreaM2(ring);
    if (a > bestArea) {
      bestArea = a;
      best = ring;
    }
  }
  if (!best || best.length === 0) return null;
  const pts = best.length > 1 && samePosition(best[0], best[best.length - 1]) ? best.slice(0, -1) : best;
  const lon = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [lon, lat];
}

export function samePosition(a: Position | undefined, b: Position | undefined): boolean {
  return !!a && !!b && a[0] === b[0] && a[1] === b[1];
}

/** Formatea hectáreas al estilo chileno: 1,25 ha. */
export function formatHa(value: number, decimals = 2): string {
  return `${value.toLocaleString("es-CL", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ha`;
}
