import { AuthForm } from "@/features/auth/auth-form";
import { redirectAuthenticatedUser } from "@/lib/auth/require-user";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const LOGIN_ERRORS: Record<string, string> = {
  configuration:
    "La plataforma aún no está conectada a Supabase. Completa las variables de entorno para habilitar el acceso.",
  auth_callback:
    "No pudimos confirmar tu acceso desde el enlace del correo. Puede haber expirado o ya fue usado: inicia sesión con tu correo y contraseña.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await redirectAuthenticatedUser();
  const { error } = await searchParams;
  const code = Array.isArray(error) ? error[0] : error;
  const configured = isSupabaseConfigured();
  // "configuration" solo tiene sentido si de verdad falta configurar Supabase.
  const initialError =
    !code || (code === "configuration" && configured)
      ? null
      : (LOGIN_ERRORS[code] ?? "No se pudo iniciar sesión. Inténtalo nuevamente.");

  return <AuthForm initialError={initialError} mode="login" supabaseConfigured={configured} />;
}
