import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getAppAccessStatus } from "@/lib/auth/app-access";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  if (process.env.PASSWORD_RECOVERY_ENABLED !== "true") notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || await getAppAccessStatus(supabase, user.id) !== "authorized") redirect("/login?error=callback");
  return <main className="grid min-h-screen place-items-center px-6 py-10"><Card className="w-full max-w-md"><CardContent className="p-8">
    <h1 className="text-2xl font-semibold">Nueva contraseña</h1>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">Crea una contraseña nueva para {user.email}. Después volverás a iniciar sesión.</p>
    <ResetPasswordForm />
  </CardContent></Card></main>;
}
