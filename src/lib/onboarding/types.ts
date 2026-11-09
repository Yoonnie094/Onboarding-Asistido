// Contrato compartido del onboarding asistido.
// El borrador (OnboardingDraft) se guarda tal cual en onboarding_sessions.data (jsonb)
// y la RPC public.complete_onboarding lo lee con estos mismos nombres de campo.
// NO renombrar campos sin actualizar supabase/migrations/20261109000100_onboarding_asistido.sql.

import type { MultiPolygon, Polygon } from "geojson";
import type {
  CountsSourceId,
  DataSourceId,
  FarmCountRangeId,
  GoalId,
  MembershipRoleId,
  RegionId,
  SpeciesId,
  UserRoleId,
} from "@/lib/onboarding/catalogs";
import type { MicroSurveyMilestone } from "@/lib/onboarding/diagnostic";

export const ONBOARDING_STEPS = [
  { id: "perfil", label: "Perfil", title: "Cuéntanos quién eres" },
  { id: "operacion", label: "Operación", title: "Cuéntanos sobre tu operación" },
  { id: "fundo", label: "Fundo", title: "Crea tu fundo" },
  { id: "cartografia", label: "Cartografía", title: "Sube el mapa de tus cuarteles" },
  { id: "datos", label: "Datos", title: "Sube tu planilla de cuarteles" },
  { id: "validacion", label: "Validación", title: "Revisa y corrige" },
  { id: "equipo", label: "Equipo", title: "Invita a tu equipo" },
  { id: "listo", label: "Diagnóstico", title: "Tu fundo está listo" },
] as const;

export type StepId = (typeof ONBOARDING_STEPS)[number]["id"];

export type ProfileAnswers = {
  fullName: string;
  jobTitle: string;
  phone: string;
  userRole: UserRoleId | "";
};

export type OperationAnswers = {
  species: SpeciesId[];
  farmCountRange: FarmCountRangeId | "";
  hectaresApprox: number | null;
  dataSources: DataSourceId[];
  countsSource: CountsSourceId | "";
  goals: GoalId[];
};

export type FarmAnswers = {
  name: string;
  region: RegionId | "";
  commune: string;
};

export type BlockGeometry = Polygon | MultiPolygon;

export type CartographyFeature = {
  /** Código del cuartel (clave para unir con la planilla), p.ej. "C-01". */
  code: string;
  name: string | null;
  geometry: BlockGeometry;
  /** Superficie calculada desde la geometría, en hectáreas. */
  areaHa: number;
  properties: Record<string, string | number | boolean | null>;
};

export type CartographyDraft = {
  fileName: string;
  format: "geojson" | "kml";
  features: CartographyFeature[];
  warnings: string[];
  skipped: boolean;
  uploadedAt: string;
};

/** Campos destino a los que se mapean las columnas de la planilla. */
export type TargetField =
  | "code"
  | "name"
  | "species"
  | "variety"
  | "rootstock"
  | "plantingYear"
  | "density"
  | "areaHa"
  | "irrigation";

/** encabezado original de la planilla -> campo destino (o "ignore"). */
export type ColumnMapping = Record<string, TargetField | "ignore">;

export type SpreadsheetDraft = {
  fileName: string;
  sheetName: string | null;
  headers: string[];
  /** Filas originales como texto, claves = encabezados originales. */
  rawRows: Record<string, string>[];
  mapping: ColumnMapping;
  /** Columnas que el sistema detectó automáticamente (para mostrar "Detectamos estas equivalencias"). */
  autoDetected: string[];
  mappingConfirmed: boolean;
  skipped: boolean;
  uploadedAt: string;
};

export type IssueSeverity = "error" | "warning";

export type ValidationIssue = {
  /** Número de fila en la planilla (1 = primera fila de datos) o null si viene del mapa / cruce. */
  rowNumber: number | null;
  blockCode: string | null;
  field: TargetField | "geometry" | null;
  severity: IssueSeverity;
  message: string;
  /** Valor sugerido para corregir con un clic (p.ej. "Lapins" para "Lapinz"). */
  suggestion?: string | null;
};

