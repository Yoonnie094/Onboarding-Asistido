// Validación y cruce mapa <-> planilla de los cuarteles.
//
// IMPORTANTE: estas reglas son de DEMOSTRACIÓN para la clase. No son reglas de calidad
// aprobadas por CER; los rangos de referencia están en VALIDATION_RANGES (catalogs.ts).
//
// Correcciones en línea: el paso "validacion" guarda las ediciones del usuario en un campo
// OPCIONAL adicional `draft.spreadsheet.edits` (ver SpreadsheetDraftWithEdits). No modifica
// rawRows: las ediciones se aplican encima al validar. complete_onboarding no lee este campo
// (lee draft.blocks, que ya trae los valores corregidos).

import {
  IRRIGATION_TYPES,
  ROOTSTOCKS,
  SPECIES,
  VALIDATION_RANGES,
  VARIETIES_BY_SPECIES,
} from "@/lib/onboarding/catalogs";
import { columnFor, normalizeText } from "@/lib/onboarding/mapping";
import type {
  BlockRecord,
  CartographyDraft,
  CartographyFeature,
  QualitySummary,
  SpreadsheetDraft,
  TargetField,
  ValidationIssue,
} from "@/lib/onboarding/types";

/** Ediciones por fila: clave `row:<índice 0-based en rawRows>` o `map:<código>` (cuartel solo en el mapa). */
export type CellEdits = Record<string, Partial<Record<TargetField, string>>>;

/** SpreadsheetDraft + campo opcional con las correcciones hechas en el paso "validacion". */
export type SpreadsheetDraftWithEdits = SpreadsheetDraft & { edits?: CellEdits };

export type IssueKind =
  | "codigo_vacio"
  | "codigo_duplicado"
  | "variedad_vacia"
  | "variedad_desconocida"
  | "especie_asumida"
  | "especie_desconocida"
  | "anio_vacio"
  | "anio_invalido"
  | "densidad_vacia"
  | "densidad_invalida"
  | "superficie_invalida"
  | "superficie_diferente"
  | "sin_geometria"
  | "sin_datos_planilla";

/** ValidationIssue con datos extra para la UI (se guarda igual en quality.issues; los campos extra son inocuos). */
export type CheckedIssue = ValidationIssue & {
  kind: IssueKind;
  /** Clave de la fila editable (`row:N` / `map:CODE`) o null si es un aviso global. */
  entryKey: string | null;
};

export type EntryStatus = "ok" | "warning" | "error";

export type MergedEntry = {
  key: string;
  /** 1 = primera fila de datos; null si el cuartel viene solo del mapa. */
  rowNumber: number | null;
  block: BlockRecord;
  /** Superficie calculada desde el mapa (si hay polígono). */
  mapAreaHa: number | null;
  /** Valores tal como se muestran en la tabla editable (texto). */
  values: Record<EditableField, string>;
  issues: CheckedIssue[];
  status: EntryStatus;
};

export const EDITABLE_FIELDS = [
  "code",
  "variety",
  "plantingYear",
  "density",
  "areaHa",
  "rootstock",
  "irrigation",
] as const satisfies readonly TargetField[];
export type EditableField = (typeof EDITABLE_FIELDS)[number];

export type ValidationInput = {
  spreadsheet: SpreadsheetDraft | null;
  cartography: CartographyDraft | null;
  /** Especie por defecto (primera del paso "operación"), p.ej. "cereza". */
  speciesDefault: string | null;
};

export type ValidationResult = {
  blocks: BlockRecord[];
  issues: CheckedIssue[];
  /** null si no hay planilla (solo mapa o nada). */
  quality: QualitySummary | null;
  entries: MergedEntry[];
  hasSpreadsheet: boolean;
  hasCartography: boolean;
};

// ---------------------------------------------------------------------------
// Utilidades

