// Cálculos de "primer valor" a partir de los cuarteles de un fundo.
// Reglas simples y explicables: no son modelos agronómicos validados por CER.

import type { Database } from "@/lib/database.types";
import type { MapBlock } from "@/components/map/blocks-map";
import type { BlockGeometry } from "@/lib/onboarding/types";
import { formatHa, formatNumber, formatPercent, joinList } from "@/features/dashboard/format";

export type BlockRow = Database["public"]["Tables"]["blocks"]["Row"];

/** Paleta fija y ordenada (visible sobre imagen satelital). */
export const VARIETY_PALETTE = [
  "#e11d48",
  "#f59e0b",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#eab308",
] as const;
export const OTHER_COLOR = "#64748b";
export const NO_VARIETY_COLOR = "#cbd5e1";
export const NO_VARIETY_LABEL = "Sin variedad";
export const OTHER_LABEL = "Otras";

export const YOUNG_ORCHARD_YEARS = 4;
export const DENSITY_DEVIATION = 0.3;

export type LegendItem = { label: string; color: string; areaHa: number; count: number };

export type VarietyColoring = {
  legend: LegendItem[];
  colorOf: (variety: string | null) => string;
};

function varietyKey(variety: string | null | undefined): string {
  const v = variety?.trim();
  return v ? v : NO_VARIETY_LABEL;
}

export function sumArea(blocks: Pick<BlockRow, "area_ha">[]): number {
  return blocks.reduce((acc, b) => acc + (Number(b.area_ha) || 0), 0);
}

/** Variedades ordenadas por superficie (desc); las 8 primeras con color propio, el resto "Otras". */
export function buildVarietyColoring(blocks: BlockRow[]): VarietyColoring {
  const groups = new Map<string, { areaHa: number; count: number }>();
  for (const block of blocks) {
    const key = varietyKey(block.variety);
    const g = groups.get(key) ?? { areaHa: 0, count: 0 };
    g.areaHa += Number(block.area_ha) || 0;
    g.count += 1;
    groups.set(key, g);
  }

  const named = [...groups.entries()]
    .filter(([key]) => key !== NO_VARIETY_LABEL)
    .sort((a, b) => b[1].areaHa - a[1].areaHa || b[1].count - a[1].count || a[0].localeCompare(b[0], "es"));

  const colorMap = new Map<string, string>();
  const legend: LegendItem[] = [];
  const others = { areaHa: 0, count: 0 };

  named.forEach(([key, g], index) => {
    if (index < VARIETY_PALETTE.length) {
      colorMap.set(key, VARIETY_PALETTE[index]);
      legend.push({ label: key, color: VARIETY_PALETTE[index], ...g });
    } else {
      colorMap.set(key, OTHER_COLOR);
      others.areaHa += g.areaHa;
      others.count += g.count;
    }
  });

  if (others.count > 0) legend.push({ label: OTHER_LABEL, color: OTHER_COLOR, ...others });
  const none = groups.get(NO_VARIETY_LABEL);
  if (none) legend.push({ label: NO_VARIETY_LABEL, color: NO_VARIETY_COLOR, ...none });

  return {
    legend,
    colorOf: (variety) => colorMap.get(varietyKey(variety)) ?? NO_VARIETY_COLOR,
  };
}

export function isGeometry(value: unknown): value is BlockGeometry {
  if (!value || typeof value !== "object") return false;
  const type = (value as { type?: unknown }).type;
  return (
    (type === "Polygon" || type === "MultiPolygon") &&
    Array.isArray((value as { coordinates?: unknown }).coordinates)
  );
}

export function toMapBlocks(
  blocks: BlockRow[],
  colorOf: (variety: string | null) => string,
  samplersByCode: Map<string, string[]> = new Map(),
): MapBlock[] {
  return blocks.map((block) => {
    const details: string[] = [];
    if (block.variety) details.push(`Variedad: ${block.variety}`);
    if (block.planting_year) details.push(`Año de plantación: ${block.planting_year}`);
    if (block.area_ha !== null) details.push(`Superficie: ${formatHa(Number(block.area_ha))}`);
    const samplers = samplersByCode.get(block.code);
    details.push(samplers?.length ? `Muestreador: ${samplers.join(", ")}` : "Sin muestreador asignado");
    return {
      code: block.code,
      label: block.name,
      geometry: isGeometry(block.geometry) ? block.geometry : null,
      color: colorOf(block.variety),
      details,
    };
  });
}

export type FarmKpis = {
  totalHa: number;
  blockCount: number;
  varietyCount: number;
  avgAgeYears: number | null;
  avgDensity: number | null;
  withSamplerPct: number | null;
  withSamplerCount: number;
  withGeometryCount: number;
};

export function computeKpis(
  blocks: BlockRow[],
  samplersByCode: Map<string, string[]>,
  currentYear = new Date().getFullYear(),
): FarmKpis {
  const varieties = new Set(blocks.map((b) => b.variety?.trim()).filter((v): v is string => Boolean(v)));
  const ages = blocks
    .map((b) => (b.planting_year ? currentYear - b.planting_year : null))
    .filter((a): a is number => a !== null && a >= 0);
  const densities = blocks.map((b) => Number(b.density)).filter((d) => Number.isFinite(d) && d > 0);
  const withSamplerCount = blocks.filter((b) => (samplersByCode.get(b.code)?.length ?? 0) > 0).length;

  return {
    totalHa: sumArea(blocks),
    blockCount: blocks.length,
    varietyCount: varieties.size,
    avgAgeYears: ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : null,
    avgDensity: densities.length ? densities.reduce((a, b) => a + b, 0) / densities.length : null,
    withSamplerPct: blocks.length ? (100 * withSamplerCount) / blocks.length : null,
    withSamplerCount,
    withGeometryCount: blocks.filter((b) => isGeometry(b.geometry)).length,
  };
}

