"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { MEMBERSHIP_ROLES, type MembershipRoleId } from "@/lib/onboarding/catalogs";
import type { TeamInvite } from "@/lib/onboarding/types";

import { emailError } from "./team-utils";

const ROLE_HELP: Record<MembershipRoleId, string> = {
  administrador: "Ve y edita todo el fundo, incluido el equipo.",
  agronomo: "Ve todos los cuarteles y analiza los resultados.",
  muestreador: "Registra conteos solo en los cuarteles que le asignes.",
};

export function InviteForm({ team, onAdd }: { team: TeamInvite[]; onAdd: (invite: TeamInvite) => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MembershipRoleId>("muestreador");
  const [touched, setTouched] = useState(false);

  const error = emailError(email, team);
  const showError = touched && email.length > 0 && error;
  const canAdd = !error && fullName.trim().length > 0;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!canAdd) return;
    onAdd({ fullName: fullName.trim(), email: email.trim().toLowerCase(), role, blockCodes: [] });
    setFullName("");
    setEmail("");
    setRole("muestreador");
    setTouched(false);
  }

  return (
    <form className="rounded-2xl border border-border bg-card p-5" noValidate onSubmit={handleSubmit}>
      <h3 className="text-base font-semibold">Agregar una persona</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Nombre
          <input
            autoComplete="off"
            className="form-input mt-1"
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Ej: Juan Pérez"
            value={fullName}
          />
        </label>
        <label className="block text-sm font-medium">
          Correo electrónico
          <input
            aria-invalid={Boolean(showError)}
            autoComplete="off"
            className={`form-input mt-1 ${showError ? "border-cherry!" : ""}`}
            inputMode="email"
            onBlur={() => setTouched(true)}
            onChange={(event) => {
              setEmail(event.target.value);
              if (event.target.value.includes("@") && event.target.value.includes(".")) setTouched(true);
            }}
            placeholder="nombre@empresa.cl"
            type="email"
            value={email}
          />
          {showError ? (
            <span className="mt-1 block text-xs font-normal text-cherry">{error}</span>
          ) : email && !error ? (
            <span className="mt-1 block text-xs font-normal text-forest">✓ Correo válido</span>
          ) : null}
        </label>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium">Rol en el fundo</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {MEMBERSHIP_ROLES.map((option) => {
            const active = option.id === role;
            return (
              <button
                aria-pressed={active}
                className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                  active ? "border-forest bg-mist text-forest" : "border-border bg-white hover:bg-mist"
                }`}
                key={option.id}
                onClick={() => setRole(option.id)}
                type="button"
              >
                <span className="block font-semibold">{option.label}</span>
                <span className="block text-xs text-muted">{ROLE_HELP[option.id]}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4 flex items-center justify-end">
        <Button disabled={!canAdd} type="submit" variant="secondary">
          + Agregar al equipo
        </Button>
      </div>
    </form>
  );
}
