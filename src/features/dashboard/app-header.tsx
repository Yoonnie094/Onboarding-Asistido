import Link from "next/link";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";

type Section = "fundos" | "metricas" | null;

const NAV_ITEMS = [
  { id: "fundos", href: "/dashboard", label: "Mis fundos" },
  { id: "metricas", href: "/dashboard/metricas", label: "Métricas de onboarding" },
] as const;

/** Encabezado común del panel: marca, navegación, acceso rápido a "Agregar fundo" y sesión. */
export function AppHeader({ email, active = null }: { email: string | null; active?: Section }) {
  return (
    <header className="sticky top-0 z-[1100] border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <div className="flex min-w-0 items-center gap-6">
          <Brand />
          <nav aria-label="Navegación principal" className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.id} active={active === item.id} href={item.href} label={item.label} />
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link
            className="hidden min-h-10 items-center rounded-lg border border-forest bg-forest px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-forest-dark sm:inline-flex"
            href="/onboarding?nuevo=1"
          >
            + Agregar fundo
          </Link>
          <p className="hidden max-w-48 truncate text-sm text-muted lg:block" title={email ?? undefined}>
            {email ?? "Cuenta activa"}
          </p>
          <SignOutButton />
        </div>
      </div>
      <nav
        aria-label="Navegación principal (móvil)"
        className="flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-2 md:hidden"
      >
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.id} active={active === item.id} href={item.href} label={item.label} />
        ))}
        <Link
          className="ml-auto shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold text-forest hover:bg-mist sm:hidden"
          href="/onboarding?nuevo=1"
        >
          + Agregar fundo
        </Link>
      </nav>
    </header>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
        active ? "bg-mist text-forest" : "text-muted hover:bg-mist hover:text-foreground"
      }`}
      href={href}
    >
      {label}
    </Link>
  );
}
