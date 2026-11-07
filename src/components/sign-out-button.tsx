"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  async function signOut() {
    setIsSigningOut(true);
    setErrorMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setErrorMessage("No se pudo cerrar la sesión. Inténtalo nuevamente.");
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setErrorMessage("No se pudo conectar con el servicio de autenticación.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        className="min-h-10 rounded-lg px-3 py-2 text-xs"
        disabled={isSigningOut}
        onClick={signOut}
        type="button"
        variant="secondary"
      >
        {isSigningOut ? "Cerrando…" : "Cerrar sesión"}
      </Button>
      {errorMessage ? (
        <p aria-live="polite" className="max-w-48 text-right text-xs text-red-700">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
