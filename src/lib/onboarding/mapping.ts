// Mapeo automático de columnas de la planilla a los campos de CER Analytics.
// 1) Coincidencia exacta con sinónimos  2) coincidencia parcial  3) inferencia por contenido.

import {
  IRRIGATION_TYPES,
  ROOTSTOCKS,
  SPECIES,
  TARGET_FIELDS,
  VARIETIES_BY_SPECIES,
} from "@/lib/onboarding/catalogs";
import type { ColumnMapping, TargetField } from "@/lib/onboarding/types";

export type MappingConfidenceLevel = "alta" | "media" | "baja";

export type MappingConfidence = {
  level: MappingConfidenceLevel;
  /** Explicación breve de por qué se sugirió (se muestra en la UI). */
  reason: string;
};

export type MappingSuggestion = {
  mapping: ColumnMapping;
  /** Encabezados que se mapearon automáticamente a un campo. */
  autoDetected: string[];
  confidence: Record<string, MappingConfidence>;
};

/** minúsculas, sin tildes, puntuación -> espacio, espacios colapsados. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const FIELD_BY_ID = new Map(TARGET_FIELDS.map((field) => [field.id as TargetField, field]));

export function fieldLabel(field: TargetField | "ignore" | null | undefined): string {
  if (!field || field === "ignore") return "Ignorar";
  return FIELD_BY_ID.get(field)?.label ?? field;
}

type Candidate = { header: string; field: TargetField; score: number; level: MappingConfidenceLevel; reason: string };

function headerCandidates(header: string): Candidate[] {
  const h = normalizeText(header);
  if (!h) return [];
  const hTokens = h.split(" ");
  const out: Candidate[] = [];

  for (const field of TARGET_FIELDS) {
    let best: Candidate | null = null;
    for (const synonym of field.synonyms) {
      const s = normalizeText(synonym);
      if (!s) continue;
      if (h === s) {
        best = { header, field: field.id, score: 100 + s.length, level: "alta", reason: `El encabezado coincide con «${synonym}».` };
        break;
      }
      // Parcial: solo sinónimos de 3+ letras y como palabra(s) completa(s).
      if (s.length < 3) continue;
      const sTokens = s.split(" ");
      const containsAll = sTokens.every((token) => hTokens.includes(token));
      const prefix = hTokens.some((token) => token.length >= 3 && (token.startsWith(s) || s.startsWith(token)));
      if (containsAll || prefix) {
        const score = (containsAll ? 50 : 30) + s.length;
        if (!best || score > best.score) {
          best = { header, field: field.id, score, level: "media", reason: `El encabezado se parece a «${synonym}».` };
        }
      }
    }
    if (best) out.push(best);
  }
  return out;
}

const CODE_PATTERN = /^[a-z]{0,4}[\s_-]?\d{1,4}[a-z]?$/i;

const VARIETY_SET = new Set(
  Object.values(VARIETIES_BY_SPECIES)
    .flat()
    .map((v) => normalizeText(v)),
);
const SPECIES_SET = new Set(
  SPECIES.flatMap((s) => [normalizeText(s.label), normalizeText(s.id)]).concat(["cerezo", "cerezos", "manzano", "vid", "parronal"]),
);
const ROOTSTOCK_SET = new Set(ROOTSTOCKS.map((r) => normalizeText(r)));
const IRRIGATION_SET = new Set(IRRIGATION_TYPES.map((r) => normalizeText(r)));

function toNumber(value: string): number | null {
  const cleaned = value.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

function share(values: string[], predicate: (v: string) => boolean): number {
  if (values.length === 0) return 0;
  return values.filter(predicate).length / values.length;
}

/** Inferencia por contenido para columnas cuyo encabezado no se reconoció. */
function contentCandidates(header: string, values: string[]): Candidate[] {
  const sample = values.map((v) => v.trim()).filter(Boolean).slice(0, 200);
  if (sample.length === 0) return [];
  const out: Candidate[] = [];
  const add = (field: TargetField, ratio: number, reason: string) =>
    out.push({ header, field, score: Math.round(ratio * 40), level: ratio > 0.9 ? "media" : "baja", reason });

  const codeRatio = share(sample, (v) => CODE_PATTERN.test(v) && /[a-z]/i.test(v));
  if (codeRatio >= 0.7) add("code", codeRatio, `Los valores parecen códigos de cuartel (p.ej. «${sample[0]}»).`);

  const numbers = sample.map(toNumber);
  const numericRatio = numbers.filter((n) => n !== null).length / sample.length;
  if (numericRatio >= 0.7) {
    const nums = numbers.filter((n): n is number => n !== null);
    const years = share(nums.map(String), (v) => Number.isInteger(Number(v)) && Number(v) >= 1980 && Number(v) <= 2030);
    if (years >= 0.7) add("plantingYear", years, "Los valores parecen años de plantación.");
    const dens = share(nums.map(String), (v) => Number(v) >= 100 && Number(v) <= 10000 && (Number(v) < 1980 || Number(v) > 2030));
    if (dens >= 0.7) add("density", dens * 0.9, "Los valores parecen plantas por hectárea.");
    const area = share(nums.map(String), (v) => Number(v) > 0 && Number(v) <= 100 && !Number.isInteger(Number(v)));
    if (area >= 0.5) add("areaHa", area * 0.9, "Los valores parecen superficies en hectáreas.");
  }

  const norm = sample.map(normalizeText);
  const varietyRatio = share(norm, (v) => VARIETY_SET.has(v));
  if (varietyRatio >= 0.5) add("variety", varietyRatio, "Los valores coinciden con variedades conocidas.");
  const speciesRatio = share(norm, (v) => SPECIES_SET.has(v));
  if (speciesRatio >= 0.6) add("species", speciesRatio, "Los valores coinciden con especies frutales.");
  const rootRatio = share(norm, (v) => ROOTSTOCK_SET.has(v));
  if (rootRatio >= 0.5) add("rootstock", rootRatio, "Los valores coinciden con portainjertos conocidos.");
  const irrRatio = share(norm, (v) => IRRIGATION_SET.has(v));
  if (irrRatio >= 0.5) add("irrigation", irrRatio, "Los valores coinciden con sistemas de riego.");

  return out;
}

