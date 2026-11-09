"use client";

import { useState } from "react";
import { REGIONS, SPECIES, labelOf, type RegionId } from "@/lib/onboarding/catalogs";
import type { FarmAnswers, StepProps } from "@/lib/onboarding/types";
import { StepFooter } from "@/features/onboarding/step-footer";
import { Field, describedBy } from "@/features/onboarding/shell/form";

/** Comunas frecuentes por región (solo sugerencias; el campo acepta cualquier texto). */
const COMMUNES_BY_REGION: Partial<Record<RegionId, string[]>> = {
  VI: [
    "Rengo", "Requínoa", "San Fernando", "Rancagua", "Machalí", "Malloa", "Quinta de Tilcoco",
    "Chimbarongo", "Santa Cruz", "Nancagua", "Peumo", "Graneros", "Olivar", "Codegua", "San Vicente",
  ],
  VII: ["Curicó", "Molina", "Romeral", "Teno", "Sagrada Familia", "Rauco", "Talca", "San Clemente", "Linares", "Longaví"],
  RM: ["Paine", "Buin", "Melipilla", "Talagante", "Isla de Maipo", "Pirque", "Curacaví", "Calera de Tango"],
  XVI: ["Chillán", "San Carlos", "Bulnes", "Coihueco", "San Nicolás"],
  V: ["Los Andes", "San Felipe", "Quillota", "La Cruz", "Hijuelas", "Putaendo"],
  VIII: ["Los Ángeles", "Mulchén", "Negrete", "Nacimiento"],
  IX: ["Angol", "Renaico", "Collipulli", "Victoria"],
  IV: ["Ovalle", "Monte Patria", "Vicuña", "La Serena"],
};

const DEMO_FARM: FarmAnswers = { name: "Fundo Santa Elena", region: "VI", commune: "Rengo" };

function validateName(value: string): string | null {
  const v = value.trim();
  if (!v) return "Ponle un nombre a tu fundo.";
  if (v.length < 3) return "El nombre es muy corto.";
  return null;
}

export function FundoStep({ draft, update, goNext, goBack }: StepProps) {
  const farm = draft.farm;
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [usedDemo, setUsedDemo] = useState(false);

  const setFarm = (patch: Partial<FarmAnswers>) => update({ farm: { ...farm, ...patch } });
  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  const nameError = validateName(farm.name);
  const regionError = farm.region ? null : "Elige la región donde está el fundo.";
  const showNameError = touched.name ? nameError : null;
  const showRegionError = touched.region ? regionError : null;

  const manyFarms = draft.operation.farmCountRange !== "" && draft.operation.farmCountRange !== "1";
  const communes = farm.region ? (COMMUNES_BY_REGION[farm.region] ?? []) : [];

  const missing: string[] = [];
  if (nameError) missing.push("el nombre");
  if (regionError) missing.push("la región");
  const canContinue = missing.length === 0;

  const speciesLabel = draft.operation.species.length
    ? draft.operation.species.map((id) => labelOf(SPECIES, id)).join(", ")
    : null;
  const speciesIcon = draft.operation.species.length
    ? (SPECIES.find((s) => s.id === draft.operation.species[0])?.icon ?? "🌱")
    : "🌱";

  function fillDemo() {
    update({ farm: { ...DEMO_FARM } });
    setTouched({ name: true, region: true });
    setUsedDemo(true);
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-forest/40 bg-mist/60 px-4 py-3">
        <p className="text-sm text-forest-dark">
          <span className="font-semibold">¿Estás en una demo?</span> Rellena con un fundo de ejemplo en Rengo.
        </p>
        <button
          className="inline-flex min-h-9 items-center rounded-lg border border-forest bg-white px-3 text-xs font-semibold text-forest hover:bg-forest hover:text-white"
          onClick={fillDemo}
          type="button"
        >
          Usar datos de ejemplo
        </button>
      </div>

      {usedDemo ? (
        <p className="onb-reveal -mt-2 mb-4 text-xs font-semibold text-forest" role="status">
          ✓ Listo: cargamos «Fundo Santa Elena» (Rengo, O&apos;Higgins). Puedes editarlo si quieres.
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field
            error={showNameError}
            id="fundo-nombre"
            label="Nombre del fundo"
            required
            why="Es como aparecerá en tu panel, reportes e invitaciones al equipo."
          >
            <input
              aria-describedby={describedBy("fundo-nombre", Boolean(showNameError))}
              aria-invalid={Boolean(showNameError)}
              autoFocus={!farm.name}
              className="form-input"
              id="fundo-nombre"
              maxLength={80}
              onBlur={() => touch("name")}
              onChange={(e) => setFarm({ name: e.target.value })}
              placeholder="Ej.: Fundo Santa Elena"
              value={farm.name}
            />
          </Field>
        </div>

        <Field
          error={showRegionError}
          id="fundo-region"
          label="Región"
          required
          why="Usamos la región para el clima, las alertas de heladas y comparar con fundos cercanos."
        >
          <select
            aria-describedby={describedBy("fundo-region", Boolean(showRegionError))}
            aria-invalid={Boolean(showRegionError)}
            className="form-input"
            id="fundo-region"
            onBlur={() => touch("region")}
            onChange={(e) => {
              touch("region");
              setFarm({ region: e.target.value as RegionId | "" });
            }}
            value={farm.region}
          >
            <option value="">Selecciona una región…</option>
            {REGIONS.map((region) => (
              <option key={region.id} value={region.id}>
                {region.label}
              </option>
            ))}
          </select>
        </Field>

        <Field id="fundo-comuna" label="Comuna" why="Afina la ubicación para el pronóstico del tiempo.">
          <input
            aria-describedby={describedBy("fundo-comuna", false)}
            autoComplete="address-level2"
            className="form-input"
            id="fundo-comuna"
            list={communes.length ? "fundo-comunas" : undefined}
            maxLength={60}
            onChange={(e) => setFarm({ commune: e.target.value })}
            placeholder={communes[0] ? `Ej.: ${communes[0]}` : "Ej.: Rengo"}
            value={farm.commune}
          />
          {communes.length ? (
            <datalist id="fundo-comunas">
              {communes.map((commune) => (
                <option key={commune} value={commune} />
              ))}
            </datalist>
          ) : null}
        </Field>
      </div>

      {manyFarms ? (
        <div className="mt-5 rounded-xl border border-border bg-mist px-4 py-3 text-sm text-foreground" role="note">
          <span className="font-semibold">Manejas más de un fundo.</span> Empecemos por este; podrás agregar los
          demás después desde tu panel.
        </div>
      ) : null}

      <div className="mt-7">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-muted">Así se verá en tu panel</p>
        <article className="flex items-center gap-4 rounded-2xl border border-border bg-white p-4 shadow-sm">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-mist text-2xl"
          >
            {speciesIcon}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Fundo</p>
            <p className="truncate font-serif text-lg font-bold">
              {farm.name.trim() || <span className="text-muted/70">Nombre del fundo</span>}
            </p>
            <p className="truncate text-xs text-muted">
              {[farm.commune.trim() || null, farm.region ? labelOf(REGIONS, farm.region) : null]
                .filter(Boolean)
                .join(", ") || "Ubicación pendiente"}
              {speciesLabel ? ` · ${speciesLabel}` : ""}
            </p>
          </div>
        </article>
      </div>

      <StepFooter
        hint={canContinue ? null : `Para continuar, completa ${missing.join(" y ")}.`}
        nextDisabled={!canContinue}
        onBack={goBack}
        onNext={goNext}
      />
    </div>
  );
}
