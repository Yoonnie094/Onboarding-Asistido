import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();

  const { data: memberships, error: membershipsError } = await supabase
    .from("farm_memberships")
    .select("farm_id")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (membershipsError) {
    throw new Error("Unable to load farm memberships.");
  }

  const farmIds = [...new Set((memberships ?? []).map((membership) => membership.farm_id))];
  let farms: Array<{ id: string; name: string; created_at: string }> = [];

  if (farmIds.length > 0) {
    const { data, error } = await supabase
      .from("farms")
      .select("id, name, created_at")
      .in("id", farmIds)
      .order("name");

    if (error) {
      throw new Error("Unable to load farms.");
    }

    farms = data ?? [];
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Brand />
          <div className="flex items-center gap-3 sm:gap-5">
            <p className="hidden max-w-56 truncate text-sm text-muted sm:block">
              {user.email ?? "Cuenta activa"}
            </p>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-9 border-b border-border pb-7">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-forest">
            Espacio de trabajo
          </p>
          <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
            Tus fundos
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Consulta los fundos asociados a tu cuenta de CER Analytics.
          </p>
        </div>

        {farms.length === 0 ? (
          <section
            aria-labelledby="empty-farms-title"
            className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center sm:px-10"
          >
            <div
              aria-hidden="true"
              className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-mist text-2xl text-forest"
            >
              ◇
            </div>
            <h2 id="empty-farms-title" className="font-serif text-2xl font-bold">
              Aún no hay fundos asociados
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted">
              La creación y asignación de fundos todavía no está habilitada en esta fase. Cuando tu cuenta
              tenga acceso a un fundo, aparecerá aquí.
            </p>
          </section>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {farms.map((farm) => (
              <li key={farm.id}>
                <article className="h-full rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Fundo</p>
                  <h2 className="mt-2 font-serif text-xl font-bold">{farm.name}</h2>
                  <p className="mt-4 text-xs text-muted">
                    Asociado el {new Intl.DateTimeFormat("es-CL").format(new Date(farm.created_at))}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
