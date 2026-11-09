import Link from "next/link";
import { Brand } from "@/components/brand";
import { linkButtonClasses } from "@/features/dashboard/ui";

export default function FarmNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <Brand />
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-7 text-center shadow-sm sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cherry">Fundo no disponible</p>
        <h1 className="mt-3 font-serif text-2xl font-bold">No encontramos este fundo</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Puede que el enlace esté incompleto o que tu cuenta no tenga acceso a este fundo. Si crees que es un error,
          pídele al administrador que te invite.
        </p>
        <div className="mt-6 flex justify-center">
          <Link className={linkButtonClasses.primary} href="/dashboard">
            Volver a mis fundos
          </Link>
        </div>
      </section>
    </main>
  );
}
