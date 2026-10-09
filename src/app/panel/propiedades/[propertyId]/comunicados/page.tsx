import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requirePropertyMember } from "@/lib/auth/require-property-member";

export default async function AnnouncementsPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { supabase, membership, property } = await requirePropertyMember(propertyId);
  const isAdmin = membership.roles.includes("administrator");
  const { data, error } = await supabase.from("announcements")
    .select("id,subject,status,created_at,published_at")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false })
    .limit(50);
  const formatter = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: property.timezone });
  return <main className="mx-auto min-h-screen max-w-5xl px-5 py-8 sm:px-10"><header className="flex flex-wrap items-end justify-between gap-4 border-b pb-6"><div><Link href={`/panel/propiedades/${propertyId}/dashboard`} className="text-sm text-muted-foreground hover:text-foreground">← Panel de {property.name}</Link><p className="mt-5 text-xs font-semibold tracking-wider text-primary uppercase">Comunidad</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Comunicados</h1><p className="mt-2 text-sm text-muted-foreground">{isAdmin ? "Revisa borradores y publicaciones de esta comunidad." : "Mensajes publicados para ti en esta comunidad."}</p></div>{isAdmin && <Button asChild><Link href={`/panel/propiedades/${propertyId}/comunicados/nuevo`}>Crear borrador</Link></Button>}</header><section className="mt-7 grid gap-3">{error ? <p role="alert" className="rounded-xl border bg-card p-5 text-sm">No pudimos cargar los comunicados.</p> : !data?.length ? <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">No hay comunicados visibles para tu cuenta.</p> : data.map((item) => <Link key={item.id} href={`/panel/propiedades/${propertyId}/comunicados/${item.id}`} className="rounded-xl border bg-card p-5 transition-colors hover:bg-muted/50"><div className="flex flex-wrap justify-between gap-3"><h2 className="font-semibold">{item.subject}</h2><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{item.status === "published" ? "Publicado" : "Borrador"}</span></div><time dateTime={item.published_at ?? item.created_at} className="mt-2 block text-xs text-muted-foreground">{formatter.format(new Date(item.published_at ?? item.created_at))}</time></Link>)}</section></main>;
}
