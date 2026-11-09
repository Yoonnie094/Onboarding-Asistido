// Catálogos de dominio para el onboarding (demo de clase).
// No son reglas agronómicas aprobadas por CER: son valores de referencia para la demostración.

type Option<Id extends string> = { id: Id; label: string; description?: string; icon?: string };

export const USER_ROLES = [
  { id: "administrador", label: "Administrador", description: "Gestiona el fundo, el equipo y la configuración.", icon: "👔" },
  { id: "productor", label: "Productor", description: "Dueño o responsable productivo del fundo.", icon: "👨‍🌾" },
  { id: "agronomo", label: "Agrónomo", description: "Define manejo, muestreos y analiza resultados.", icon: "🧑‍🔬" },
  { id: "encargado_campo", label: "Encargado de campo", description: "Coordina labores y personal en terreno.", icon: "🚜" },
  { id: "analista", label: "Analista", description: "Revisa datos, reportes y predicciones.", icon: "📊" },
  { id: "asesor", label: "Asesor", description: "Asesora a uno o más productores.", icon: "🤝" },
  { id: "muestreador", label: "Muestreador de campo", description: "Registra conteos en los cuarteles asignados.", icon: "📋" },
] as const satisfies readonly Option<string>[];
export type UserRoleId = (typeof USER_ROLES)[number]["id"];

export const MEMBERSHIP_ROLES = [
  { id: "administrador", label: "Administrador" },
  { id: "agronomo", label: "Agrónomo" },
  { id: "muestreador", label: "Muestreador" },
] as const satisfies readonly Option<string>[];
export type MembershipRoleId = (typeof MEMBERSHIP_ROLES)[number]["id"];

export const SPECIES = [
  { id: "cereza", label: "Cereza", icon: "🍒" },
  { id: "uva", label: "Uva de mesa", icon: "🍇" },
  { id: "manzana", label: "Manzana", icon: "🍎" },
  { id: "arandano", label: "Arándano", icon: "🫐" },
  { id: "nogal", label: "Nogal", icon: "🌰" },
  { id: "otro", label: "Otro", icon: "🌱" },
] as const satisfies readonly Option<string>[];
export type SpeciesId = (typeof SPECIES)[number]["id"];

export const FARM_COUNT_RANGES = [
  { id: "1", label: "1 fundo" },
  { id: "2-5", label: "2 a 5" },
  { id: "6-20", label: "6 a 20" },
  { id: "20+", label: "Más de 20" },
] as const satisfies readonly Option<string>[];
export type FarmCountRangeId = (typeof FARM_COUNT_RANGES)[number]["id"];

export const DATA_SOURCES = [
  { id: "excel", label: "Excel / CSV", icon: "📗" },
  { id: "app_movil", label: "Aplicación móvil", icon: "📱" },
  { id: "sistema_agricola", label: "Sistema agrícola", icon: "🖥️" },
  { id: "gis", label: "Mapas (KML / GIS)", icon: "🗺️" },
  { id: "cuaderno", label: "Cuaderno o registros manuales", icon: "📒" },
  { id: "otro", label: "Otro", icon: "➕" },
] as const satisfies readonly Option<string>[];
export type DataSourceId = (typeof DATA_SOURCES)[number]["id"];

export const COUNTS_SOURCES = [
  { id: "cer_counter", label: "App CER Counter" },
  { id: "planilla", label: "Planilla Excel" },
  { id: "cuaderno", label: "Cuaderno en terreno" },
  { id: "no_registra", label: "Aún no registramos conteos" },
] as const satisfies readonly Option<string>[];
export type CountsSourceId = (typeof COUNTS_SOURCES)[number]["id"];

export const GOALS = [
  { id: "detectar_problemas", label: "Detectar problemas a tiempo", icon: "🔎" },
  { id: "comparar_cuarteles", label: "Comparar cuarteles", icon: "⚖️" },
  { id: "analizar_rendimiento", label: "Analizar rendimiento", icon: "📈" },
  { id: "recibir_alertas", label: "Recibir alertas", icon: "🔔" },
  { id: "predecir_produccion", label: "Predecir producción", icon: "🔮" },
  { id: "ordenar_muestreos", label: "Ordenar los muestreos", icon: "🗂️" },
] as const satisfies readonly Option<string>[];
export type GoalId = (typeof GOALS)[number]["id"];

export const REGIONS = [
  { id: "XV", label: "Arica y Parinacota" },
  { id: "I", label: "Tarapacá" },
  { id: "II", label: "Antofagasta" },
  { id: "III", label: "Atacama" },
  { id: "IV", label: "Coquimbo" },
  { id: "V", label: "Valparaíso" },
  { id: "RM", label: "Metropolitana" },
  { id: "VI", label: "O'Higgins" },
  { id: "VII", label: "Maule" },
  { id: "XVI", label: "Ñuble" },
  { id: "VIII", label: "Biobío" },
  { id: "IX", label: "La Araucanía" },
  { id: "XIV", label: "Los Ríos" },
  { id: "X", label: "Los Lagos" },
  { id: "XI", label: "Aysén" },
  { id: "XII", label: "Magallanes" },
] as const satisfies readonly Option<string>[];
export type RegionId = (typeof REGIONS)[number]["id"];

