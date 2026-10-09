import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requirePropertyMember } from "@/lib/auth/require-property-member";
import { noticeCategories, noticeCategoryLabel } from "@/lib/notifications/constants";
import { markNotificationRead } from "./actions";

const pageSize = 20;

export default async function NotificationsPage({ params, searchParams }: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ estado?: string; tipo?: string; pagina?: string }>;
}) {
  const { propertyId } = await params;
  const { estado, tipo, pagina } = await searchParams;
  const { supabase, membership, property } = await requirePropertyMember(propertyId);
  const stateFilter = estado === "sin-leer" || estado === "leidas" ? estado : "todas";
  const typeFilter = noticeCategories.some(([value]) => value === tipo) ? tipo : null;
  const pageNumber = Math.max(1, Math.min(1000, Number.isSafeInteger(Number(pagina)) ? Number(pagina) : 1));
  let query = supabase.from("notifications")
    .select("id,subject,body,target_type,read_at,occurred_at", { count: "exact" })
    .eq("property_id", propertyId)
    .eq("recipient_member_id", membership.id);
  if (stateFilter === "sin-leer") query = query.is("read_at", null);
  if (stateFilter === "leidas") query = query.not("read_at", "is", null);
  if (typeFilter) query = query.eq("target_type", typeFilter);
  const { data, count, error } = await query.order("occurred_at", { ascending: false }).order("id", { ascending: false }).range((pageNumber - 1) * pageSize, pageNumber * pageSize - 1);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const makeHref = (page: number) => {
    const query = new URLSearchParams();
    if (stateFilter !== "todas") query.set("estado", stateFilter);
    if (typeFilter) query.set("tipo", typeFilter);
    if (page > 1) query.set("pagina", String(page));
    const suffix = query.toString();
    return `/panel/propiedades/${propertyId}/notificaciones${suffix ? `?${suffix}` : ""}`;
  };
  const formatter = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: property.timezone });

  return <main className="mx-auto min-h-screen max-w-5xl px-5 py-8 sm:px-10">
    <header className="border-b pb-6"><Link href={`/panel/propiedades/${propertyId}/dashboard`} className="text-sm text-muted-foreground hover:text-foreground">← Panel de {property.name}</Link><p className="mt-5 text-xs font-semibold tracking-wider text-primary uppercase">Tu actividad</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Notificaciones</h1><p className="mt-2 text-sm text-muted-foreground">Avisos asociados a tu cuenta en esta comunidad.</p></header>
    <form method="get" className="mt-6 flex flex-wrap items-end gap-3"><label className="grid gap-1 text-sm font-medium">Estado<select name="estado" defaultValue={stateFilter} className="h-11 rounded-lg border bg-background px-3"><option value="todas">Todas</option><option value="sin-leer">Sin leer</option><option value="leidas">Leídas</option></select></label><label className="grid gap-1 text-sm font-medium">Tipo<select name="tipo" defaultValue={typeFilter ?? ""} className="h-11 rounded-lg border bg-background px-3"><option value="">Todos</option>{noticeCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><Button type="submit" variant="outline">Filtrar</Button></form>
    <section aria-label="Lista de notificaciones" className="mt-6 grid gap-3">{error ? <p role="alert" className="rounded-xl border bg-card p-5 text-sm">No pudimos cargar los avisos. Inténtalo de nuevo.</p> : !data?.length ? <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">No hay avisos con estos filtros.</p> : data.map((notice) => <article key={notice.id} className="rounded-xl border bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-wider text-primary uppercase">{noticeCategoryLabel(notice.target_type)}</p><h2 className="mt-1 text-lg font-semibold"><Link href={`/panel/propiedades/${propertyId}/notificaciones/${notice.id}`} className="hover:underline">{notice.subject}</Link></h2></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{notice.read_at ? "Leída" : "Sin leer"}</span></div><p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{notice.body}</p><div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><time dateTime={notice.occurred_at}>{formatter.format(new Date(notice.occurred_at))}</time>{!notice.read_at && <form action={markNotificationRead.bind(null, propertyId, notice.id)}><Button type="submit" size="sm" variant="ghost">Marcar como leída</Button></form>}</div></article>)}</section>
    {!error && totalPages > 1 && <nav aria-label="Páginas de notificaciones" className="mt-6 flex items-center justify-between gap-3 text-sm"><span>Página {Math.min(pageNumber, totalPages)} de {totalPages}</span><div className="flex gap-4">{pageNumber > 1 && <Link href={makeHref(pageNumber - 1)} className="font-medium text-primary hover:underline">Anterior</Link>}{pageNumber < totalPages && <Link href={makeHref(pageNumber + 1)} className="font-medium text-primary hover:underline">Siguiente</Link>}</div></nav>}
  </main>;
}
