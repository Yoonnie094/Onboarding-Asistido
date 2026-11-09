import type { BlockRecord, TeamInvite } from "@/lib/onboarding/types";

/** Colores por invitado (mapa, chips y leyenda). */
export const INVITE_COLORS = ["#2563eb", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#ea580c", "#4f46e5"];
export const UNASSIGNED_COLOR = "#94a3b8";

export function colorForInvite(index: number): string {
  return INVITE_COLORS[index % INVITE_COLORS.length];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function emailError(value: string, team: TeamInvite[], ignoreIndex?: number): string | null {
  const email = value.trim().toLowerCase();
  if (!email) return "Ingresa un correo.";
  if (!isValidEmail(email)) return "Ese correo no parece válido (ej: nombre@empresa.cl).";
  const duplicate = team.some((member, index) => index !== ignoreIndex && member.email.toLowerCase() === email);
  if (duplicate) return "Ya invitaste a esta persona.";
  return null;
}

export function sortCodes(codes: string[]): string[] {
  return [...codes].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
}

/** Mapa código de cuartel -> índice del invitado que lo tiene asignado (el primero que lo tenga). */
export function ownerByCode(team: TeamInvite[]): Map<string, number> {
  const owners = new Map<string, number>();
  team.forEach((member, index) => {
    for (const code of member.blockCodes) {
      if (!owners.has(code)) owners.set(code, index);
    }
  });
  return owners;
}

export function totalHectares(blocks: BlockRecord[]): number {
  return blocks.reduce((sum, block) => sum + (typeof block.areaHa === "number" && Number.isFinite(block.areaHa) ? block.areaHa : 0), 0);
}

export function formatHa(value: number): string {
  return value.toLocaleString("es-CL", { maximumFractionDigits: 1, minimumFractionDigits: value > 0 && value < 10 ? 1 : 0 });
}

/** Equipo de ejemplo para la demo: 2 muestreadores que se reparten los cuarteles. */
export function buildDemoTeam(blockCodes: string[]): TeamInvite[] {
  const codes = sortCodes(blockCodes);
  const half = Math.ceil(codes.length / 2);
  return [
    { fullName: "Camila Rojas", email: "camila.rojas@example.com", role: "muestreador", blockCodes: codes.slice(0, half) },
    { fullName: "Diego Muñoz", email: "diego.munoz@example.com", role: "muestreador", blockCodes: codes.slice(half) },
  ];
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}
