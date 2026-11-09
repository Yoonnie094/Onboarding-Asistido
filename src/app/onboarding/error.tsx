"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function OnboardingError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-7 text-center shadow-sm sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cherry">Algo salió mal</p>
        <h1 className="mt-3 font-serif text-2xl font-bold">No pudimos cargar el asistente</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Tu avance queda guardado automáticamente. Vuelve a intentarlo y continuarás donde quedaste.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={() => retry()} type="button">
            Volver a intentar
          </Button>
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-white px-5 text-sm font-semibold hover:bg-mist"
            href="/dashboard"
          >
            Ir al panel
          </Link>
        </div>
      </section>
    </main>
  );
}