/** Interpreta números con formato chileno: "1,8" -> 1.8, "1.250" -> 1250 (si integerLike), "1.234,5" -> 1234.5 */
export function parseLocaleNumber(raw: string | null | undefined, integerLike = false): number | null {
  if (raw === null || raw === undefined) return null;
  let value = String(raw).trim().replace(/\s/g, "");
  if (!value) return null;
  value = value.replace(/[^\d.,-]/g, "");
  if (!value) return null;
  if (value.includes(",") && value.includes(".")) {
    value = value.replace(/\./g, "").replace(",", ".");
  } else if (value.includes(",")) {
    value = /^-?\d{1,3}(,\d{3})+$/.test(value) && integerLike ? value.replace(/,/g, "") : value.replace(",", ".");
  } else if (integerLike && /^-?\d{1,3}(\.\d{3})+$/.test(value)) {
    value = value.replace(/\./g, "");
  }
  if (!/^-?\d+(\.\d+)?$/.test(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatHa(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return (Math.round(value * 100) / 100).toLocaleString("es-CL", { maximumFractionDigits: 2 });
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = curr;
  }
  return prev[b.length];
}

/** Clave para unir códigos: "C-01", "c 1" y "C1" son el mismo cuartel. */
export function codeKey(code: string): string {
  return code
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/(^|[A-Z])0+(\d)/g, "$1$2");
}

const SPECIES_ALIASES: Record<string, string> = {
  cerezo: "cereza",
  cerezos: "cereza",
  cerezas: "cereza",
  cherry: "cereza",
  vid: "uva",
  parronal: "uva",
  "uva de mesa": "uva",
  manzano: "manzana",
  manzanos: "manzana",
  arandanos: "arandano",
  nuez: "nogal",
  nogales: "nogal",
};

/** Devuelve el id de especie del catálogo o null si no se reconoce. */
export function resolveSpecies(raw: string): string | null {
  const n = normalizeText(raw);
  if (!n) return null;
  const found = SPECIES.find((s) => normalizeText(s.id) === n || normalizeText(s.label) === n);
  if (found) return found.id;
  return SPECIES_ALIASES[n] ?? null;
}

export function speciesLabel(id: string | null): string {
  if (!id) return "—";
  return SPECIES.find((s) => s.id === id)?.label ?? id;
}

function fromCatalog(raw: string, catalog: readonly string[]): string {
  const n = normalizeText(raw);
  return catalog.find((item) => normalizeText(item) === n) ?? raw.trim();
}

/** Variedad del catálogo más parecida (o null si ninguna está razonablemente cerca). */
export function closestVariety(raw: string, speciesId: string | null): string | null {
  const catalog = speciesId ? VARIETIES_BY_SPECIES[speciesId] : undefined;
  if (!catalog?.length) return null;
  const n = normalizeText(raw);
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const variety of catalog) {
    const d = levenshtein(n, normalizeText(variety));
    if (d < bestDistance) {
      bestDistance = d;
      best = variety;
    }
  }
  const tolerance = Math.max(2, Math.floor(n.length * 0.4));
  return bestDistance <= tolerance ? best : null;
}

function emptyValues(): Record<EditableField, string> {
  return { code: "", variety: "", plantingYear: "", density: "", areaHa: "", rootstock: "", irrigation: "" };
}

// ---------------------------------------------------------------------------
// Validación principal

type WorkingEntry = {
  key: string;
  rowNumber: number | null;
  feature: CartographyFeature | null;
  values: Record<EditableField, string>;
  name: string;
  speciesRaw: string;
  issues: CheckedIssue[];
};

