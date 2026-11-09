// Motor de recomendaciones contextuales (FUNCIONALIDAD.MD §19).
// Reglas simples y explicables: a partir del perfil de contexto sugiere el siguiente paso.

import type { OperationAnswers } from "@/lib/onboarding/types";

export type RecommendationInput = {
  userRole: string | null;
  operation: Partial<OperationAnswers> | null;
  blockCount: number;
  blocksWithGeometry: number;
  qualityScore: number | null;
  errorCount: number;
  teamCount: number;
  assignedBlockCount: number;
};

export type Recommendation = {
  id: string;
  title: string;
  description: string;
  /** Por qué se recomienda (contexto que la gatilló). */
  reason: string;
  priority: "alta" | "media" | "baja";
  icon: string;
};

export function getRecommendations(input: RecommendationInput): Recommendation[] {
  const recs: Recommendation[] = [];
  const op = input.operation ?? {};
  const goals = op.goals ?? [];
  const sources = op.dataSources ?? [];

  if (input.blockCount === 0) {
    recs.push({
      id: "cargar-cuarteles",
      title: "Carga tus cuarteles",
      description: "Sube el mapa (KML/GeoJSON) y la planilla para activar el análisis por cuartel.",
      reason: "Tu fundo todavía no tiene cuarteles registrados.",
      priority: "alta",
      icon: "🗺️",
    });
  } else if (input.blocksWithGeometry < input.blockCount) {
    recs.push({
      id: "completar-mapa",
      title: "Completa la cartografía",
      description: `${input.blockCount - input.blocksWithGeometry} cuartel(es) no tienen polígono en el mapa.`,
      reason: "Sin geometría no se pueden asignar recorridos de muestreo ni ver el mapa completo.",
      priority: "media",
      icon: "📐",
    });
  }

  if (input.qualityScore !== null && input.qualityScore < 85) {
    recs.push({
      id: "mejorar-calidad",
      title: "Mejora la calidad de tus datos",
      description: `Tu planilla quedó con ${Math.round(input.qualityScore)}% de calidad. Revisa los registros con advertencias.`,
      reason: "Datos incompletos reducen la confiabilidad de alertas y predicciones.",
      priority: input.errorCount > 0 ? "alta" : "media",
      icon: "🧹",
    });
  }

  if (input.teamCount === 0 || input.assignedBlockCount === 0) {
    recs.push({
      id: "invitar-muestreadores",
      title: "Invita a tus muestreadores",
      description: "Asigna cuarteles a tu equipo para que registren conteos desde el primer día.",
      reason: "Ningún cuartel tiene muestreador asignado.",
      priority: "alta",
      icon: "👥",
    });
  }

  if (goals.includes("predecir_produccion")) {
    recs.push({
      id: "historico-produccion",
      title: "Carga datos históricos de producción",
      description: "Con 2 o más temporadas por cuartel podemos entrenar la predicción de cosecha.",
      reason: "Indicaste que quieres predecir producción.",
      priority: "media",
      icon: "🔮",
    });
  }

  if (goals.includes("recibir_alertas") || goals.includes("detectar_problemas")) {
    recs.push({
      id: "configurar-alertas",
      title: "Configura tus alertas",
      description: "Define umbrales de heladas y conteos fuera de rango por cuartel.",
      reason: "Indicaste que quieres detectar problemas o recibir alertas.",
      priority: "media",
      icon: "🔔",
    });
  }

  if (goals.includes("comparar_cuarteles") || goals.includes("analizar_rendimiento")) {
    recs.push({
      id: "comparar-variedades",
      title: "Compara cuarteles por variedad",
      description: "Tu panel ya agrupa los cuarteles por variedad y edad para comparar rendimiento.",
      reason: "Indicaste que quieres comparar cuarteles o analizar rendimiento.",
      priority: "baja",
      icon: "⚖️",
    });
  }

  if (op.countsSource === "cuaderno" || sources.includes("cuaderno")) {
    recs.push({
      id: "digitalizar-conteos",
      title: "Digitaliza los conteos con CER Counter",
      description: "Reemplaza el cuaderno por la app móvil para evitar errores de transcripción.",
      reason: "Hoy registras conteos en cuaderno.",
      priority: "media",
      icon: "📱",
    });
  }

  if (input.userRole === "encargado_campo" || input.userRole === "muestreador") {
    recs.push({
      id: "configurar-conteos",
      title: "Configura tus conteos",
      description: "Define qué variables se cuentan en cada cuartel y con qué frecuencia.",
      reason: "Tu rol está enfocado en el trabajo en terreno.",
      priority: "media",
      icon: "📋",
    });
  }

  const order = { alta: 0, media: 1, baja: 2 } as const;
  return recs.sort((a, b) => order[a.priority] - order[b.priority]);
}