/** Hasta `count` valores de ejemplo distintos y no vacíos de una columna. */
export function sampleValues(rows: Record<string, string>[], header: string, count = 3): string[] {
  const out: string[] = [];
  for (const row of rows) {
    const value = (row[header] ?? "").trim();
    if (value && !out.includes(value)) out.push(value);
    if (out.length >= count) break;
  }
  return out;
}

/**
 * Sugiere a qué campo corresponde cada columna. Cada campo destino queda asignado a lo más a una columna.
 * `rows` es opcional: si se entrega, se usa para inferir por contenido.
 */
export function suggestMapping(headers: string[], rows: Record<string, string>[] = []): MappingSuggestion {
  const mapping: ColumnMapping = {};
  const confidence: Record<string, MappingConfidence> = {};
  const takenFields = new Set<TargetField>();
  const takenHeaders = new Set<string>();

  const assign = (candidates: Candidate[]) => {
    candidates
      .sort((a, b) => b.score - a.score)
      .forEach((c) => {
        if (takenFields.has(c.field) || takenHeaders.has(c.header)) return;
        takenFields.add(c.field);
        takenHeaders.add(c.header);
        mapping[c.header] = c.field;
        confidence[c.header] = { level: c.level, reason: c.reason };
      });
  };

  const byHeader = headers.flatMap((header) => headerCandidates(header));
  // Primero exactas, luego parciales.
  assign(byHeader.filter((c) => c.level === "alta"));
  assign(byHeader.filter((c) => c.level !== "alta"));

  if (rows.length > 0) {
    const remaining = headers.filter((h) => !takenHeaders.has(h));
    assign(remaining.flatMap((header) => contentCandidates(header, rows.map((row) => row[header] ?? ""))));
  }

  const autoDetected: string[] = [];
  for (const header of headers) {
    if (mapping[header]) {
      autoDetected.push(header);
    } else {
      mapping[header] = "ignore";
      confidence[header] = { level: "baja", reason: "No reconocimos esta columna: puedes asignarla o ignorarla." };
    }
  }

  return { mapping, autoDetected, confidence };
}

/** Campos obligatorios que no tienen columna asignada. */
export function missingRequiredFields(mapping: ColumnMapping): TargetField[] {
  const mapped = new Set(Object.values(mapping));
  return TARGET_FIELDS.filter((f) => f.required && !mapped.has(f.id)).map((f) => f.id);
}

/** Columna asignada a un campo (o null). */
export function columnFor(mapping: ColumnMapping, field: TargetField): string | null {
  for (const [header, target] of Object.entries(mapping)) {
    if (target === field) return header;
  }
  return null;
}
