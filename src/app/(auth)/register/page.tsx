import { AuthForm } from "@/features/auth/auth-form";
import { redirectAuthenticatedUser } from "@/lib/auth/require-user";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function RegisterPage() {
  await redirectAuthenticatedUser();
  return <AuthForm mode="register" supabaseConfigured={isSupabaseConfigured()} />;
}
