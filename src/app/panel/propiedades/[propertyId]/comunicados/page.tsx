import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requirePropertyMember } from "@/lib/auth/require-property-member";
import { dateInputValue } from "@/lib/time-zone";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { dateBounds, readDateFilter } from "@/lib/date-range";

export default async function AnnouncementsPage({ params, searchParams }: { params: Promise<{ propertyId: string }>; searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  const { propertyId } = await params;
  const { supabase, membership, property } = await requirePropertyMember(propertyId);
  const isAdmin = membership.roles.includes("administrator");
  // Filtro de fechas (29/10/2026): fecha del comunicado, en la hora del conjunto.
  const dateFilter = readDateFilter(await searchParams, property.timezone); const [dateStart, dateEnd] = dateBounds(dateFilter); const today = dateInputValue(new Date(), property.timezone);
  const { data, error } = await supabase.from("announcements")
    .select("id,subject,status,created_at,published_at")
    .eq("property_id", propertyId)
    .gte("created_at", dateStart).lt("created_at", dateEnd)
    .order("created_at", { ascending: false })
    .limit(50);
  const formatter = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: property.timezone });
  return <main className="mx-auto min-h-screen max-w-5xl px-5 py-8 sm:px-10"><header className="flex flex-wrap items-end justify-between gap-4 border-b pb-6"><div><Link href={`/panel/propiedades/${propertyId}/dashboard`} className="text-sm text-muted-foreground hover:text-foreground">← Volver al inicio</Link><p className="mt-5 text-xs font-semibold tracking-wider text-primary uppercase">Comunidad</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Comunicados</h1><p className="mt-2 text-sm text-muted-foreground">{isAdmin ? "Publica comunicados para la comunidad, con archivos adjuntos." : "Mensajes publicados para ti en esta comunidad."}</p></div>{isAdmin && <Button asChild><Link href={`/panel/propiedades/${propertyId}/comunicados/nuevo`}>Nuevo comunicado</Link></Button>}</header><div className="mt-6 w-fit max-w-full"><DateRangeFilter from={dateFilter?.from} to={dateFilter?.to} today={today} /></div><section className="mt-7 grid gap-3">{error ? <p role="alert" className="rounded-xl border bg-card p-5 text-sm">No pudimos cargar los comunicados.</p> : !data?.length ? <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">{dateFilter ? "No hay comunicados en estas fechas." : "No hay comunicados visibles para tu cuenta."}</p> : data.map((item) => <Link key={item.id} href={`/panel/propiedades/${propertyId}/comunicados/${item.id}`} data-card-hover="primary" className="group rounded-xl border bg-card p-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-wider text-primary uppercase">Comunicado</p><h2 className="mt-1 text-lg font-semibold">{item.subject}</h2></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{item.status === "published" ? "Publicado" : "Borrador"}</span></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><time dateTime={item.published_at ?? item.created_at}>{formatter.format(new Date(item.published_at ?? item.created_at))}</time><span aria-hidden="true" className="font-medium text-primary transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none">Toca para ver el comunicado completo →</span></div></Link>)}</section></main>;
}
