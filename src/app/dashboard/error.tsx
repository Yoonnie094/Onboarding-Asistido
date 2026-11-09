"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = error instanceof Error && "digest" in error ? String((error as { digest?: unknown }).digest ?? "") : "";

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-7 text-center shadow-sm sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cherry">No se pudo cargar</p>
        <h1 className="mt-3 font-serif text-2xl font-bold">Tuvimos un problema temporal</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          No fue posible consultar la información del panel. Revisa tu conexión e inténtalo nuevamente. Si el problema
          sigue, confirma que la base de datos tenga aplicada la migración del onboarding.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={() => retry()} type="button">
            Volver a intentar
          </Button>
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-white px-5 py-3 text-sm font-semibold shadow-sm hover:bg-mist"
            href="/dashboard"
          >
            Ir a mis fundos
          </Link>
        </div>
        {digest ? <p className="mt-4 text-xs text-muted">Código: {digest}</p> : null}
      </section>
    </main>
  );
}
