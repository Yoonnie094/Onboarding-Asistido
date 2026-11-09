// Lectura y validación de cartografía de cuarteles (GeoJSON / KML).
// Se ejecuta en el navegador (el KML usa DOMParser). Sin dependencias nuevas salvo @tmcw/togeojson.

import type { Feature, GeoJsonProperties, Geometry, Position } from "geojson";
import { geometryAreaHa, geometryAreaM2, samePosition } from "@/lib/onboarding/geo";
import type { BlockGeometry, CartographyDraft, CartographyFeature } from "@/lib/onboarding/types";

export type CartographyFormat = CartographyDraft["format"];

export type CartographyParseResult = {
  fileName: string;
  format: CartographyFormat;
  features: CartographyFeature[];
  warnings: string[];
};

export type CartographyInput = File | { name: string; text: string };

/** Error "fatal" de lectura (archivo ilegible, formato no soportado). El mensaje es apto para UI. */
export class CartographyParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CartographyParseError";
  }
}

export const ACCEPTED_CARTOGRAPHY_EXTENSIONS = [".kml", ".geojson", ".json"] as const;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Código de cuartel
// ---------------------------------------------------------------------------

/** Propiedades donde buscar el código del cuartel, en orden de prioridad. */
const CODE_KEYS = ["code", "codigo", "código", "cod", "cuartel", "id_cuartel", "id", "name", "nombre"];
const NAME_KEYS = ["nombre", "name", "label", "descripcion", "descripción", "description"];

/**
 * Normaliza un código de cuartel para poder unir mapa y planilla:
 * "c1", "C 01", "c_01", "Cuartel 1", "1" -> "C-01". Otros textos quedan en mayúsculas con guiones.
 */
