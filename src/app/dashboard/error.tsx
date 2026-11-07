"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-7 text-center shadow-sm sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cherry">No se pudo cargar</p>
        <h1 className="mt-3 font-serif text-2xl font-bold">Tuvimos un problema temporal</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          No fue posible consultar los fundos asociados. Inténtalo nuevamente en unos momentos.
        </p>
        <Button className="mt-6" onClick={reset} type="button">
          Volver a intentar
        </Button>
      </section>
    </main>
  );
}
