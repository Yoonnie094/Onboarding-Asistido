"use client";

import { useMemo } from "react";

import { BlocksMap, type MapBlock } from "@/components/map/blocks-map";
import type { BlockRecord, TeamInvite } from "@/lib/onboarding/types";

import { colorForInvite, firstName, formatHa, ownerByCode, sortCodes, UNASSIGNED_COLOR } from "./team-utils";

export function BlockAssignment({
  blocks,
  team,
  selectedIndex,
  onSelectInvite,
  onToggle,
  onAssignAll,
}: {
  blocks: BlockRecord[];
  team: TeamInvite[];
  selectedIndex: number | null;
  onSelectInvite: (index: number) => void;
  onToggle: (code: string) => void;
  onAssignAll: (codes: string[]) => void;
}) {
  const owners = useMemo(() => ownerByCode(team), [team]);
  const codes = useMemo(() => sortCodes(blocks.map((block) => block.code)), [blocks]);
  const samplers = team.map((member, index) => ({ member, index })).filter(({ member }) => member.role === "muestreador");
  const selected = selectedIndex !== null ? team[selectedIndex] : null;
  const selectedIsSampler = selected?.role === "muestreador";
  const hasGeometry = blocks.some((block) => block.geometry);
  const assignedCount = codes.filter((code) => owners.has(code)).length;
  const unassigned = codes.filter((code) => !owners.has(code));

  const mapBlocks: MapBlock[] = useMemo(
    () =>
      blocks.map((block) => {
        const owner = owners.get(block.code);
        const ownerMember = owner !== undefined ? team[owner] : null;
        const details = [
          block.variety ? `Variedad: ${block.variety}` : null,
          typeof block.areaHa === "number" ? `${formatHa(block.areaHa)} ha` : null,
          ownerMember ? `Muestreador: ${ownerMember.fullName || ownerMember.email}` : "Sin muestreador",
        ].filter((item): item is string => Boolean(item));
        return {
          code: block.code,
          label: block.name,
          geometry: block.geometry,
          color: owner !== undefined ? colorForInvite(owner) : UNASSIGNED_COLOR,
          details,
        };
      }),
    [blocks, owners, team],
  );

  if (blocks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted">
        No cargaste cuarteles en los pasos anteriores, así que por ahora no hay nada que asignar. Puedes invitar a tu
        equipo igual y asignar cuarteles desde el panel cuando los cargues.
      </div>
    );
  }

  const percent = Math.round((assignedCount / codes.length) * 100);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Asigna cuarteles a tus muestreadores</h3>
          <p className="text-sm text-muted">
            {samplers.length === 0
              ? "Agrega al menos un muestreador para asignarle cuarteles."
              : selectedIsSampler
                ? `Haz clic en un cuartel del mapa o en un código para asignarlo a ${firstName(selected.fullName) || selected.email}.`
                : "Elige un muestreador de la lista para empezar a asignar."}
          </p>
        </div>
        <div className="min-w-48 text-right">
          <p className={`text-sm font-semibold ${assignedCount === codes.length ? "text-forest" : ""}`}>
            {assignedCount} de {codes.length} cuarteles con muestreador
          </p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-mist">
            <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>

      {samplers.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Muestreador seleccionado">
          {samplers.map(({ member, index }) => {
            const active = index === selectedIndex;
            return (
              <button
                aria-selected={active}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? "border-foreground bg-foreground text-white" : "border-border bg-white hover:bg-mist"
                }`}
                key={member.email}
                onClick={() => onSelectInvite(index)}
                role="tab"
                type="button"
              >
                <span className="size-3 rounded-full" style={{ backgroundColor: colorForInvite(index) }} />
                {member.fullName || member.email}
                <span className={active ? "text-white/70" : "text-muted"}>({member.blockCodes.length})</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_16rem]">
        <div>
          {hasGeometry ? (
            <BlocksMap
              blocks={mapBlocks}
              height={360}
              highlightCodes={selectedIsSampler ? selected.blockCodes : []}
              onSelect={selectedIsSampler ? onToggle : undefined}
            />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border bg-mist p-4 text-center text-sm text-muted">
              Tus cuarteles no tienen polígonos en el mapa. Asígnalos con los códigos de la derecha.
            </div>
          )}
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Leyenda del mapa">
            {samplers.map(({ member, index }) => (
              <li className="flex items-center gap-1.5" key={member.email}>
                <span className="size-3 rounded-sm" style={{ backgroundColor: colorForInvite(index) }} />
                {member.fullName || member.email}
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm" style={{ backgroundColor: UNASSIGNED_COLOR }} />
              Sin muestreador
            </li>
          </ul>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Cuarteles</p>
            {selectedIsSampler && unassigned.length > 0 ? (
              <button
                className="text-xs font-semibold text-forest hover:underline"
                onClick={() => onAssignAll(unassigned)}
                type="button"
              >
                Asignar los {unassigned.length} libres
              </button>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {codes.map((code) => {
              const owner = owners.get(code);
              const mine = selectedIndex !== null && owner === selectedIndex;
              const color = owner !== undefined ? colorForInvite(owner) : null;
              return (
                <button
                  aria-pressed={mine}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    mine ? "text-white" : "bg-white hover:bg-mist"
                  }`}
                  disabled={!selectedIsSampler}
                  key={code}
                  onClick={() => onToggle(code)}
                  style={
                    mine && color
                      ? { backgroundColor: color, borderColor: color }
                      : { borderColor: color ?? "var(--border)" }
                  }
                  title={
                    owner !== undefined
                      ? `Asignado a ${team[owner].fullName || team[owner].email}`
                      : "Sin muestreador"
                  }
                  type="button"
                >
                  {mine ? "✓" : color ? <span className="size-2 rounded-full" style={{ backgroundColor: color }} /> : null}
                  {code}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">
            Cada cuartel tiene un muestreador. Si eliges uno que ya tiene otro, se le reasigna al seleccionado.
          </p>
        </div>
      </div>
    </div>
  );
}