export function validateAndMerge({ spreadsheet, cartography, speciesDefault }: ValidationInput): ValidationResult {
  const sheet = spreadsheet as SpreadsheetDraftWithEdits | null;
  const edits: CellEdits = sheet?.edits ?? {};
  const hasSpreadsheet = Boolean(sheet && !sheet.skipped && sheet.rawRows.length > 0);
  const features = cartography && !cartography.skipped ? cartography.features : [];
  const hasCartography = features.length > 0;

  const featureByKey = new Map<string, CartographyFeature>();
  for (const feature of features) {
    const k = codeKey(feature.code);
    if (k && !featureByKey.has(k)) featureByKey.set(k, feature);
  }

  const entries: WorkingEntry[] = [];
  const globalIssues: CheckedIssue[] = [];
  const mapping = sheet?.mapping ?? {};
  const speciesColumn = columnFor(mapping, "species");
  const nameColumn = columnFor(mapping, "name");

  // 1) Filas de la planilla
  if (hasSpreadsheet && sheet) {
    const columns = Object.fromEntries(EDITABLE_FIELDS.map((f) => [f, columnFor(mapping, f)])) as Record<
      EditableField,
      string | null
    >;
    sheet.rawRows.forEach((row, index) => {
      const key = `row:${index}`;
      const rowEdits = edits[key] ?? {};
      const values = emptyValues();
      for (const field of EDITABLE_FIELDS) {
        const edited = rowEdits[field];
        const col = columns[field];
        values[field] = (edited ?? (col ? row[col] ?? "" : "")).trim();
      }
      entries.push({
        key,
        rowNumber: index + 1,
        feature: null,
        values,
        name: nameColumn ? (row[nameColumn] ?? "").trim() : "",
        speciesRaw: speciesColumn ? (row[speciesColumn] ?? "").trim() : "",
        issues: [],
      });
    });

    if (!speciesColumn && speciesDefault) {
      globalIssues.push({
        rowNumber: null,
        blockCode: null,
        field: "species",
        severity: "warning",
        message: `La planilla no trae especie: asumimos ${speciesLabel(speciesDefault)} para todos los cuarteles.`,
        kind: "especie_asumida",
        entryKey: null,
        suggestion: null,
      });
    }
  }

  // 2) Cruce con el mapa
  const usedFeatureKeys = new Set<string>();
  for (const entry of entries) {
    const k = codeKey(entry.values.code);
    const feature = k ? featureByKey.get(k) : undefined;
    if (feature && !usedFeatureKeys.has(k)) {
      entry.feature = feature;
      usedFeatureKeys.add(k);
    }
  }
  for (const feature of features) {
    const k = codeKey(feature.code);
    if (!k || usedFeatureKeys.has(k)) continue;
    usedFeatureKeys.add(k);
    const key = `map:${feature.code}`;
    const rowEdits = edits[key] ?? {};
    const values = emptyValues();
    values.code = feature.code;
    for (const field of EDITABLE_FIELDS) {
      if (field === "code") continue;
      values[field] = (rowEdits[field] ?? "").trim();
    }
    entries.push({ key, rowNumber: null, feature, values, name: feature.name ?? "", speciesRaw: "", issues: [] });
  }

  // 3) Códigos duplicados (solo planilla)
  const codeCount = new Map<string, number>();
  for (const entry of entries) {
    if (entry.rowNumber === null) continue;
    const k = codeKey(entry.values.code);
    if (k) codeCount.set(k, (codeCount.get(k) ?? 0) + 1);
  }

  // 4) Reglas por fila
  const merged: MergedEntry[] = entries.map((entry) => {
    const { values } = entry;
    const fromSheet = entry.rowNumber !== null;
    const displayCode = entry.feature?.code ?? values.code;
    const issues: CheckedIssue[] = [];
    const push = (
      kind: IssueKind,
      severity: CheckedIssue["severity"],
      field: CheckedIssue["field"],
      message: string,
      suggestion: string | null = null,
    ) =>
      issues.push({
        rowNumber: entry.rowNumber,
        blockCode: displayCode || null,
        field,
        severity,
        message,
        suggestion,
        kind,
        entryKey: entry.key,
      });

    // Código
    if (fromSheet) {
      if (!values.code) {
        push("codigo_vacio", "error", "code", "Falta el código del cuartel.");
      } else if ((codeCount.get(codeKey(values.code)) ?? 0) > 1) {
        push("codigo_duplicado", "error", "code", `El código «${values.code}» está repetido en la planilla.`);
      }
    }

    // Especie
    let species: string | null = null;
    if (entry.speciesRaw) {
      species = resolveSpecies(entry.speciesRaw);
      if (!species) {
        push("especie_desconocida", "warning", "species", `No reconocemos la especie «${entry.speciesRaw}».`);
      }
    } else {
      species = speciesDefault || null;
      if (fromSheet && speciesColumn && speciesDefault) {
        push("especie_asumida", "warning", "species", `Sin especie: asumimos ${speciesLabel(speciesDefault)}.`);
      }
    }
    const speciesValue = species ?? (entry.speciesRaw || null);

    // Variedad
    let variety: string | null = values.variety || null;
    if (!values.variety) {
      if (fromSheet) push("variedad_vacia", "error", "variety", "Falta la variedad.");
    } else if (species && VARIETIES_BY_SPECIES[species]) {
      const catalog = VARIETIES_BY_SPECIES[species];
      const exact = catalog.find((v) => normalizeText(v) === normalizeText(values.variety));
      if (exact) {
        variety = exact;
      } else {
        const suggestion = closestVariety(values.variety, species);
        push(
          "variedad_desconocida",
          "warning",
          "variety",
          suggestion
            ? `«${values.variety}» no está en el catálogo de ${speciesLabel(species)}. ¿Quisiste decir «${suggestion}»?`
            : `«${values.variety}» no está en el catálogo de variedades de ${speciesLabel(species)}.`,
          suggestion,
        );
      }
    }

    // Año de plantación
    let plantingYear: number | null = null;
    if (!values.plantingYear) {
      if (fromSheet) push("anio_vacio", "warning", "plantingYear", "Falta el año de plantación.");
    } else {
      const n = parseLocaleNumber(values.plantingYear, true);
      const { min, max } = VALIDATION_RANGES.plantingYear;
      if (n === null || !Number.isInteger(n)) {
        push("anio_invalido", "error", "plantingYear", `«${values.plantingYear}» no es un año válido.`);
      } else if (n < min || n > max) {
        push("anio_invalido", "error", "plantingYear", `El año ${n} está fuera del rango esperado (${min}–${max}).`);
      } else {
        plantingYear = n;
      }
    }

    // Densidad
    let density: number | null = null;
    if (!values.density) {
      if (fromSheet) push("densidad_vacia", "warning", "density", "Falta la densidad de plantación.");
    } else {
      const n = parseLocaleNumber(values.density, true);
      const { min, max } = VALIDATION_RANGES.density;
      if (n === null) {
        push("densidad_invalida", "error", "density", `«${values.density}» no es un número válido.`);
      } else if (n < min || n > max) {
        push(
          "densidad_invalida",
          "error",
          "density",
          `${n.toLocaleString("es-CL")} plantas/ha está fuera del rango esperado (${min.toLocaleString("es-CL")}–${max.toLocaleString("es-CL")}).`,
        );
      } else {
        density = Math.round(n);
      }
    }

    // Superficie
    const mapAreaHa = entry.feature ? entry.feature.areaHa : null;
    let areaHa: number | null = null;
    if (values.areaHa) {
      const n = parseLocaleNumber(values.areaHa);
      const { min, max } = VALIDATION_RANGES.areaHa;
      if (n === null || n < min || n > max) {
        push("superficie_invalida", "error", "areaHa", `«${values.areaHa}» no es una superficie válida (${min}–${max} ha).`);
      } else {
        areaHa = Math.round(n * 100) / 100;
        if (mapAreaHa && mapAreaHa > 0) {
          const diff = Math.abs(n - mapAreaHa) / mapAreaHa;
          if (diff > 0.15) {
            push(
              "superficie_diferente",
              "warning",
              "areaHa",
              `La planilla dice ${formatHa(n)} ha y el mapa calcula ${formatHa(mapAreaHa)} ha (${Math.round(diff * 100)}% de diferencia).`,
              formatHa(mapAreaHa),
            );
          }
        }
      }
    } else if (mapAreaHa) {
      areaHa = Math.round(mapAreaHa * 100) / 100;
    }

    // Cruce mapa <-> planilla
    if (hasCartography && fromSheet && !entry.feature && values.code) {
      push("sin_geometria", "warning", "geometry", `El cuartel ${values.code} no tiene polígono en el mapa.`);
    }
    if (!fromSheet && hasSpreadsheet) {
      push("sin_datos_planilla", "warning", null, `El cuartel ${displayCode} está en el mapa pero no en la planilla.`);
    }

    const block: BlockRecord = {
      code: displayCode,
      name: entry.name || entry.feature?.name || null,
      species: speciesValue,
      variety,
      rootstock: values.rootstock ? fromCatalog(values.rootstock, ROOTSTOCKS) : null,
      plantingYear,
      density,
      areaHa,
      irrigation: values.irrigation ? fromCatalog(values.irrigation, IRRIGATION_TYPES) : null,
      geometry: entry.feature?.geometry ?? null,
      source: fromSheet ? (entry.feature ? "ambos" : "planilla") : "mapa",
    };

    const status: EntryStatus = issues.some((i) => i.severity === "error")
      ? "error"
      : issues.length > 0
        ? "warning"
        : "ok";

    return { key: entry.key, rowNumber: entry.rowNumber, block, mapAreaHa, values, issues, status };
  });

  merged.sort((a, b) => {
    if (!a.block.code) return 1;
    if (!b.block.code) return -1;
    return a.block.code.localeCompare(b.block.code, "es", { numeric: true, sensitivity: "base" });
  });

  const issues = [...globalIssues, ...merged.flatMap((e) => e.issues)];

  let quality: QualitySummary | null = null;
  if (hasSpreadsheet && sheet) {
    const rows = merged.filter((e) => e.rowNumber !== null);
    const validCount = rows.filter((e) => e.status === "ok").length;
    const warningCount = rows.filter((e) => e.status === "warning").length;
    const errorCount = rows.filter((e) => e.status === "error").length;
    const score = rows.length ? Math.round(((validCount + warningCount * 0.7) / rows.length) * 100) : 0;
    quality = {
      fileName: sheet.fileName || null,
      rowCount: rows.length,
      validCount,
      warningCount,
      errorCount,
      qualityScore: score,
      mapping: sheet.mapping,
      issues,
      checkedAt: new Date().toISOString(),
    };
  }

  return {
    blocks: merged.map((e) => e.block),
    issues,
    quality,
    entries: merged,
    hasSpreadsheet,
    hasCartography,
  };
}

