import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { getAppAccessStatus } from "@/lib/auth/app-access";
import { createClient } from "@/lib/supabase/server";
import { InvitedPasswordForm } from "./password-form";

export default async function InvitedPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (await getAppAccessStatus(supabase, user.id) !== "authorized") redirect("/login?error=no_invitation");
  if (!user.identities?.some((identity) => identity.provider === "google") || user.identities.some((identity) => identity.provider === "email")) redirect("/panel");

  return <main className="grid min-h-screen place-items-center px-6"><Card className="w-full max-w-md"><CardContent className="p-8"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Invitación aceptada</p><h1 className="mt-3 text-2xl font-semibold">Crea tu contraseña</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Ya puedes entrar con Google. Crea una contraseña para ingresar también con {user.email} y contraseña.</p><InvitedPasswordForm /></CardContent></Card></main>;
}
