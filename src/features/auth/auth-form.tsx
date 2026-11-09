"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthPanel } from "@/components/auth-panel";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "login" | "register";

export function AuthForm({
  mode,
  supabaseConfigured,
  initialError = null,
}: {
  mode: AuthMode;
  supabaseConfigured: boolean;
  /** Aviso a mostrar al cargar (p. ej. desde /login?error=auth_callback). */
  initialError?: string | null;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const router = useRouter();
  const isRegistering = mode === "register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setNoticeDismissed(true);
    setSuccessMessage(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      setErrorMessage("Completa el correo y la contraseña.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();

      if (isRegistering) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) {
          setErrorMessage(getAuthErrorMessage(error.message, mode));
          return;
        }

        if (!data.session) {
          setSuccessMessage(
            "Si Supabase requiere confirmar tu correo, revisa tu bandeja de entrada para completar el registro. Luego podrás iniciar sesión.",
          );
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          setErrorMessage(getAuthErrorMessage(error.message, mode));
          return;
        }
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setErrorMessage(
        "No fue posible conectar con Supabase. Revisa la configuración e inténtalo nuevamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPanel
      description={
        isRegistering
          ? "Crea tu acceso para comenzar a configurar tu espacio de trabajo."
          : "Ingresa con el correo asociado a tu cuenta de CER Analytics."
      }
      eyebrow={isRegistering ? "Nuevo acceso" : "Acceso seguro"}
      footer={
        isRegistering ? (
          <p>
            ¿Ya tienes una cuenta?{" "}
            <Link className="font-semibold text-forest underline-offset-4 hover:underline" href="/login">
              Inicia sesión
            </Link>
          </p>
        ) : (
          <p>
            ¿Aún no tienes una cuenta?{" "}
            <Link className="font-semibold text-forest underline-offset-4 hover:underline" href="/register">
              Regístrate
            </Link>
          </p>
        )
      }
      title={isRegistering ? "Crea tu cuenta" : "Bienvenido de vuelta"}
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        {!supabaseConfigured && !initialError ? (
          <p
            aria-live="polite"
            className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"
            role="status"
          >
            Supabase aún no está conectado. Completa las variables de entorno indicadas en el README para habilitar el acceso.
          </p>
        ) : null}
        {initialError && !noticeDismissed ? (
          <p
            aria-live="polite"
            className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"
            role="alert"
          >
            {initialError}
          </p>
        ) : null}
        {!isRegistering ? null : (
          <p className="rounded-xl border border-border bg-mist px-4 py-3 text-sm leading-6 text-muted">
            Después de crear tu cuenta te guiaremos paso a paso para configurar tu fundo, en menos de 10 minutos.
          </p>
        )}

        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground" htmlFor={`${mode}-email`}>
            Correo electrónico
          </label>
          <input
            autoComplete="email"
            className="form-input"
            id={`${mode}-email`}
            name="email"
            placeholder="nombre@empresa.cl"
            required
            type="email"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground" htmlFor={`${mode}-password`}>
            Contraseña
          </label>
          <input
            autoComplete={isRegistering ? "new-password" : "current-password"}
            className="form-input"
            id={`${mode}-password`}
            name="password"
            placeholder="Ingresa tu contraseña"
            required
            type="password"
          />
        </div>

        {errorMessage ? (
          <p
            aria-live="polite"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}
        {successMessage ? (
          <p
            aria-live="polite"
            className="rounded-xl border border-forest/20 bg-forest/5 px-4 py-3 text-sm leading-6 text-forest-dark"
            role="status"
          >
            {successMessage}
          </p>
        ) : null}

        <Button className="w-full" disabled={isSubmitting || !supabaseConfigured} type="submit">
          {isSubmitting
            ? "Conectando…"
            : isRegistering
              ? "Crear cuenta"
              : "Iniciar sesión"}
        </Button>
      </form>
    </AuthPanel>
  );
}

function getAuthErrorMessage(message: string, mode: AuthMode): string {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("invalid login credentials")) {
    return "El correo o la contraseña no son correctos.";
  }

  if (normalizedMessage.includes("email not confirmed")) {
    return "Confirma tu correo antes de iniciar sesión.";
  }

  if (normalizedMessage.includes("weak password")) {
    return "La contraseña no cumple los requisitos configurados para este proyecto.";
  }

  if (normalizedMessage.includes("at least") && normalizedMessage.includes("characters")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }

  if (normalizedMessage.includes("already registered") || normalizedMessage.includes("already been registered")) {
    return "Ya existe una cuenta con este correo. Inicia sesión.";
  }

  if (normalizedMessage.includes("rate limit")) {
    return "Demasiados intentos seguidos. Espera un minuto e inténtalo nuevamente.";
  }

  if (normalizedMessage.includes("invalid") && normalizedMessage.includes("email")) {
    return "Supabase no acepta este correo. Usa una dirección real (por ejemplo tucorreo+prueba@gmail.com).";
  }

  if (normalizedMessage.includes("signups not allowed") || normalizedMessage.includes("signup is disabled")) {
    return "El registro de cuentas está desactivado en Supabase.";
  }

  return mode === "register"
    ? "No se pudo crear la cuenta. Revisa los datos e inténtalo nuevamente."
    : "No se pudo iniciar sesión. Inténtalo nuevamente.";
}
