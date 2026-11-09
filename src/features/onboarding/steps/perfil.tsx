"use client";

import { useState } from "react";
import { USER_ROLES, type UserRoleId } from "@/lib/onboarding/catalogs";
import type { ProfileAnswers, StepProps } from "@/lib/onboarding/types";
import { StepFooter } from "@/features/onboarding/step-footer";
import { ChoiceCard, Field, FieldError, WhyText, describedBy } from "@/features/onboarding/shell/form";

/** Normaliza un celular chileno a "+56 9 1234 5678". Devuelve null si no es válido. */
export function formatChileanPhone(value: string): string | null {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("56")) digits = digits.slice(2);
  if (digits.length === 8) digits = `9${digits}`;
  if (digits.length !== 9 || !digits.startsWith("9")) return null;
  return `+56 9 ${digits.slice(1, 5)} ${digits.slice(5)}`;
}

function validateName(value: string): string | null {
  const v = value.trim();
  if (!v) return "Escribe tu nombre completo.";
  if (v.length < 3) return "El nombre es muy corto.";
  if (/\d/.test(v)) return "El nombre no debería tener números.";
  return null;
}

function validatePhone(value: string): string | null {
  if (!value.trim()) return null;
  return formatChileanPhone(value) ? null : "Usa el formato +56 9 1234 5678.";
}

export function PerfilStep({ draft, update, goNext }: StepProps) {
  const profile = draft.profile;
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const setProfile = (patch: Partial<ProfileAnswers>) => update({ profile: { ...profile, ...patch } });
  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  const nameError = validateName(profile.fullName);
  const phoneError = validatePhone(profile.phone);
  const roleMissing = !profile.userRole;

  const showNameError = touched.fullName ? nameError : null;
  const showPhoneError = touched.phone ? phoneError : null;

  const missing: string[] = [];
  if (nameError) missing.push("tu nombre");
  if (roleMissing) missing.push("tu rol");
  const canContinue = !nameError && !phoneError && !roleMissing;
  const hint = canContinue
    ? null
    : phoneError && missing.length === 0
      ? "Corrige el teléfono o déjalo en blanco."
      : `Para continuar, completa ${missing.join(" y ")}.`;

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field
            error={showNameError}
            id="perfil-nombre"
            label="Nombre completo"
            required
            why="Para saludarte y para que tu equipo sepa quién lo invitó."
          >
            <input
              aria-describedby={describedBy("perfil-nombre", Boolean(showNameError))}
              aria-invalid={Boolean(showNameError)}
              autoComplete="name"
              autoFocus={!profile.fullName}
              className="form-input"
              id="perfil-nombre"
              maxLength={120}
              onBlur={() => touch("fullName")}
              onChange={(e) => setProfile({ fullName: e.target.value })}
              placeholder="Ej.: María José Fuentes"
              value={profile.fullName}
            />
          </Field>
        </div>

        <Field id="perfil-cargo" label="Cargo" why="Nos ayuda a mostrarte primero lo que más usas.">
          <input
            aria-describedby={describedBy("perfil-cargo", false)}
            autoComplete="organization-title"
            className="form-input"
            id="perfil-cargo"
            maxLength={80}
            onChange={(e) => setProfile({ jobTitle: e.target.value })}
            placeholder="Ej.: Jefa de campo"
            value={profile.jobTitle}
          />
        </Field>

        <Field
          error={showPhoneError}
          id="perfil-telefono"
          label="Teléfono"
          why="Solo para alertas urgentes (heladas, conteos fuera de rango). Nunca para publicidad."
        >
          <input
            aria-describedby={describedBy("perfil-telefono", Boolean(showPhoneError))}
            aria-invalid={Boolean(showPhoneError)}
            autoComplete="tel"
            className="form-input"
            id="perfil-telefono"
            inputMode="tel"
            maxLength={20}
            onBlur={() => {
              touch("phone");
              const formatted = formatChileanPhone(profile.phone);
              if (formatted && formatted !== profile.phone) setProfile({ phone: formatted });
            }}
            onChange={(e) => setProfile({ phone: e.target.value })}
            placeholder="+56 9 1234 5678"
            type="tel"
            value={profile.phone}
          />
        </Field>
      </div>

      <div className="mt-7">
        <p className="mb-1 flex items-baseline gap-2 text-sm font-semibold" id="perfil-rol-label">
          ¿Cuál es tu rol?
          <span className="text-xs font-semibold text-cherry">Obligatorio</span>
        </p>
        <WhyText id="perfil-rol-why">
          Según tu rol adaptamos el panel, los permisos y el tipo de recomendaciones que te mostramos.
        </WhyText>
        <div
          aria-describedby="perfil-rol-why"
          aria-labelledby="perfil-rol-label"
          aria-invalid={touched.role && roleMissing ? true : undefined}
          className="mt-3 grid gap-3 sm:grid-cols-2"
          role="radiogroup"
        >
          {USER_ROLES.map((role) => (
            <ChoiceCard
              description={role.description}
              icon={role.icon}
              key={role.id}
              label={role.label}
              onToggle={() => {
                touch("role");
                setProfile({ userRole: role.id as UserRoleId });
              }}
              selected={profile.userRole === role.id}
            />
          ))}
        </div>
        {touched.role && roleMissing ? <FieldError message="Elige el rol que mejor te describe." /> : null}

        {profile.userRole === "muestreador" ? (
          <div
            className="onb-reveal mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"
            role="status"
          >
            <p className="font-semibold">¿Eres muestreador?</p>
            <p>
              Normalmente el administrador de tu fundo te invita por correo y ya tendrás tus cuarteles asignados.
              Si quieres probar la plataforma, puedes continuar igual y crear un fundo de prueba.
            </p>
          </div>
        ) : null}
      </div>

      <StepFooter hint={hint} nextDisabled={!canContinue} onNext={goNext} />
    </div>
  );
}
