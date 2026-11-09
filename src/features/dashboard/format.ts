// Formateadores compartidos del panel (es-CL).

const numberFormatters = new Map<number, Intl.NumberFormat>();

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  let formatter = numberFormatters.get(decimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat("es-CL", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    numberFormatters.set(decimals, formatter);
  }
  return formatter.format(value);
}

export function formatHa(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${formatNumber(value, value >= 100 ? 0 : 1)} ha`;
}

export function formatPercent(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${formatNumber(value, decimals)}%`;
}

/** 452 → "7 min 32 s"; 45 → "45 s"; 3720 → "1 h 2 min". */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0) return secs > 0 ? `${minutes} min ${secs} s` : `${minutes} min`;
  return `${secs} s`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

/** "hace 5 minutos", "hace 2 días"… */
export function formatRelative(value: string | null | undefined, now = Date.now()): string {
  if (!value) return "—";
  const date = new Date(value).getTime();
  if (Number.isNaN(date)) return "—";
  const diffSeconds = Math.round((date - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat("es-CL", { numeric: "auto" });
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return rtf.format(diffSeconds, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSeconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSeconds / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSeconds / 86400), "day");
  return formatDate(value);
}

/** Une una lista: ["A","B","C"] → "A, B y C". */
export function joinList(items: string[], max = 5): string {
  if (items.length === 0) return "";
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  if (rest > 0) return `${shown.join(", ")} y ${rest} más`;
  if (shown.length === 1) return shown[0];
  return `${shown.slice(0, -1).join(", ")} y ${shown[shown.length - 1]}`;
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Color de la barra de calidad según puntaje. */
export function qualityTone(score: number | null): { bar: string; text: string; label: string } {
  if (score === null) return { bar: "bg-border", text: "text-muted", label: "Sin planilla" };
  if (score >= 85) return { bar: "bg-forest", text: "text-forest", label: "Buena" };
  if (score >= 60) return { bar: "bg-amber-500", text: "text-amber-700", label: "Mejorable" };
  return { bar: "bg-cherry", text: "text-cherry", label: "Baja" };
}
