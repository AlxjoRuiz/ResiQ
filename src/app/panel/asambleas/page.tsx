import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { assemblyStatusLabels, assemblyTypeLabel, rsvpLabels } from "@/lib/assemblies/constants";
import { createClient } from "@/lib/supabase/server";

type PropertyRelation = { name: string } | { name: string }[] | null;
type Attendee = { member_id: string; rsvp: string };
function one<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
const formatter = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });

export default async function MyAssembliesPage() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login?next=/panel/asambleas");
  const { data: memberships } = await supabase.from("property_members").select("id,roles").eq("user_id", user.id).eq("status", "active"); const residentMemberships = (memberships ?? []).filter((row) => row.roles.includes("member")); if (!residentMemberships.length) notFound(); const memberIds = new Set(residentMemberships.map((row) => row.id));
  const { data } = await supabase.from("assemblies").select("id,property_id,type,title,starts_at,location,status,published_at,properties(name),assembly_attendees(member_id,rsvp)").not("published_at", "is", null).order("starts_at", { ascending: false });
  const assemblies = (data ?? []).filter((row) => (row.assembly_attendees as Attendee[] | null)?.some((attendee) => memberIds.has(attendee.member_id)));
  return <main className="mx-auto min-h-screen max-w-5xl px-5 py-8 sm:px-10"><header className="flex flex-wrap items-end justify-between gap-4 border-b pb-6"><div><Link href="/panel" className="text-sm text-muted-foreground hover:text-foreground">← Mis comunidades</Link><p className="mt-5 text-xs font-semibold tracking-wider text-primary uppercase">Convocatorias privadas</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Mis asambleas</h1><p className="mt-2 text-sm text-muted-foreground">Convocatorias en las que apareces expresamente como asistente.</p></div></header><section className="mt-7 grid gap-4">{assemblies.length ? assemblies.map((item) => { const own = (item.assembly_attendees as Attendee[]).find((attendee) => memberIds.has(attendee.member_id)); return <article key={item.id} className="rounded-2xl border bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold tracking-wider text-primary uppercase">{one(item.properties as PropertyRelation)?.name ?? "Propiedad"} · {assemblyTypeLabel(item.type)}</p><h2 className="mt-2 text-lg font-semibold">{item.title}</h2><p className="mt-2 text-sm text-muted-foreground">{formatter.format(new Date(item.starts_at))} · {item.location}</p><p className="mt-2 text-xs text-muted-foreground">Tu respuesta: {rsvpLabels[own?.rsvp ?? "pending"]}</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{assemblyStatusLabels[item.status]}</span></div><Button asChild size="sm" variant="outline" className="mt-4"><Link href={`/panel/propiedades/${item.property_id}/asambleas/${item.id}`}>Ver convocatoria</Link></Button></article>; }) : <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">No tienes convocatorias publicadas.</div>}</section></main>;
}
