"use client";

import {
  DIAGNOSTIC_QUESTIONS,
  MATURITY_LEVELS,
  type DiagnosticResult,
  type MaturityLevel,
} from "@/lib/onboarding/diagnostic";

/** Mismos cortes que scoreDiagnostic: < 40 inicial, < 70 en desarrollo, resto avanzado. */
function levelFor(score: number): MaturityLevel {
  return score < 40 ? "inicial" : score < 70 ? "en_desarrollo" : "avanzado";
}

const ZONES: { from: number; to: number; level: MaturityLevel }[] = [
  { from: 0, to: 40, level: "inicial" },
  { from: 40, to: 70, level: "en_desarrollo" },
  { from: 70, to: 100, level: "avanzado" },
];

// Semicírculo: centro (100, 100), radio 80. pathLength=100 permite trabajar en porcentaje.
const ARC = "M 20 100 A 80 80 0 0 1 180 100";

function pointOnArc(percent: number, radius: number) {
  const angle = Math.PI * (1 - percent / 100);
  return { x: 100 + radius * Math.cos(angle), y: 100 - radius * Math.sin(angle) };
}

export function MaturityGauge({ score, level }: { score: number; level: MaturityLevel }) {
  const safe = Math.max(0, Math.min(100, Math.round(score)));
  const meta = MATURITY_LEVELS[level];

  return (
    <figure className="relative mx-auto w-full max-w-72">
      <svg aria-hidden="true" className="block w-full" viewBox="0 0 200 116">
        {ZONES.map((zone) => (
          <path
            d={ARC}
            fill="none"
            key={zone.level}
            pathLength={100}
            stroke={MATURITY_LEVELS[zone.level].color}
            strokeDasharray={`${zone.to - zone.from} 100`}
            strokeDashoffset={-zone.from}
            strokeOpacity={0.16}
            strokeWidth={18}
          />
        ))}
        {[40, 70].map((tick) => {
          const inner = pointOnArc(tick, 68);
          const outer = pointOnArc(tick, 92);
          return (
            <line
              key={tick}
              stroke="var(--card)"
              strokeWidth={2.5}
              x1={inner.x}
              x2={outer.x}
              y1={inner.y}
              y2={outer.y}
            />
          );
        })}
        <path
          className="onb-gauge"
          d={ARC}
          fill="none"
          pathLength={100}
          stroke={meta.color}
          strokeDasharray="100 100"
          strokeLinecap="round"
          strokeWidth={18}
          style={{ strokeDashoffset: 100 - Math.max(safe, 1) }}
        />
        <text fill="var(--muted)" fontSize="9" textAnchor="middle" x="20" y="114">
          0
        </text>
        <text fill="var(--muted)" fontSize="9" textAnchor="middle" x="180" y="114">
          100
        </text>
      </svg>
      <figcaption className="absolute inset-x-0 bottom-3 text-center">
        <span className="block font-serif text-5xl font-bold tabular-nums leading-none" style={{ color: meta.color }}>
          {safe}
        </span>
        <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          de 100 puntos
        </span>
      </figcaption>
    </figure>
  );
}

