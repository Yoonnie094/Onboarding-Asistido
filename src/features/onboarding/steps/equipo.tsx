"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { logOnboardingEvent } from "@/lib/onboarding/actions";
import type { StepProps, TeamInvite } from "@/lib/onboarding/types";
import { MicroSurvey } from "@/features/onboarding/shell/micro-survey";
import { BlockAssignment } from "@/features/onboarding/team/block-assignment";
import { FinalSummary } from "@/features/onboarding/team/final-summary";
import { InviteForm } from "@/features/onboarding/team/invite-form";
import { InviteMessage } from "@/features/onboarding/team/invite-message";
import { TeamList } from "@/features/onboarding/team/team-list";
import { buildDemoTeam, ownerByCode, sortCodes } from "@/features/onboarding/team/team-utils";

export function EquipoStep({ sessionId, draft, update, goBack, finish, finishing, finishError }: StepProps) {
  const team = draft.team;
  const blocks = draft.blocks;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [skippedTeam, setSkippedTeam] = useState(false);
  const [parkedTeam, setParkedTeam] = useState<TeamInvite[]>([]);

  // Muestreador activo para asignar: el elegido, o el primero disponible.
  const firstSampler = team.findIndex((member) => member.role === "muestreador");
  const activeIndex =
    selectedIndex !== null && team[selectedIndex]?.role === "muestreador"
      ? selectedIndex
      : firstSampler >= 0
        ? firstSampler
        : null;

  function setTeam(next: TeamInvite[]) {
    update({ team: next });
  }

  function addInvite(invite: TeamInvite) {
    const next = [...team, invite];
    setTeam(next);
    if (invite.role === "muestreador") setSelectedIndex(next.length - 1);
  }

  function changeInvite(index: number, patch: Partial<TeamInvite>) {
    setTeam(team.map((member, i) => (i === index ? { ...member, ...patch } : member)));
  }

  function removeInvite(index: number) {
    setTeam(team.filter((_, i) => i !== index));
    setSelectedIndex(null);
  }

  function toggleBlock(code: string) {
    if (activeIndex === null) return;
    const has = team[activeIndex].blockCodes.includes(code);
    setTeam(
      team.map((member, i) => {
        if (i === activeIndex) {
          return {
            ...member,
            blockCodes: has ? member.blockCodes.filter((c) => c !== code) : sortCodes([...member.blockCodes, code]),
          };
        }
        return has ? member : { ...member, blockCodes: member.blockCodes.filter((c) => c !== code) };
      }),
    );
  }

  function assignAll(codes: string[]) {
    if (activeIndex === null) return;
    setTeam(
      team.map((member, i) =>
        i === activeIndex ? { ...member, blockCodes: sortCodes([...new Set([...member.blockCodes, ...codes])]) } : member,
      ),
    );
  }

  function applyDemoTeam() {
    const demo = buildDemoTeam(blocks.map((block) => block.code));
    const others = team.filter((member) => !demo.some((d) => d.email === member.email));
    const cleaned = others.map((member) => ({ ...member, blockCodes: [] }));
    setTeam([...demo, ...cleaned]);
    setSelectedIndex(0);
    setSkippedTeam(false);
  }

  function skipTeam() {
    setParkedTeam(team);
    setTeam([]);
    setSkippedTeam(true);
    void logOnboardingEvent(sessionId, "equipo", "step_skip", { hadInvites: team.length });
  }

  function resumeTeam() {
    setTeam(parkedTeam);
    setParkedTeam([]);
    setSkippedTeam(false);
  }

  const samplersWithoutBlocks = team.filter(
    (member) => member.role === "muestreador" && member.blockCodes.length === 0,
  ).length;
  const blockCodes = new Set(blocks.map((block) => block.code));
  const hasAssignments = [...ownerByCode(team).keys()].some((code) => blockCodes.has(code));

  return (
    <div className="grid gap-6">
      {blocks.length > 0 ? (
        <MicroSurvey
          draft={draft}
          milestone="cuarteles_configurados"
          sessionId={sessionId}
          step="equipo"
          update={update}
        />
      ) : null}

      {skippedTeam ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-base font-semibold">Invitarás a tu equipo más tarde</h3>
          <p className="mt-1 text-sm text-muted">
            No hay problema: tu fundo se crea igual y podrás invitar a muestreadores y agrónomos desde el panel cuando
            quieras.
          </p>
          <button
            className="mt-3 text-sm font-semibold text-forest hover:underline"
            onClick={resumeTeam}
            type="button"
          >
            ← Prefiero invitar ahora
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-2xl border border-forest/20 bg-mist p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl">
              <strong>¿Cómo funciona?</strong> Cuando cada persona se registre con el correo que ingreses aquí, entrará
              directo a tu fundo y verá sus cuarteles asignados automáticamente. En esta demo no se envían correos
              reales.
            </p>
            <Button className="shrink-0" onClick={applyDemoTeam} type="button" variant="secondary">
              Usar equipo de ejemplo
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <InviteForm onAdd={addInvite} team={team} />
            <div>
              <h3 className="mb-3 text-base font-semibold">
                Tu equipo {team.length > 0 ? <span className="text-muted">({team.length})</span> : null}
              </h3>
              <TeamList
                onChange={changeInvite}
                onRemove={removeInvite}
                onSelect={setSelectedIndex}
                selectedIndex={activeIndex}
                team={team}
              />
            </div>
          </div>

          <BlockAssignment
            blocks={blocks}
            onAssignAll={assignAll}
            onSelectInvite={setSelectedIndex}
            onToggle={toggleBlock}
            selectedIndex={activeIndex}
            team={team}
          />

          {hasAssignments ? (
            <MicroSurvey
              draft={draft}
              milestone="equipo_asignado"
              sessionId={sessionId}
              step="equipo"
              update={update}
            />
          ) : null}

          <InviteMessage farmName={draft.farm.name} team={team} />
        </>
      )}

      <FinalSummary draft={draft} skippedTeam={skippedTeam} />

      {finishError ? (
        <div className="rounded-xl border border-cherry/40 bg-cherry/5 p-4 text-sm text-cherry" role="alert">
          <strong>No pudimos crear tu fundo.</strong> {finishError}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <Button disabled={finishing} onClick={goBack} type="button" variant="secondary">
            ← Volver
          </Button>
          {!skippedTeam ? (
            <button
              className="text-sm font-semibold text-muted underline-offset-4 hover:text-forest hover:underline disabled:opacity-50"
              disabled={finishing}
              onClick={skipTeam}
              type="button"
            >
              Completar después
            </button>
          ) : null}
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <Button disabled={finishing} onClick={() => void finish()} type="button">
            {finishing ? (
              <span className="flex items-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Creando tu fundo…
              </span>
            ) : (
              "Confirmar y crear fundo →"
            )}
          </Button>
          {!skippedTeam && samplersWithoutBlocks > 0 && blocks.length > 0 ? (
            <p className="text-xs text-muted sm:text-right">
              {samplersWithoutBlocks} muestreador{samplersWithoutBlocks === 1 ? "" : "es"} sin cuarteles asignados.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
