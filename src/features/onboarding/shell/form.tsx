"use client";

import type { ReactNode } from "react";

/** Etiqueta + control + "por qué lo pedimos" + error, con los ids para aria-describedby. */
export function Field({
  id,
  label,
  required = false,
  why,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  why?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-foreground" htmlFor={id}>
        {label}
        {required ? (
          <span className="text-xs font-semibold text-cherry">Obligatorio</span>
        ) : (
          <span className="text-xs font-normal text-muted">Opcional</span>
        )}
      </label>
      {children}
      <FieldError id={`${id}-error`} message={error} />
      {why ? <WhyText id={`${id}-why`}>{why}</WhyText> : null}
    </div>
  );
}

export function FieldError({ id, message }: { id?: string; message?: string | null }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-xs font-semibold text-red-700" id={id} role="alert">
      <span aria-hidden="true">!</span>
      {message}
    </p>
  );
}

export function WhyText({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p className="mt-1.5 text-xs leading-5 text-muted" id={id}>
      <span className="font-semibold text-forest">Por qué lo pedimos: </span>
      {children}
    </p>
  );
}

/** describedby para inputs envueltos por <Field>. */
export function describedBy(id: string, hasError: boolean, hasWhy = true) {
  return [hasError ? `${id}-error` : null, hasWhy ? `${id}-why` : null].filter(Boolean).join(" ") || undefined;
}

/** Tarjeta seleccionable (radio o checkbox accesible). */
export function ChoiceCard({
  selected,
  onToggle,
  label,
  description,
  icon,
  disabled = false,
  multi = false,
  compact = false,
}: {
  selected: boolean;
  onToggle: () => void;
  label: string;
  description?: string;
  icon?: string;
  disabled?: boolean;
  multi?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      aria-checked={selected}
      className={`group relative flex w-full items-start gap-3 rounded-xl border text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${
        compact ? "px-3 py-2.5" : "px-4 py-3.5"
      } ${
        selected
          ? "border-forest bg-forest/5 shadow-sm ring-1 ring-forest"
          : "border-border bg-white hover:border-forest/50 hover:bg-mist/60"
      } ${disabled ? "cursor-not-allowed opacity-45 hover:border-border hover:bg-white" : "cursor-pointer"}`}
      disabled={disabled}
      onClick={onToggle}
      role={multi ? "checkbox" : "radio"}
      type="button"
    >
      {icon ? (
        <span
          aria-hidden="true"
          className={`flex shrink-0 items-center justify-center rounded-lg ${
            compact ? "h-8 w-8 text-lg" : "h-10 w-10 text-xl"
          } ${selected ? "bg-white" : "bg-mist"}`}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        {description ? <span className="mt-0.5 block text-xs leading-5 text-muted">{description}</span> : null}
      </span>
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border text-[11px] font-bold ${
          multi ? "rounded-md" : "rounded-full"
        } ${selected ? "border-forest bg-forest text-white" : "border-border bg-white text-transparent"}`}
      >
        ✓
      </span>
    </button>
  );
}

/** Bloque de pregunta para el perfilamiento progresivo. */
export function Question({
  number,
  title,
  why,
  aside,
  children,
  id,
}: {
  number: number;
  title: string;
  why?: string;
  aside?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <fieldset className="onb-reveal rounded-2xl border border-border bg-background/40 p-4 sm:p-5" id={id}>
      <legend className="sr-only">{title}</legend>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest text-xs font-bold text-white"
          >
            {number}
          </span>
          <div>
            <p className="font-semibold text-foreground">{title}</p>
            {why ? <p className="mt-0.5 text-xs leading-5 text-muted">{why}</p> : null}
          </div>
        </div>
        {aside}
      </div>
      {children}
    </fieldset>
  );
}

/** Estilos de animación propios del asistente (no dependen de globals.css). */
export const ONBOARDING_CSS = `
@keyframes onb-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes onb-flash { 0% { background-color: rgb(31 107 74 / 22%); } 100% { background-color: transparent; } }
.onb-reveal { animation: onb-fade-in 320ms ease-out both; }
.onb-flash { animation: onb-flash 1.4s ease-out; border-radius: 0.375rem; }
@keyframes onb-gauge { from { stroke-dashoffset: 100; } }
.onb-gauge { animation: onb-gauge 1s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
@keyframes onb-bar { from { transform: scaleX(0); } }
.onb-bar { transform-origin: left center; animation: onb-bar 800ms ease-out both; }
@keyframes onb-pop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); } }
.onb-pop { animation: onb-pop 420ms ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .onb-reveal, .onb-gauge, .onb-bar, .onb-pop, .onb-flash { animation: none; }
}
`;