/** Cuartel final (mapa + planilla ya unidos y corregidos). Lo inserta complete_onboarding. */
export type BlockRecord = {
  code: string;
  name: string | null;
  species: string | null;
  variety: string | null;
  rootstock: string | null;
  plantingYear: number | null;
  density: number | null;
  areaHa: number | null;
  irrigation: string | null;
  geometry: BlockGeometry | null;
  source: "mapa" | "planilla" | "ambos";
};

export type QualitySummary = {
  fileName: string | null;
  rowCount: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  /** 0-100 */
  qualityScore: number;
  mapping: ColumnMapping;
  issues: ValidationIssue[];
  checkedAt: string;
};

export type TeamInvite = {
  fullName: string;
  email: string;
  role: MembershipRoleId;
  blockCodes: string[];
};

export type OnboardingDraft = {
  profile: ProfileAnswers;
  operation: OperationAnswers;
  farm: FarmAnswers;
  cartography: CartographyDraft | null;
  spreadsheet: SpreadsheetDraft | null;
  /** Cuarteles finales tras validación (los escribe el paso "validacion"). */
  blocks: BlockRecord[];
  quality: QualitySummary | null;
  team: TeamInvite[];
  completedSteps: StepId[];
  /** Microencuestas respondidas en hitos (hito -> estrellas 1-5), para no volver a preguntarlas. */
  microSurveys?: Partial<Record<MicroSurveyMilestone, number>>;
};

export const EMPTY_DRAFT: OnboardingDraft = {
  profile: { fullName: "", jobTitle: "", phone: "", userRole: "" },
  operation: {
    species: [],
    farmCountRange: "",
    hectaresApprox: null,
    dataSources: [],
    countsSource: "",
    goals: [],
  },
  farm: { name: "", region: "", commune: "" },
  cartography: null,
  spreadsheet: null,
  blocks: [],
  quality: null,
  team: [],
  completedSteps: [],
};

/** Normaliza un jsonb guardado (posiblemente parcial o de una versión anterior) a OnboardingDraft. */
export function normalizeDraft(value: unknown): OnboardingDraft {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<OnboardingDraft>;
  return {
    ...EMPTY_DRAFT,
    ...raw,
    profile: { ...EMPTY_DRAFT.profile, ...(raw.profile ?? {}) },
    operation: { ...EMPTY_DRAFT.operation, ...(raw.operation ?? {}) },
    farm: { ...EMPTY_DRAFT.farm, ...(raw.farm ?? {}) },
    blocks: Array.isArray(raw.blocks) ? raw.blocks : [],
    team: Array.isArray(raw.team) ? raw.team : [],
    completedSteps: Array.isArray(raw.completedSteps) ? raw.completedSteps : [],
  };
}

/**
 * Props que recibe cada paso del asistente (src/features/onboarding/steps/*.tsx).
 * El shell (wizard.tsx) es dueño del estado, el autosave, los eventos y la navegación.
 */
export type StepProps = {
  sessionId: string;
  draft: OnboardingDraft;
  /** Mezcla superficial en el borrador y dispara autosave (debounced). */
  update: (patch: Partial<OnboardingDraft>) => void;
  /** Marca el paso como completado, registra el evento y avanza. */
  goNext: () => void;
  goBack: () => void;
  /** "Completar después": registra step_skip y avanza sin marcar completado. */
  skip: () => void;
  /** Solo en el paso "equipo": guarda y llama a complete_onboarding; luego el shell muestra "listo". */
  finish: () => Promise<void>;
  finishing: boolean;
  finishError: string | null;
  /** Id del fundo creado (solo disponible en el paso "listo"). */
  farmId: string | null;
  /** Segundos transcurridos desde started_at (para el cronómetro y el resumen final). */
  elapsedSeconds: number;
};
