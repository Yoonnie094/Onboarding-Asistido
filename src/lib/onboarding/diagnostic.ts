// Encuesta de diagnóstico de madurez digital (EV2 INNO 3: "levantamiento guiado inicial y
// encuesta diagnóstica para medir madurez digital") + microencuestas en hitos clave.
// Escala por pregunta: 1 (inicial) a 4 (avanzado). Puntaje total 0-100.

export type DiagnosticOption = { value: 1 | 2 | 3 | 4; label: string };

export type DiagnosticQuestion = {
  /** id = dimensión que mide */
  id: "registro" | "cartografia" | "decisiones" | "colaboracion" | "adopcion" | "historico";
  dimension: string;
  question: string;
  options: readonly DiagnosticOption[];
  /** Recomendación si la dimensión queda baja (≤ 2). */
  advice: string;
};

export const DIAGNOSTIC_QUESTIONS: readonly DiagnosticQuestion[] = [
  {
    id: "registro",
    dimension: "Registro de datos",
    question: "¿Cómo registran hoy los datos de campo (conteos, labores, cosecha)?",
    options: [
      { value: 1, label: "En papel o cuaderno" },
      { value: 2, label: "Planillas Excel en un computador" },
      { value: 3, label: "Planillas compartidas en la nube" },
      { value: 4, label: "App o sistema conectado" },
    ],
    advice: "Digitaliza los conteos en terreno con CER Counter para eliminar la transcripción desde papel.",
  },
  {
    id: "cartografia",
    dimension: "Cartografía digital",
    question: "¿Tienen los cuarteles del fundo en un mapa digital?",
    options: [
      { value: 1, label: "No tenemos mapa" },
      { value: 2, label: "Solo un plano en PDF o imagen" },
      { value: 3, label: "KML de algunos cuarteles" },
      { value: 4, label: "Mapa GIS completo y actualizado" },
    ],
    advice: "Completa y mantén actualizado el mapa de cuarteles: es la base para asignar muestreos y comparar.",
  },
  {
    id: "decisiones",
    dimension: "Uso de datos para decidir",
    question: "¿Con qué frecuencia revisan indicadores para tomar decisiones?",
    options: [
      { value: 1, label: "Al final de la temporada" },
      { value: 2, label: "Una vez al mes" },
      { value: 3, label: "Cada semana" },
      { value: 4, label: "A diario o con alertas" },
    ],
    advice: "Activa un resumen semanal en tu panel y alertas por cuartel para decidir a tiempo.",
  },
  {
    id: "colaboracion",
    dimension: "Colaboración del equipo",
    question: "¿Cómo comparte la información el equipo (administración, agrónomos, terreno)?",
    options: [
      { value: 1, label: "De palabra o por WhatsApp" },
      { value: 2, label: "Correos con archivos adjuntos" },
      { value: 3, label: "Carpeta compartida" },
      { value: 4, label: "Una plataforma común con roles" },
    ],
    advice: "Invita a todo tu equipo con su rol para que trabajen sobre los mismos datos.",
  },
  {
    id: "adopcion",
    dimension: "Adopción tecnológica",
    question: "¿Qué tan cómodo se siente el equipo de terreno usando apps en el celular?",
    options: [
      { value: 1, label: "Poco: prefieren papel" },
      { value: 2, label: "Algunos lo usan" },
      { value: 3, label: "La mayoría lo usa sin problemas" },
      { value: 4, label: "Todos, ya usan apps de trabajo" },
    ],
    advice: "Agenda una inducción corta de la app con los muestreadores y parte con un cuartel piloto.",
  },
  {
    id: "historico",
    dimension: "Datos históricos",
    question: "¿Usan datos de temporadas anteriores para planificar?",
    options: [
      { value: 1, label: "No los tenemos ordenados" },
      { value: 2, label: "A veces, cuando los encontramos" },
      { value: 3, label: "Sí, cada temporada" },
      { value: 4, label: "Sí, con modelos o proyecciones" },
    ],
    advice: "Carga 2 o más temporadas históricas por cuartel para habilitar comparaciones y predicción.",
  },
] as const;

export type DiagnosticAnswers = Partial<Record<DiagnosticQuestion["id"], 1 | 2 | 3 | 4>>;

export type MaturityLevel = "inicial" | "en_desarrollo" | "avanzado";

export const MATURITY_LEVELS: Record<MaturityLevel, { label: string; description: string; color: string }> = {
  inicial: {
    label: "Inicial",
    description: "La información vive en papel o planillas sueltas. El mayor valor está en ordenar y digitalizar.",
    color: "#a4243b",
  },
  en_desarrollo: {
    label: "En desarrollo",
    description: "Ya hay datos digitales, pero dispersos. El siguiente salto es centralizarlos y usarlos cada semana.",
    color: "#c58a1c",
  },
  avanzado: {
    label: "Avanzado",
    description: "Datos digitales y compartidos. Están listos para alertas y modelos predictivos.",
    color: "#1f6b4a",
  },
};

/** Resultado que se guarda en onboarding_sessions.diagnostic y farms.context.diagnostic. */
export type DiagnosticResult = {
  answers: DiagnosticAnswers;
  /** 0-100 */
  score: number;
  level: MaturityLevel;
  /** dimensión -> 0-100 */
  dimensions: Record<string, number>;
  /** Consejos para las dimensiones más débiles (máx. 3). */
  advice: string[];
  completedAt: string;
};

const toPct = (value: number) => Math.round(((value - 1) / 3) * 100);

export function scoreDiagnostic(answers: DiagnosticAnswers): DiagnosticResult {
  const answered = DIAGNOSTIC_QUESTIONS.filter((q) => answers[q.id] !== undefined);
  const dimensions: Record<string, number> = {};
  for (const q of answered) dimensions[q.id] = toPct(answers[q.id] as number);

  const avg = answered.length
    ? answered.reduce((sum, q) => sum + (answers[q.id] as number), 0) / answered.length
    : 1;
  const score = toPct(avg);
  const level: MaturityLevel = score < 40 ? "inicial" : score < 70 ? "en_desarrollo" : "avanzado";

  const advice = [...answered]
    .filter((q) => (answers[q.id] as number) <= 2)
    .sort((a, b) => (answers[a.id] as number) - (answers[b.id] as number))
    .slice(0, 3)
    .map((q) => q.advice);

  return { answers, score, level, dimensions, advice, completedAt: new Date().toISOString() };
}

export function isDiagnosticResult(value: unknown): value is DiagnosticResult {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as DiagnosticResult).score === "number" &&
    typeof (value as DiagnosticResult).level === "string"
  );
}

/** Microencuestas contextuales en hitos clave (EV2 INNO 3: "primer cuartel configurado"). */
export const MICRO_SURVEYS = {
  cuarteles_configurados: {
    milestone: "cuarteles_configurados",
    question: "¿Qué tan fácil fue cargar y validar tus cuarteles?",
  },
  equipo_asignado: {
    milestone: "equipo_asignado",
    question: "¿Qué tan fácil fue invitar y asignar a tu equipo?",
  },
} as const;

export type MicroSurveyMilestone = keyof typeof MICRO_SURVEYS;

export const MILESTONE_LABELS: Record<string, string> = {
  cuarteles_configurados: "Cuarteles configurados",
  equipo_asignado: "Equipo asignado",
};