/** Variedades de referencia por especie (para validar y sugerir correcciones). */
export const VARIETIES_BY_SPECIES: Record<string, readonly string[]> = {
  cereza: [
    "Santina", "Lapins", "Regina", "Kordia", "Sweetheart", "Bing", "Royal Dawn",
    "Skeena", "Rainier", "Brooks", "Sweet Aryana", "Frisco", "Pacific Red", "Nimba",
  ],
  uva: ["Thompson Seedless", "Crimson Seedless", "Red Globe", "Flame Seedless", "Autumn Royal", "Sweet Globe"],
  manzana: ["Gala", "Fuji", "Granny Smith", "Pink Lady", "Red Delicious", "Cripps Pink"],
  arandano: ["Duke", "Legacy", "Brigitta", "Emerald", "Star", "O'Neal"],
  nogal: ["Chandler", "Serr", "Howard", "Tulare"],
};

export const ROOTSTOCKS = ["Colt", "Gisela 6", "Gisela 12", "MaxMa 14", "MaxMa 60", "CAB 6P", "Mahaleb", "Franco"] as const;

export const IRRIGATION_TYPES = ["Goteo", "Microaspersión", "Aspersión", "Surco", "Secano"] as const;

/** Rangos de referencia para validar la planilla (demo). */
export const VALIDATION_RANGES = {
  plantingYear: { min: 1980, max: new Date().getFullYear() },
  density: { min: 100, max: 5000, unit: "plantas/ha" },
  areaHa: { min: 0.05, max: 500 },
} as const;

/**
 * Campos destino de la planilla: etiqueta, si es obligatorio, sinónimos para el mapeo automático
 * y "por qué lo pedimos" (explicación contextual, FUNCIONALIDAD.MD §26.6).
 */
export const TARGET_FIELDS = [
  {
    id: "code",
    label: "Código de cuartel",
    required: true,
    synonyms: ["codigo", "código", "cod", "cuartel", "sector", "id", "id cuartel", "bloque", "block", "lote", "paño"],
    why: "Une cada fila de la planilla con su polígono en el mapa.",
  },
  {
    id: "name",
    label: "Nombre",
    required: false,
    synonyms: ["nombre", "name", "descripcion", "descripción", "nombre cuartel"],
    why: "Facilita reconocer el cuartel en reportes y en terreno.",
  },
  {
    id: "species",
    label: "Especie",
    required: false,
    synonyms: ["especie", "species", "cultivo", "frutal", "crop"],
    why: "Define qué modelos y alertas aplican al cuartel.",
  },
  {
    id: "variety",
    label: "Variedad",
    required: true,
    synonyms: ["variedad", "var", "var.", "variety", "cultivar", "cv"],
    why: "Permite comparar rendimiento entre cuarteles de la misma variedad.",
  },
  {
    id: "rootstock",
    label: "Portainjerto",
    required: false,
    synonyms: ["portainjerto", "patron", "patrón", "pie", "rootstock", "porta injerto"],
    why: "Influye en vigor y calibre; mejora las predicciones.",
  },
  {
    id: "plantingYear",
    label: "Año de plantación",
    required: true,
    synonyms: ["año", "ano", "año plantacion", "año plantación", "año plant.", "año plant", "plantacion", "plantación", "year", "planting year"],
    why: "La edad del huerto cambia el potencial productivo esperado.",
  },
  {
    id: "density",
    label: "Densidad (plantas/ha)",
    required: true,
    synonyms: ["densidad", "plantas/ha", "plantas ha", "pl/ha", "plantas por ha", "density", "marco"],
    why: "Necesaria para estimar producción por hectárea.",
  },
  {
    id: "areaHa",
    label: "Superficie (ha)",
    required: false,
    synonyms: ["superficie", "ha", "hectareas", "hectáreas", "sup", "sup.", "area", "área", "has"],
    why: "Se contrasta con la superficie calculada desde el mapa.",
  },
  {
    id: "irrigation",
    label: "Sistema de riego",
    required: false,
    synonyms: ["riego", "sistema riego", "sistema de riego", "irrigation", "tipo riego"],
    why: "Ayuda a interpretar estrés hídrico y alertas climáticas.",
  },
] as const;

export function labelOf<T extends readonly { id: string; label: string }[]>(
  catalog: T,
  id: string | null | undefined,
): string {
  if (!id) return "—";
  return catalog.find((item) => item.id === id)?.label ?? id;
}

/** Archivos de ejemplo para la demo en clases (public/demo). */
export const DEMO_FILES = {
  geojson: "/demo/cuarteles-demo.geojson",
  kml: "/demo/cuarteles-demo.kml",
  csv: "/demo/planilla-cuarteles-demo.csv",
} as const;
