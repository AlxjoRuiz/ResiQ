import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpenCheck, Building2, LogOut, UserRound } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function PanelPage({ searchParams }: { searchParams: Promise<{ invitation?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: memberships }, { data: platformAdmin }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("property_members").select("id,property_id,roles,status,properties(name),unit_memberships(relationship,units(code))").eq("user_id", user.id).eq("status", "active"),
    supabase.from("platform_admins").select("id").eq("user_id", user.id).eq("status", "active").maybeSingle(),
  ]);
  const accepted = (await searchParams).invitation === "accepted";
  return <main className="mx-auto min-h-screen max-w-5xl px-6 py-8 sm:px-10">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-6"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary text-white"><Building2 size={21} /></span><div><p className="font-semibold">ResiQ</p><p className="text-xs text-muted-foreground">Panel de la comunidad</p></div></div><div className="flex flex-wrap gap-2">{platformAdmin && <Button asChild variant="outline" size="sm"><Link href="/plataforma">Plataforma</Link></Button>}<Button asChild variant="outline" size="sm"><Link href="/panel/asambleas"><BookOpenCheck size={15} />Asambleas</Link></Button><Button asChild variant="outline" size="sm"><Link href="/perfil"><UserRound size={15} />Perfil</Link></Button><form action={signOut}><Button variant="ghost" size="sm"><LogOut size={15} />Salir</Button></form></div></header>
    <section className="py-10"><p className="text-sm text-muted-foreground">Hola,</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{profile?.display_name ?? user.user_metadata.display_name ?? user.email}</h1>{accepted && <p className="mt-5 rounded-xl bg-secondary p-4 text-sm text-secondary-foreground">Invitación aceptada. Ya tienes acceso a tu comunidad.</p>}
      <div className="mt-8 grid gap-5 md:grid-cols-2">{memberships?.length ? memberships.map((membership) => <Card key={membership.id}><CardContent><p className="text-xs font-semibold tracking-wider text-primary uppercase">Comunidad</p><h2 className="mt-2 text-xl font-semibold">{Array.isArray(membership.properties) ? membership.properties[0]?.name : (membership.properties as { name?: string } | null)?.name}</h2><p className="mt-3 text-sm text-muted-foreground">Roles: {membership.roles.join(", ")}</p><div className="mt-5 flex flex-wrap gap-2"><Button asChild size="sm"><Link href={`/panel/propiedades/${membership.property_id}/dashboard`}>Abrir dashboard</Link></Button>{membership.roles.includes("administrator") && <Button asChild variant="outline" size="sm"><Link href={`/panel/invitaciones/nueva?property=${membership.property_id}`}>Invitar miembro</Link></Button>}</div></CardContent></Card>) : <Card><CardContent><h2 className="font-semibold">Acceso pendiente</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Tu cuenta está activa, pero aún no tiene una invitación aceptada. Usa el enlace enviado por la administración.</p></CardContent></Card>}</div>
    </section>
  </main>;
}
