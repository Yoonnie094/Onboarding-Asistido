"use client";

export type SaveStatus =
  | { kind: "idle"; savedAt: string | null }
  | { kind: "pending"; savedAt: string | null }
  | { kind: "saving"; savedAt: string | null }
  | { kind: "saved"; savedAt: string }
  | { kind: "offline"; savedAt: string | null }
  | { kind: "error"; savedAt: string | null; message: string };

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const TIME_GOAL_SECONDS = 600;

/** Cronómetro con meta de 10 minutos (se pone ámbar al pasarse). */
export function Timer({ elapsedSeconds, finished }: { elapsedSeconds: number; finished: boolean }) {
  const over = elapsedSeconds > TIME_GOAL_SECONDS;
  return (
    <div
      aria-label={`Tiempo transcurrido ${formatClock(elapsedSeconds)}, meta 10 minutos`}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tabular-nums ${
        over ? "border-amber-300 bg-amber-50 text-amber-900" : "border-border bg-white text-foreground"
      }`}
      role="timer"
    >
      <span aria-hidden="true">⏱</span>
      <span className="text-sm">{formatClock(elapsedSeconds)}</span>
      <span className={over ? "text-amber-800" : "text-muted"}>
        {finished ? (over ? "· sobre la meta de 10:00" : "· dentro de la meta ✓") : "· Meta: 10:00"}
      </span>
    </div>
  );
}

function ago(savedAt: string | null, nowMs: number): string {
  if (!savedAt) return "";
  const diff = Math.max(0, Math.round((nowMs - Date.parse(savedAt)) / 1000));
  if (diff < 5) return "hace un momento";
  if (diff < 60) return `hace ${diff}s`;
  const minutes = Math.floor(diff / 60);
  return minutes < 60 ? `hace ${minutes} min` : `hace ${Math.floor(minutes / 60)} h`;
}

export function AutosaveIndicator({ status, nowMs }: { status: SaveStatus; nowMs: number }) {
  let dot = "bg-forest";
  let text: string;
  let tone = "text-muted";

  switch (status.kind) {
    case "pending":
    case "saving":
      dot = "bg-forest animate-pulse";
      text = "Guardando…";
      break;
    case "saved":
      text = `Guardado ✓ ${ago(status.savedAt, nowMs)}`;
      break;
    case "offline":
      dot = "bg-amber-500 animate-pulse";
      text = "Sin conexión — reintentando";
      tone = "text-amber-800";
      break;
    case "error":
      dot = "bg-red-600 animate-pulse";
      text = "No se pudo guardar — reintentando";
      tone = "text-red-700";
      break;
    default:
      text = "Guardado automático activado";
  }

  return (
    <p
      aria-live="polite"
      className={`inline-flex items-center gap-2 text-xs font-semibold ${tone}`}
      title={status.kind === "error" ? status.message : undefined}
    >
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dot}`} />
      {text}
    </p>
  );
}
