export default function DashboardLoading() {
  return (
    <main aria-busy="true" aria-live="polite" className="min-h-screen">
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-5 py-5 sm:px-8">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-mist" />
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-mist" />
        <div className="mt-8 h-56 animate-pulse rounded-2xl border border-border bg-card" />
        <span className="sr-only">Cargando fundos asociados…</span>
      </div>
    </main>
  );
}