export function DiagnosticResultView({
  result,
  saved,
  onRepeat,
  onRetrySave,
}: {
  result: DiagnosticResult;
  saved: boolean;
  onRepeat: () => void;
  /** Solo si el resultado no se pudo guardar. */
  onRetrySave?: () => void;
}) {
  const meta = MATURITY_LEVELS[result.level] ?? MATURITY_LEVELS.inicial;
  const dimensions = DIAGNOSTIC_QUESTIONS.filter((q) => typeof result.dimensions?.[q.id] === "number");
  const advice = Array.isArray(result.advice) ? result.advice : [];

  return (
    <div className="onb-reveal grid gap-6">
      <div className="grid items-center gap-6 md:grid-cols-[minmax(0,17rem)_1fr]">
        <div role="img" aria-label={`Madurez digital: ${Math.round(result.score)} de 100, nivel ${meta.label}`}>
          <MaturityGauge level={result.level} score={result.score} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Tu nivel de madurez digital</p>
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-3 py-1 font-serif text-xl font-bold text-white"
              style={{ backgroundColor: meta.color }}
            >
              {meta.label}
            </span>
            {saved ? (
              <span className="rounded-full bg-mist px-2.5 py-1 text-[11px] font-semibold text-forest">
                ✓ Guardado en el perfil de tu fundo
              </span>
            ) : (
              <>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                  Sin guardar
                </span>
                {onRetrySave ? (
                  <button
                    className="text-xs font-semibold text-forest underline-offset-4 hover:underline"
                    onClick={onRetrySave}
                    type="button"
                  >
                    Reintentar guardar
                  </button>
                ) : null}
              </>
            )}
          </p>
          <p className="mt-3 max-w-xl text-sm leading-6">{meta.description}</p>
          <ol className="mt-3 flex gap-1.5" aria-label="Escala de niveles">
            {ZONES.map((zone) => {
              const active = zone.level === result.level;
              return (
                <li
                  className={`flex-1 rounded-md border px-2 py-1 text-center text-[11px] font-semibold ${
                    active ? "text-white" : "border-border text-muted"
                  }`}
                  key={zone.level}
                  style={
                    active
                      ? { backgroundColor: MATURITY_LEVELS[zone.level].color, borderColor: MATURITY_LEVELS[zone.level].color }
                      : undefined
                  }
                >
                  {MATURITY_LEVELS[zone.level].label}
                  <span className={`block font-normal ${active ? "text-white/80" : ""}`}>
                    {zone.from}–{zone.to}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="diag-dims-title">
          <h4 className="text-sm font-semibold" id="diag-dims-title">
            Puntaje por dimensión
          </h4>
          <ul className="mt-3 grid gap-3">
            {dimensions.map((question, index) => {
              const value = Math.round(result.dimensions[question.id]);
              const color = MATURITY_LEVELS[levelFor(value)].color;
              const answer = question.options.find((option) => option.value === result.answers?.[question.id]);
              return (
                <li key={question.id}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{question.dimension}</span>
                    <span className="font-semibold tabular-nums" style={{ color }}>
                      {value}
                    </span>
                  </div>
                  <div
                    aria-label={`${question.dimension}: ${value} de 100`}
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={value}
                    className="mt-1 h-2.5 overflow-hidden rounded-full bg-mist"
                    role="meter"
                  >
                    <div
                      className="onb-bar h-full rounded-full"
                      style={{
                        width: `${Math.max(value, 3)}%`,
                        backgroundColor: color,
                        animationDelay: `${150 + index * 80}ms`,
                      }}
                    />
                  </div>
                  {answer ? <p className="mt-0.5 text-xs text-muted">Hoy: {answer.label}</p> : null}
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="diag-advice-title" className="rounded-xl border border-forest/25 bg-mist/60 p-4">
          <h4 className="text-sm font-semibold" id="diag-advice-title">
            Tus prioridades
          </h4>
          {advice.length > 0 ? (
            <>
              <p className="text-xs text-muted">Lo que más valor te dará, según tus respuestas.</p>
              <ol className="mt-3 grid gap-2.5">
                {advice.map((text, index) => (
                  <li className="flex gap-3 text-sm leading-6" key={text}>
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-forest text-xs font-bold text-white"
                    >
                      {index + 1}
                    </span>
                    <span>{text}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="mt-2 text-sm leading-6">
              Tu operación ya trabaja con datos digitales en todas las dimensiones. El siguiente paso es activar alertas
              por cuartel y comparar temporadas para anticiparte.
            </p>
          )}
          <p className="mt-4 border-t border-forest/15 pt-3 text-xs leading-5 text-muted">
            Con este resultado, el equipo de CER ajusta tu acompañamiento: capacitación, frecuencia de seguimiento y
            qué módulos activar primero.
          </p>
        </section>
      </div>

      <div className="flex justify-end">
        <button
          className="text-sm font-semibold text-forest underline-offset-4 hover:underline"
          onClick={onRepeat}
          type="button"
        >
          ↻ Repetir diagnóstico
        </button>
      </div>
    </div>
  );
}
