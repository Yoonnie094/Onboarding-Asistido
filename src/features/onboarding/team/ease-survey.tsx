"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { rateOnboarding } from "@/lib/onboarding/actions";

const LABELS = ["", "Muy difícil", "Difícil", "Normal", "Fácil", "Muy fácil"];

export function EaseSurvey({ sessionId }: { sessionId: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (rating < 1) return;
    setStatus("sending");
    setError(null);
    try {
      const result = await rateOnboarding(sessionId, rating, feedback.trim());
      if (result.ok) {
        setStatus("sent");
      } else {
        setStatus("error");
        setError(result.error ?? "No pudimos guardar tu respuesta.");
      }
    } catch {
      setStatus("error");
      setError("No pudimos guardar tu respuesta. Intenta de nuevo.");
    }
  }

  if (status === "sent") {
    return (
      <section className="rounded-2xl border border-border bg-card p-5 text-center">
        <p className="text-2xl text-amber-500" aria-hidden>
          {"★".repeat(rating)}
          <span className="text-border">{"★".repeat(5 - rating)}</span>
        </p>
        <h3 className="mt-2 text-base font-semibold">¡Gracias por tu opinión!</h3>
        <p className="text-sm text-muted">Nos ayuda a que configurar un fundo sea cada vez más simple.</p>
      </section>
    );
  }

  const shown = hover || rating;

  return (
    <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="ease-survey-title">
      <h3 className="text-base font-semibold" id="ease-survey-title">
        ¿Qué tan fácil fue configurar tu fundo?
      </h3>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Calificación de 1 a 5">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              aria-checked={rating === value}
              aria-label={`${value} de 5: ${LABELS[value]}`}
              className={`px-0.5 text-3xl leading-none transition-transform hover:scale-110 ${
                value <= shown ? "text-amber-500" : "text-border"
              }`}
              key={value}
              onClick={() => setRating(value)}
              onMouseEnter={() => setHover(value)}
              role="radio"
              type="button"
            >
              ★
            </button>
          ))}
        </div>
        <span className="text-sm font-medium text-muted">{shown ? LABELS[shown] : "Elige de 1 a 5"}</span>
      </div>
      <label className="mt-4 block text-sm font-medium">
        Comentario (opcional)
        <textarea
          className="form-input mt-1 min-h-20 resize-y"
          maxLength={1000}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder="¿Qué te costó más? ¿Qué mejorarías?"
          value={feedback}
        />
      </label>
      {error ? <p className="mt-2 text-sm text-cherry">{error}</p> : null}
      <div className="mt-3 flex justify-end">
        <Button disabled={rating < 1 || status === "sending"} onClick={() => void submit()} type="button" variant="secondary">
          {status === "sending" ? "Enviando…" : "Enviar opinión"}
        </Button>
      </div>
    </section>
  );
}
