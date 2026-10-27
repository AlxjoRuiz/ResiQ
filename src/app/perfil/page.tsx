import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";

const roleLabels: Record<string, string> = { administrator: "Administración", member: "Residente", concierge: "Portería" };

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: platformAdmin }, { data: statusData }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("platform_admins").select("id").eq("user_id", user.id).eq("status", "active").maybeSingle(),
    supabase.rpc("get_my_property_statuses"),
  ]);
  // Las cuentas que no son superadmin conservan el perfil sencillo de siempre.
  if (!platformAdmin) {
    const hasGoogleOnly = user.identities?.some((identity) => identity.provider === "google");
    return <main className="mx-auto max-w-xl px-6 py-12"><Button asChild variant="ghost" size="sm"><Link href="/panel">← Volver</Link></Button><Card className="mt-5"><CardContent className="p-7"><h1 className="text-2xl font-semibold">Tu perfil</h1><p className="mt-2 text-sm text-muted-foreground">{user.email}</p><ProfileForm displayName={profile?.display_name ?? user.user_metadata.display_name ?? ""} spacing="mt-6" />{hasGoogleOnly && <section className="mt-8 border-t pt-6"><h2 className="text-lg font-semibold">Acceso con contraseña</h2><p className="mt-2 text-sm text-muted-foreground">Crea una contraseña para entrar también con este correo. Puedes seguir usando Google.</p><PasswordForm /></section>}</CardContent></Card></main>;
  }
  const communities = ((statusData ?? []) as { property_id: string; property_name: string; property_status: string; roles: string[] }[]).sort((a, b) => a.property_name.localeCompare(b.property_name, "es"));
  const name = profile?.display_name ?? user.user_metadata.display_name ?? user.email ?? "";
  const hasGoogle = user.identities?.some((identity) => identity.provider === "google") ?? false;
  // Una cuenta sin Google entra con contraseña. En una de Google no se sabe con certeza si ya creó una.
  const hasPassword = !hasGoogle || (user.identities?.some((identity) => identity.provider === "email") ?? false);
  return <main className="mx-auto min-h-screen max-w-4xl px-5 py-7 sm:px-10">
    <Link href="/panel" className="text-sm text-muted-foreground hover:text-foreground">← Volver al inicio</Link>
    <header className="mt-5 flex flex-wrap items-center gap-5 border-b pb-6">
      <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-semibold text-white">{initials(name)}</span>
      <div className="min-w-0 flex-1"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Tu perfil</p><h1 className="mt-1 break-words text-3xl font-semibold tracking-tight">{name}</h1><p className="mt-1 break-all text-sm text-muted-foreground">{user.email}</p>
        <div className="mt-3 flex flex-wrap gap-2">{platformAdmin && <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-white">Superadmin</span>}{communities.map((community) => <span key={community.property_id} className={`rounded-full px-3 py-1 text-xs font-medium ${community.property_status === "suspended" ? "bg-red-100 text-red-800" : "bg-secondary"}`}>{community.property_name} · {community.roles.map((role) => roleLabels[role] ?? role).join(", ")}{community.property_status === "suspended" ? " · suspendido" : ""}</span>)}</div>
      </div>
    </header>
    <div className="mt-7 grid gap-6 md:grid-cols-2">
      <Card><CardContent>
        <h2 className="flex items-center gap-2 text-lg font-semibold"><UserRound size={19} className="text-primary" aria-hidden="true" />Datos personales</h2>
        <p className="mt-1 text-sm text-muted-foreground">Así te ven la administración, la portería y tu comunidad.</p>
        <ProfileForm displayName={profile?.display_name ?? user.user_metadata.display_name ?? ""} />
      </CardContent></Card>
      <Card><CardContent>
        <h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck size={19} className="text-primary" aria-hidden="true" />Seguridad</h2>
        <p className="mt-1 text-sm text-muted-foreground">Cómo entras a ResiQ.</p>
        <ul className="mt-5 grid gap-2 text-sm">
          <li className="flex items-center justify-between gap-3 rounded-xl border p-3"><span>Google</span><span className={`rounded-full px-3 py-1 text-xs font-medium ${hasGoogle ? "bg-primary/12 text-primary" : "bg-secondary"}`}>{hasGoogle ? "Conectado" : "No conectado"}</span></li>
          <li className="flex items-center justify-between gap-3 rounded-xl border p-3"><span>Correo y contraseña</span><span className={`rounded-full px-3 py-1 text-xs font-medium ${hasPassword ? "bg-primary/12 text-primary" : "bg-secondary"}`}>{hasPassword ? "Configurada" : "Opcional"}</span></li>
        </ul>
        {hasGoogle && <div className="mt-6 border-t pt-5"><h3 className="flex items-center gap-2 font-semibold"><KeyRound size={17} className="text-primary" aria-hidden="true" />Crear o cambiar contraseña</h3><p className="mt-1 text-sm text-muted-foreground">Para entrar también con tu correo. Puedes seguir usando Google.</p><PasswordForm /></div>}
      </CardContent></Card>
    </div>
  </main>;
}
