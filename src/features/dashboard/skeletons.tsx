/** Esqueletos de carga del panel (sin datos, sin cliente). */

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-mist ${className}`} />;
}

function HeaderSkeleton() {
  return (
    <div className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-8">
        <Bar className="h-10 w-44" />
        <Bar className="h-10 w-28" />
      </div>
    </div>
  );
}

export function DashboardSkeleton({ label = "Cargando tus fundos…" }: { label?: string }) {
  return (
    <main aria-busy="true" aria-live="polite" className="min-h-screen">
      <HeaderSkeleton />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
        <Bar className="h-4 w-32" />
        <Bar className="mt-3 h-10 w-64" />
        <Bar className="mt-3 h-4 w-96 max-w-full" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-60 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
        <span className="sr-only">{label}</span>
      </div>
    </main>
  );
}

export function FarmSkeleton() {
  return (
    <main aria-busy="true" aria-live="polite" className="min-h-screen">
      <HeaderSkeleton />
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-8 sm:py-10">
        <div>
          <Bar className="h-4 w-24" />
          <Bar className="mt-4 h-10 w-72" />
          <Bar className="mt-3 h-4 w-60" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
        <div className="h-44 animate-pulse rounded-2xl border border-border bg-card" />
        <div className="grid gap-4 lg:grid-cols-[2.2fr_1fr]">
          <div className="h-[480px] animate-pulse rounded-2xl border border-border bg-mist" />
          <div className="h-[480px] animate-pulse rounded-2xl border border-border bg-card" />
        </div>
        <span className="sr-only">Cargando el panel del fundo…</span>
      </div>
    </main>
  );
}