// ---------------------------------------------------------------------------
// Agrupación para la tarjeta de calidad

const GROUP_LABELS: Record<IssueKind, (n: number) => string> = {
  codigo_vacio: (n) => (n === 1 ? "1 fila sin código" : `${n} filas sin código`),
  codigo_duplicado: (n) => (n === 1 ? "1 código repetido" : `${n} códigos repetidos`),
  variedad_vacia: (n) => (n === 1 ? "1 cuartel sin variedad" : `${n} cuarteles sin variedad`),
  variedad_desconocida: (n) => (n === 1 ? "1 variedad no reconocida" : `${n} variedades no reconocidas`),
  especie_asumida: (n) => (n === 1 ? "1 aviso de especie asumida" : `${n} cuarteles con especie asumida`),
  especie_desconocida: (n) => (n === 1 ? "1 especie no reconocida" : `${n} especies no reconocidas`),
  anio_vacio: (n) => (n === 1 ? "1 cuartel sin año de plantación" : `${n} cuarteles sin año de plantación`),
  anio_invalido: (n) => (n === 1 ? "1 año de plantación fuera de rango" : `${n} años de plantación fuera de rango`),
  densidad_vacia: (n) => (n === 1 ? "1 cuartel sin densidad" : `${n} cuarteles sin densidad`),
  densidad_invalida: (n) => (n === 1 ? "1 densidad fuera de rango" : `${n} densidades fuera de rango`),
  superficie_invalida: (n) => (n === 1 ? "1 superficie inválida" : `${n} superficies inválidas`),
  superficie_diferente: (n) => (n === 1 ? "1 superficie no coincide con el mapa" : `${n} superficies no coinciden con el mapa`),
  sin_geometria: (n) => (n === 1 ? "1 cuartel sin polígono en el mapa" : `${n} cuarteles sin polígono en el mapa`),
  sin_datos_planilla: (n) => (n === 1 ? "1 cuartel del mapa sin datos en la planilla" : `${n} cuarteles del mapa sin datos en la planilla`),
};

export type IssueGroup = {
  kind: IssueKind;
  severity: CheckedIssue["severity"];
  label: string;
  codes: string[];
  count: number;
};

export function groupIssues(issues: CheckedIssue[]): IssueGroup[] {
  const groups = new Map<IssueKind, IssueGroup>();
  for (const issue of issues) {
    const g = groups.get(issue.kind) ?? { kind: issue.kind, severity: issue.severity, label: "", codes: [], count: 0 };
    g.count += 1;
    if (issue.blockCode && !g.codes.includes(issue.blockCode)) g.codes.push(issue.blockCode);
    else if (!issue.blockCode && issue.rowNumber) g.codes.push(`fila ${issue.rowNumber}`);
    if (issue.severity === "error") g.severity = "error";
    groups.set(issue.kind, g);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, label: GROUP_LABELS[g.kind](g.count) }))
    .sort((a, b) => (a.severity === b.severity ? b.count - a.count : a.severity === "error" ? -1 : 1));
}
