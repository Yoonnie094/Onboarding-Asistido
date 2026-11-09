"use client";

import { useState, useSyncExternalStore } from "react";

import type { TeamInvite } from "@/lib/onboarding/types";

import { firstName, sortCodes } from "./team-utils";

const noopSubscribe = () => () => {};

function useOrigin(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  );
}

export function buildInviteMessage(member: TeamInvite, farmName: string, registerUrl: string): string {
  const name = firstName(member.fullName);
  const farm = farmName.trim() || "nuestro fundo";
  const lines = [
    `Hola${name ? ` ${name}` : ""}, te invité a ${farm} en CER Analytics.`,
    `Regístrate con este correo (${member.email}) aquí: ${registerUrl}`,
  ];
  if (member.role === "muestreador" && member.blockCodes.length > 0) {
    lines.push(`Al entrar vas a ver tus cuarteles asignados: ${sortCodes(member.blockCodes).join(", ")}.`);
  } else if (member.role !== "muestreador") {
    lines.push("Al entrar vas a ver todos los cuarteles del fundo.");
  }
  lines.push("¡Nos vemos en terreno!");
  return lines.join("\n");
}

export function InviteMessage({ team, farmName }: { team: TeamInvite[]; farmName: string }) {
  const origin = useOrigin();
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  if (team.length === 0) return null;

  const index = Math.min(activeIndex, team.length - 1);
  const member = team[index];
  const registerUrl = `${origin}/register`;
  const message = buildInviteMessage(member, farmName, registerUrl);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(member.email);
      window.setTimeout(() => setCopied(null), 2500);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Mensaje de invitación</h3>
          <p className="text-sm text-muted">
            En esta demo no enviamos correos reales. Copia el mensaje y compártelo por WhatsApp o email.
          </p>
        </div>
        {team.length > 1 ? (
          <select
            aria-label="Invitado"
            className="rounded-lg border border-border bg-white px-2 py-1.5 text-sm"
            onChange={(event) => setActiveIndex(Number(event.target.value))}
            value={index}
          >
            {team.map((item, itemIndex) => (
              <option key={item.email} value={itemIndex}>
                {item.fullName || item.email}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-border bg-mist p-4 font-sans text-sm leading-relaxed">
        {message}
      </pre>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="rounded-lg bg-forest px-3 py-2 text-sm font-semibold text-white hover:bg-forest-dark"
          onClick={copy}
          type="button"
        >
          {copied === member.email ? "✓ Copiado" : "Copiar mensaje"}
        </button>
        <a
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold hover:bg-mist"
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          rel="noreferrer"
          target="_blank"
        >
          Abrir en WhatsApp
        </a>
        <a
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold hover:bg-mist"
          href={`mailto:${member.email}?subject=${encodeURIComponent(`Invitación a ${farmName || "CER Analytics"}`)}&body=${encodeURIComponent(message)}`}
        >
          Abrir en email
        </a>
      </div>
    </div>
  );
}