export function normalizeBlockCode(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase();
  if (!text) return "";
  text = text.replace(/^(CUARTEL|CUART|CTL|CTEL)\b\.?/, "C");
  if (/^\d+$/.test(text)) return `C-${text.padStart(2, "0")}`;
  const match = text.match(/^([A-Z]{1,4})[\s_\-.#]*0*(\d+)$/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}`;
  return text.replace(/[\s_]+/g, "-");
}

function findProp(props: Record<string, unknown>, keys: string[]): { key: string; value: unknown } | null {
  const lowerMap = new Map<string, string>();
  for (const k of Object.keys(props)) lowerMap.set(k.toLowerCase(), k);
  for (const key of keys) {
    const real = lowerMap.get(key);
    if (real === undefined) continue;
    const value = props[real];
    if (value === null || value === undefined || String(value).trim() === "") continue;
    return { key: real, value };
  }
  return null;
}

function cleanProperties(props: GeoJsonProperties): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  if (!props) return out;
  for (const [key, value] of Object.entries(props)) {
    // Propiedades de estilo que agrega togeojson: no aportan al cuartel.
    if (/^(fill|stroke|styleUrl|styleHash|styleMapHash|icon|visibility)/i.test(key)) continue;
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    } else if (value !== undefined) {
      out[key] = JSON.stringify(value);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Validación de geometría (reutilizable)
// ---------------------------------------------------------------------------

export type GeometryValidation = {
  /** true si quedó al menos un polígono utilizable. */
  valid: boolean;
  /** Geometría limpia (2D, anillos cerrados) o null si no es utilizable. */
  geometry: BlockGeometry | null;
  areaHa: number;
  errors: string[];
  warnings: string[];
  /** true si las coordenadas parecen proyectadas (UTM) en vez de lon/lat. */
  looksProjected: boolean;
};

function cleanRing(ring: unknown, label: string, problems: { errors: string[]; warnings: string[]; projected: boolean; reclosed: boolean }): Position[] | null {
  if (!Array.isArray(ring)) {
    problems.errors.push(`${label}: anillo sin coordenadas.`);
    return null;
  }
  const pts: Position[] = [];
  for (const raw of ring) {
    if (!Array.isArray(raw) || raw.length < 2) continue;
    const lon = Number(raw[0]);
    const lat = Number(raw[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    if (Math.abs(lon) > 180 || Math.abs(lat) > 90) {
      problems.projected = true;
      return null;
    }
    const prev = pts[pts.length - 1];
    if (prev && prev[0] === lon && prev[1] === lat) continue; // vértice duplicado consecutivo
    pts.push([lon, lat]);
  }
  if (pts.length > 1 && !samePosition(pts[0], pts[pts.length - 1])) {
    pts.push([pts[0][0], pts[0][1]]);
    problems.reclosed = true;
  }
  if (pts.length < 4) {
    problems.errors.push(`${label}: tiene menos de 3 vértices distintos, no forma un polígono.`);
    return null;
  }
  return pts;
}

/**
 * Valida y limpia una geometría de cuartel: solo Polygon/MultiPolygon, anillos cerrados,
 * ≥ 4 posiciones, lon/lat en rango (WGS84) y área > 0.
 */
export function validateBlockGeometry(geometry: Geometry | null | undefined): GeometryValidation {
  const result: GeometryValidation = { valid: false, geometry: null, areaHa: 0, errors: [], warnings: [], looksProjected: false };
  if (!geometry) {
    result.errors.push("No tiene geometría.");
    return result;
  }
  const problems = { errors: result.errors, warnings: result.warnings, projected: false, reclosed: false };

  const cleanPolygon = (rings: unknown, label: string): Position[][] | null => {
    if (!Array.isArray(rings) || rings.length === 0) {
      problems.errors.push(`${label}: polígono vacío.`);
      return null;
    }
    const outer = cleanRing(rings[0], label, problems);
    if (!outer) return null;
    const holes: Position[][] = [];
    for (let i = 1; i < rings.length; i++) {
      const hole = cleanRing(rings[i], `${label} (agujero ${i})`, problems);
      if (hole) holes.push(hole);
    }
    return [outer, ...holes];
  };

  let polygons: Position[][][] = [];
  if (geometry.type === "Polygon") {
    const p = cleanPolygon(geometry.coordinates, "Polígono");
    if (p) polygons = [p];
  } else if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach((rings, i) => {
      const p = cleanPolygon(rings, `Parte ${i + 1}`);
      if (p) polygons.push(p);
    });
  } else if (geometry.type === "GeometryCollection") {
    geometry.geometries.forEach((g, i) => {
      if (g.type === "Polygon") {
        const p = cleanPolygon(g.coordinates, `Parte ${i + 1}`);
        if (p) polygons.push(p);
      } else if (g.type === "MultiPolygon") {
        g.coordinates.forEach((rings, j) => {
          const p = cleanPolygon(rings, `Parte ${i + 1}.${j + 1}`);
          if (p) polygons.push(p);
        });
      }
    });
    if (polygons.length === 0) result.errors.push("La colección de geometrías no contiene polígonos.");
  } else {
    const kind = geometry.type === "Point" || geometry.type === "MultiPoint" ? "un punto" : "una línea";
    result.errors.push(`Es ${kind}, no un polígono.`);
    return result;
  }

  if (problems.projected) {
    result.looksProjected = true;
    result.errors.push(
      "Las coordenadas no son latitud/longitud (parecen UTM u otra proyección). Convierte el archivo a WGS84 (EPSG:4326) antes de subirlo.",
    );
    return result;
  }
  if (problems.reclosed) result.warnings.push("Algún anillo no estaba cerrado; lo cerramos automáticamente.");

  // Descarta polígonos sin área.
  polygons = polygons.filter((rings) => {
    const area = geometryAreaM2({ type: "Polygon", coordinates: rings });
    if (area <= 0.5) {
      result.errors.push("Un polígono tiene superficie 0 (vértices alineados o repetidos).");
      return false;
    }
    return true;
  });
  if (polygons.length === 0) return result;

  const clean: BlockGeometry =
    polygons.length === 1 ? { type: "Polygon", coordinates: polygons[0] } : { type: "MultiPolygon", coordinates: polygons };
  result.geometry = clean;
  result.areaHa = geometryAreaHa(clean);
  result.valid = true;
  if (result.areaHa > 200) {
    result.warnings.push(`Superficie inusualmente grande para un cuartel (${result.areaHa} ha).`);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Lectura de archivos
// ---------------------------------------------------------------------------

function detectFormat(fileName: string, text: string): CartographyFormat {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".kmz")) {
    throw new CartographyParseError("Los archivos .kmz vienen comprimidos. Ábrelo en Google Earth y expórtalo como .kml, o descomprímelo y sube el doc.kml.");
  }
  if (lower.endsWith(".shp") || lower.endsWith(".zip")) {
    throw new CartographyParseError("Por ahora no leemos Shapefile. Expórtalo como GeoJSON o KML desde QGIS (Exportar → Guardar objetos como…).");
  }
  if (lower.endsWith(".kml")) return "kml";
  if (lower.endsWith(".geojson") || lower.endsWith(".json")) return "geojson";
  const start = text.trimStart();
  if (start.startsWith("<")) return "kml";
  if (start.startsWith("{")) return "geojson";
  throw new CartographyParseError("Formato no reconocido. Sube un archivo .kml, .geojson o .json.");
}

function toFeatures(data: unknown): Feature<Geometry | null>[] {
  if (!data || typeof data !== "object") throw new CartographyParseError("El archivo no contiene un objeto GeoJSON.");
  const obj = data as { type?: string; features?: unknown; geometry?: unknown };
  if (obj.type === "FeatureCollection") {
    if (!Array.isArray(obj.features)) throw new CartographyParseError("La FeatureCollection no tiene una lista de features.");
    return obj.features as Feature<Geometry | null>[];
  }
  if (obj.type === "Feature") return [obj as Feature<Geometry | null>];
  const geometryTypes = ["Polygon", "MultiPolygon", "Point", "MultiPoint", "LineString", "MultiLineString", "GeometryCollection"];
  if (obj.type && geometryTypes.includes(obj.type)) {
    return [{ type: "Feature", properties: {}, geometry: obj as Geometry }];
  }
  throw new CartographyParseError("No encontramos geometrías: el archivo debe ser una FeatureCollection, una Feature o una geometría GeoJSON.");
}

async function kmlToFeatures(text: string): Promise<Feature<Geometry | null>[]> {
  if (typeof DOMParser === "undefined") throw new CartographyParseError("La lectura de KML solo está disponible en el navegador.");
  const doc = new DOMParser().parseFromString(text, "text/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new CartographyParseError("El KML no es un XML válido. Revisa que el archivo no esté dañado.");
  }
  const { kml } = await import("@tmcw/togeojson");
  return kml(doc).features;
}

/** Convierte features GeoJSON crudas en cuarteles validados, con advertencias legibles. */
export function featuresToBlocks(raw: Feature<Geometry | null>[]): { features: CartographyFeature[]; warnings: string[] } {
  const warnings: string[] = [];
  const features: CartographyFeature[] = [];
  let missingCodes = 0;
  let ignoredNonPolygons = 0;
  let projectedCount = 0;
  const seen = new Map<string, number>();

  raw.forEach((feature, index) => {
    const props = (feature?.properties ?? {}) as Record<string, unknown>;
    const codeProp = findProp(props, CODE_KEYS);
    const rawCode = codeProp?.value ?? (feature?.id !== undefined ? feature.id : null);
    const label = codeProp ? `«${String(codeProp.value)}»` : `#${index + 1}`;

    const check = validateBlockGeometry(feature?.geometry ?? null);
    if (!check.valid || !check.geometry) {
      if (check.looksProjected) projectedCount++;
      else if (feature?.geometry && !["Polygon", "MultiPolygon", "GeometryCollection"].includes(feature.geometry.type)) ignoredNonPolygons++;
      else warnings.push(`Elemento ${label} descartado: ${check.errors.join(" ")}`);
      return;
    }

    let code = normalizeBlockCode(rawCode);
    if (!code) {
      missingCodes++;
      code = `SIN-CODIGO-${missingCodes}`;
    }
    const count = (seen.get(code) ?? 0) + 1;
    seen.set(code, count);

    const nameProp = findProp(
      props,
      NAME_KEYS.filter((k) => k !== codeProp?.key.toLowerCase()),
    );
    const name = nameProp && String(nameProp.value).trim() !== String(rawCode ?? "").trim() ? String(nameProp.value).trim() : null;

    for (const w of check.warnings) warnings.push(`Cuartel ${code}: ${w}`);
    features.push({
      code,
      name,
      geometry: check.geometry,
      areaHa: check.areaHa,
      properties: cleanProperties(feature?.properties ?? null),
    });
  });

  if (projectedCount > 0) {
    warnings.unshift(
      `${projectedCount} ${projectedCount === 1 ? "polígono tiene" : "polígonos tienen"} coordenadas que no son latitud/longitud (parecen UTM). Convierte el archivo a WGS84 (EPSG:4326) y vuelve a subirlo.`,
    );
  }
  if (ignoredNonPolygons > 0) {
    warnings.push(
      `Ignoramos ${ignoredNonPolygons} ${ignoredNonPolygons === 1 ? "elemento que no es polígono" : "elementos que no son polígonos"} (puntos o líneas).`,
    );
  }
  if (missingCodes > 0) {
    warnings.push(
      `${missingCodes} ${missingCodes === 1 ? "cuartel no tiene código; le asignamos" : "cuarteles no tienen código; les asignamos"} SIN-CODIGO-n. Sin código no se pueden unir con la planilla.`,
    );
  }
  const duplicated = [...seen.entries()].filter(([, n]) => n > 1);
  if (duplicated.length > 0) {
    warnings.push(
      `Códigos repetidos en el mapa: ${duplicated.map(([c, n]) => `${c} (${n} veces)`).join(", ")}. Cada cuartel debería tener un código único.`,
    );
  }
  return { features, warnings };
}

/** Lee texto ya cargado (útil para archivos de ejemplo obtenidos con fetch). */
export async function parseCartographyText(fileName: string, text: string): Promise<CartographyParseResult> {
  if (!text.trim()) throw new CartographyParseError("El archivo está vacío.");
  const format = detectFormat(fileName, text);
  let raw: Feature<Geometry | null>[];
  if (format === "geojson") {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new CartographyParseError("El archivo no es un JSON válido. Revisa que sea un GeoJSON exportado correctamente.");
    }
    raw = toFeatures(data);
  } else {
    raw = await kmlToFeatures(text);
  }
  if (raw.length === 0) throw new CartographyParseError("El archivo no contiene elementos geográficos.");
  const { features, warnings } = featuresToBlocks(raw);
  if (features.length === 0) {
    throw new CartographyParseError(
      warnings[0] ?? "No encontramos polígonos válidos en el archivo. Cada cuartel debe ser un polígono.",
    );
  }
  return { fileName, format, features, warnings };
}

/** Lee un archivo de cartografía (.kml, .geojson, .json) y devuelve cuarteles validados. */
export async function parseCartographyFile(input: CartographyInput): Promise<CartographyParseResult> {
  if (typeof File !== "undefined" && input instanceof File) {
    if (input.size > MAX_FILE_BYTES) throw new CartographyParseError("El archivo supera 15 MB. Simplifica las geometrías o divide el mapa.");
    return parseCartographyText(input.name, await input.text());
  }
  const { name, text } = input as { name: string; text: string };
  return parseCartographyText(name, text);
}

/** Superficie total de los cuarteles, en ha. */
export function totalAreaHa(features: CartographyFeature[]): number {
  return Math.round(features.reduce((s, f) => s + f.areaHa, 0) * 100) / 100;
}