export type Insight = {
  id: string;
  tone: "info" | "warning" | "positive";
  title: string;
  body: string;
};

/** Hasta 4 hallazgos automáticos, ordenados por relevancia. Solo se afirma lo que los datos muestran. */
export function computeInsights(
  blocks: BlockRow[],
  kpis: FarmKpis,
  samplersByCode: Map<string, string[]>,
  currentYear = new Date().getFullYear(),
): Insight[] {
  if (blocks.length === 0) return [];
  const insights: Insight[] = [];

  // 1. Variedad dominante por superficie.
  const byVariety = new Map<string, { area: number; count: number }>();
  for (const b of blocks) {
    const key = b.variety?.trim();
    if (!key) continue;
    const g = byVariety.get(key) ?? { area: 0, count: 0 };
    g.area += Number(b.area_ha) || 0;
    g.count += 1;
    byVariety.set(key, g);
  }
  const top = [...byVariety.entries()].sort((a, b) => b[1].area - a[1].area)[0];
  if (top && kpis.totalHa > 0 && top[1].area > 0) {
    const share = (100 * top[1].area) / kpis.totalHa;
    insights.push({
      id: "variedad-principal",
      tone: "info",
      title: `${top[0]} es tu variedad principal`,
      body: `Concentra el ${formatPercent(share)} de la superficie (${formatHa(top[1].area)} en ${top[1].count} cuartel${
        top[1].count === 1 ? "" : "es"
      }). Una helada o un problema sanitario en esta variedad impacta a buena parte del fundo.`,
    });
  }

  // 2. Cruce mapa ↔ planilla.
  const noGeometry = blocks.filter((b) => !isGeometry(b.geometry));
  const onlyMap = blocks.filter((b) => b.source === "mapa");
  if (noGeometry.length > 0 || onlyMap.length > 0) {
    const parts: string[] = [];
    if (noGeometry.length > 0) parts.push(`${joinList(noGeometry.map((b) => b.code), 3)} no tiene${noGeometry.length === 1 ? "" : "n"} polígono en el mapa`);
    if (onlyMap.length > 0) parts.push(`${joinList(onlyMap.map((b) => b.code), 3)} no aparece${onlyMap.length === 1 ? "" : "n"} en la planilla`);
    insights.push({
      id: "cruce-mapa-planilla",
      tone: "warning",
      title: "El mapa y la planilla no calzan del todo",
      body: `${parts.join("; ")}. Completa esos datos para que el análisis por cuartel sea confiable.`,
    });
  }

  // 3. Cuarteles jóvenes.
  const young = blocks.filter(
    (b) => b.planting_year && currentYear - b.planting_year < YOUNG_ORCHARD_YEARS && currentYear - b.planting_year >= 0,
  );
  if (young.length > 0) {
    insights.push({
      id: "cuarteles-jovenes",
      tone: "warning",
      title: `${young.length} cuartel${young.length === 1 ? "" : "es"} aún no está${young.length === 1 ? "" : "n"} en plena producción`,
      body: `${joinList(young.map((b) => b.code))} ${young.length === 1 ? "tiene" : "tienen"} menos de ${YOUNG_ORCHARD_YEARS} años. Conviene compararlos por separado para no subestimar el rendimiento del resto del huerto.`,
    });
  }

  // 4. Densidad atípica.
  if (kpis.avgDensity) {
    const avg = kpis.avgDensity;
    const atypical = blocks
      .filter((b) => {
        const d = Number(b.density);
        return Number.isFinite(d) && d > 0 && Math.abs(d - avg) / avg > DENSITY_DEVIATION;
      })
      .sort((a, b) => Math.abs(Number(b.density) - avg) - Math.abs(Number(a.density) - avg));
    if (atypical.length > 0) {
      const first = atypical[0];
      const diff = ((Number(first.density) - avg) / avg) * 100;
      insights.push({
        id: "densidad-atipica",
        tone: "warning",
        title: `Densidad atípica en ${joinList(atypical.map((b) => b.code), 3)}`,
        body: `${first.code} tiene ${formatNumber(Number(first.density))} plantas/ha, un ${formatPercent(Math.abs(diff))} ${
          diff > 0 ? "sobre" : "bajo"
        } el promedio del fundo (${formatNumber(avg)} plantas/ha). Verifica si es un dato real o un error de digitación.`,
      });
    }
  }

  // 5. Cuarteles sin muestreador.
  const withoutSampler = blocks.filter((b) => !(samplersByCode.get(b.code)?.length));
  if (withoutSampler.length > 0) {
    insights.push({
      id: "sin-muestreador",
      tone: withoutSampler.length === blocks.length ? "warning" : "info",
      title:
        withoutSampler.length === blocks.length
          ? "Ningún cuartel tiene muestreador"
          : `${withoutSampler.length} cuartel${withoutSampler.length === 1 ? "" : "es"} sin muestreador`,
      body: `${joinList(withoutSampler.map((b) => b.code))} no ${
        withoutSampler.length === 1 ? "tiene" : "tienen"
      } a nadie asignado: sus conteos no quedarán registrados esta temporada.`,
    });
  } else {
    insights.push({
      id: "cobertura-completa",
      tone: "positive",
      title: "Todos los cuarteles tienen muestreador",
      body: "Tu equipo cubre el 100% de los cuarteles: los conteos pueden partir desde el primer día.",
    });
  }

  return insights.slice(0, 4);
}

export const SOURCE_LABELS: Record<string, string> = {
  mapa: "Solo mapa",
  planilla: "Solo planilla",
  ambos: "Mapa + planilla",
};
