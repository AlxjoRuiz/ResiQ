import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const hasGoogle = user.identities?.some((identity) => identity.provider === "google");
  return <main className="mx-auto max-w-xl px-6 py-12"><Button asChild variant="ghost" size="sm"><Link href="/panel">← Volver</Link></Button><Card className="mt-5"><CardContent className="p-7"><h1 className="text-2xl font-semibold">Tu perfil</h1><p className="mt-2 text-sm text-muted-foreground">{user.email}</p><ProfileForm displayName={profile?.display_name ?? user.user_metadata.display_name ?? ""} />{hasGoogle && <section className="mt-8 border-t pt-6"><h2 className="text-lg font-semibold">Acceso con contraseña</h2><p className="mt-2 text-sm text-muted-foreground">Crea una contraseña para entrar también con este correo. Puedes seguir usando Google.</p><PasswordForm /></section>}</CardContent></Card></main>;
}
