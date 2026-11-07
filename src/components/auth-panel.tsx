import type { ReactNode } from "react";
import { Brand } from "@/components/brand";

export function AuthPanel({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(320px,0.9fr)_1.1fr]">
      <section className="relative hidden overflow-hidden bg-forest px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div className="absolute -right-36 top-1/4 h-96 w-96 rounded-full border border-white/10" />
        <div className="absolute -right-20 top-[30%] h-64 w-64 rounded-full border border-white/10" />
        <Brand light />
        <div className="relative max-w-lg pb-12">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.22em] text-[#b9ddc6]">
            CER Analytics · Configura tu fundo
          </p>
          <p className="font-serif text-4xl leading-tight xl:text-5xl">
            Datos claros para una operación bien preparada.
          </p>
          <p className="mt-6 max-w-md text-base leading-7 text-white/75">
            Un espacio de trabajo para organizar la configuración de cada fundo.
          </p>
        </div>
        <p className="relative text-xs text-white/55">Plataforma CER Analytics</p>
      </section>

      <section className="flex min-h-screen flex-col px-5 py-7 sm:px-10 lg:px-12">
        <div className="mx-auto w-full max-w-xl lg:hidden">
          <Brand />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-forest">
                {eyebrow}
              </p>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {title}
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
            </div>
            {children}
            <div className="mt-7 border-t border-border pt-6 text-sm text-muted">
              {footer}
            </div>
          </div>
        </div>
        <p className="mx-auto w-full max-w-xl text-xs text-muted lg:text-center">
          Acceso protegido · CER Analytics
        </p>
      </section>
    </main>
  );
}
