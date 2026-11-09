"use client";

import { MEMBERSHIP_ROLES, type MembershipRoleId } from "@/lib/onboarding/catalogs";
import type { TeamInvite } from "@/lib/onboarding/types";

import { colorForInvite } from "./team-utils";

export function TeamList({
  team,
  selectedIndex,
  onSelect,
  onChange,
  onRemove,
}: {
  team: TeamInvite[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onChange: (index: number, patch: Partial<TeamInvite>) => void;
  onRemove: (index: number) => void;
}) {
  if (team.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted">
        Todavía no agregas a nadie. Agrega a tus muestreadores o usa el equipo de ejemplo.
      </div>
    );
  }

  return (
    <ul className="grid gap-3">
      {team.map((member, index) => {
        const color = colorForInvite(index);
        const isSampler = member.role === "muestreador";
        const selected = selectedIndex === index;
        return (
          <li
            className={`rounded-2xl border bg-card p-4 transition-shadow ${
              selected ? "border-forest shadow-md ring-2 ring-forest/20" : "border-border"
            }`}
            key={member.email}
          >
            <div className="flex flex-wrap items-start gap-3">
              <span
                aria-hidden
                className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {(member.fullName || member.email).slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <input
                  aria-label="Nombre del invitado"
                  className="w-full rounded-md border border-transparent bg-transparent px-1 font-semibold hover:border-border focus:border-forest focus:outline-none"
                  onChange={(event) => onChange(index, { fullName: event.target.value })}
                  value={member.fullName}
                />
                <p className="truncate px-1 text-sm text-muted">{member.email}</p>
              </div>
              <select
                aria-label="Rol"
                className="rounded-lg border border-border bg-white px-2 py-1.5 text-sm"
                onChange={(event) => {
                  const role = event.target.value as MembershipRoleId;
                  onChange(index, { role, blockCodes: role === "muestreador" ? member.blockCodes : [] });
                }}
                value={member.role}
              >
                {MEMBERSHIP_ROLES.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                aria-label={`Quitar a ${member.fullName || member.email}`}
                className="rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-mist hover:text-cherry"
                onClick={() => onRemove(index)}
                type="button"
              >
                Quitar
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
              {isSampler ? (
                <>
                  <span className="text-muted">
                    {member.blockCodes.length === 0
                      ? "Sin cuarteles asignados"
                      : `${member.blockCodes.length} cuartel${member.blockCodes.length === 1 ? "" : "es"} asignado${member.blockCodes.length === 1 ? "" : "s"}`}
                  </span>
                  <button
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                      selected ? "bg-forest text-white" : "border border-border bg-white hover:bg-mist"
                    }`}
                    onClick={() => onSelect(index)}
                    type="button"
                  >
                    {selected ? "Asignando cuarteles…" : "Asignar cuarteles"}
                  </button>
                </>
              ) : (
                <span className="text-muted">Tendrá acceso a todos los cuarteles del fundo.</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
