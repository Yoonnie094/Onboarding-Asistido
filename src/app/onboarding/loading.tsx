export default function OnboardingLoading() {
  return (
    <main aria-busy="true" aria-live="polite" className="min-h-screen">
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="h-10 w-48 animate-pulse rounded-xl bg-mist" />
          <div className="h-9 w-32 animate-pulse rounded-lg bg-mist" />
        </div>
        <div className="mx-auto flex max-w-7xl gap-2 px-5 pb-4 sm:px-8">
          {Array.from({ length: 8 }).map((_, index) => (
            <div className="h-2 flex-1 animate-pulse rounded-full bg-mist" key={index} />
          ))}
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 sm:px-8 lg:grid-cols-[1fr_340px]">
        <div className="h-[28rem] animate-pulse rounded-2xl border border-border bg-card" />
        <div className="hidden h-80 animate-pulse rounded-2xl border border-border bg-card lg:block" />
      </div>
      <span className="sr-only">Preparando tu asistente de configuración…</span>
    </main>
  );
}
