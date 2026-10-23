import Link from "next/link";
import { statusCard, statusPill, type StatusTone } from "@/lib/ui/status-tones";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PackageQuickDeliver } from "@/components/packages/package-forms";
import { HistoryDatePicker } from "@/components/visitors/history-date-picker";
import { packageStatusLabel, receivedItemLabel } from "@/lib/packages/constants";
import { addDays, dateInputValue, zonedDayStart } from "@/lib/time-zone";

// Paquetes en portería, con el mismo estilo de Visitas: pestañas Por entregar (todos los que
// están en portería, los más antiguos primero), Hoy (llegaron o se entregaron hoy) e Historial
// (entregados en días anteriores, con calendario). Amarillo: por entregar. Verde: entregado.
type Unit = { code: string; buildings: { name: string } | { name: string }[] | null };
type Package = { id: string; kind: string; utility_service: string | null; recipient_name: string; carrier: string | null; tracking_number: string | null; description: string; status: string; received_at: string; delivered_at: string | null; collected_by_name: string | null; units: Unit | Unit[] | null };
type Tab = "pendientes" | "hoy" | "historial";
const historyPageSize = 50;

// Por entregar: amarillo. Entregado: verde del proyecto.
const packageTone: Record<string, StatusTone> = { received: "warning", notified: "warning", delivered: "success" };

function unitLabel(units: Package["units"]) {
  const unit = Array.isArray(units) ? units[0] : units;
  const building = Array.isArray(unit?.buildings) ? unit.buildings[0] : unit?.buildings;
  return [building?.name, unit?.code].filter(Boolean).join(" · ") || "Apartamento";
}

export async function PorteriaPackages({ supabase, propertyId, timeZone, tab, page = 1, date }: { supabase: SupabaseClient; propertyId: string; timeZone: string; tab: Tab; page?: number; date?: string }) {
  const today = dateInputValue(new Date(), timeZone);
  const todayStart = zonedDayStart(today, timeZone).toISOString();
  const yesterday = addDays(today, -1);
  const historyDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= yesterday ? date : undefined;
  const base = `/panel/propiedades/${propertyId}/paquetes`;
  let query = supabase.from("packages")
    .select("id,kind,utility_service,recipient_name,carrier,tracking_number,description,status,received_at,delivered_at,collected_by_name,units(code,buildings(name))")
    .eq("property_id", propertyId);
  if (tab === "pendientes") {
    query = query.in("status", ["received", "notified"]).order("received_at", { ascending: true }).limit(200);
  } else if (tab === "hoy") {
    query = query.or(`received_at.gte."${todayStart}",delivered_at.gte."${todayStart}"`).order("received_at", { ascending: false }).limit(200);
  } else {
    // Historial: entregados en días anteriores; con fecha elegida, desde ese día hasta hoy.
    query = query.eq("status", "delivered").lt("delivered_at", todayStart);
    if (historyDate) query = query.gte("delivered_at", zonedDayStart(historyDate, timeZone).toISOString());
    query = query.order("delivered_at", { ascending: Boolean(historyDate) }).range((page - 1) * historyPageSize, page * historyPageSize);
  }
  const { data, error } = await query;
  const hasMore = tab === "historial" && (data?.length ?? 0) > historyPageSize;
  const packages = (data ?? []).slice(0, tab === "historial" ? historyPageSize : undefined) as Package[];

  const time = new Intl.DateTimeFormat("es-CO", { timeStyle: "short", timeZone });
  const dateTime = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone });
  const when = (value: string) => dateInputValue(new Date(value), timeZone) === today ? time.format(new Date(value)) : dateTime.format(new Date(value));
  const dayLabel = (day: string) => day === yesterday ? "Ayer"
    : new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  const tabLink = (label: string, href: string, active: boolean) => <Link href={href} aria-current={active ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-full px-3 py-1.5 text-xs font-medium sm:min-h-0 ${active ? "bg-primary text-white" : "bg-secondary"}`}>{label}</Link>;
  const empty = tab === "pendientes" ? "No hay paquetes por entregar." : tab === "hoy" ? "Hoy no han llegado ni se han entregado paquetes." : historyDate ? "No hay entregas en el historial desde esa fecha." : "No hay entregas en el historial.";

  return <>
    <div className="mt-6 flex items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">
        {tabLink("Por entregar", base, tab === "pendientes")}
        {tabLink("Hoy", `${base}?vista=hoy`, tab === "hoy")}
        {tabLink("Historial", `${base}?vista=historial`, tab === "historial")}
      </div>
      {tab === "historial" && <HistoryDatePicker base={base} max={yesterday} value={historyDate} />}
    </div>
    {tab === "historial" && historyDate && <p className="mt-4 flex flex-wrap items-center gap-3 text-sm"><span>Del <strong>{new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${historyDate}T12:00:00Z`))}</strong> hasta hoy.</span><Link href={`${base}?vista=historial`} className="inline-flex min-h-10 items-center font-medium text-primary hover:underline">Ver las más recientes</Link></p>}
    <section aria-label="Lista de paquetes" className="mt-6 grid gap-3">
      {error ? <p role="alert" className="rounded-xl border bg-card p-5 text-sm">No pudimos cargar los paquetes. Inténtalo de nuevo.</p>
        : !packages.length ? <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">{empty}</p>
        : packages.map((item, index) => {
          const detailPath = `${base}/${item.id}`;
          const deliveredDay = item.delivered_at ? dateInputValue(new Date(item.delivered_at), timeZone) : "";
          const showDay = tab === "historial" && (index === 0 || dateInputValue(new Date(packages[index - 1].delivered_at ?? item.received_at), timeZone) !== deliveredDay);
          const details = [item.description, item.carrier, item.tracking_number ? `Guía ${item.tracking_number}` : null].filter(Boolean).join(" · ");
          return <div key={item.id} className="grid gap-3">{showDay && <h2 className="mt-3 text-sm font-semibold first-letter:uppercase">{dayLabel(deliveredDay)}</h2>}<article className={`rounded-xl border p-5 transition-colors motion-reduce:transition-none ${statusCard[packageTone[item.status] ?? "neutral"]}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-semibold tracking-wider text-primary uppercase">{receivedItemLabel(item.kind, item.utility_service)} · {unitLabel(item.units)}</p><h2 className="mt-1 text-lg font-semibold"><Link href={detailPath} className="hover:underline">{item.recipient_name}</Link></h2></div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusPill[packageTone[item.status] ?? "neutral"]}`}>{packageStatusLabel(item.status)}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{details}</p>
            <div className="mt-2 grid gap-1 text-sm">
              <p><span className="font-medium">Llegó {when(item.received_at)}</span></p>
              {item.delivered_at && <p><span className="font-medium">Entregado {when(item.delivered_at)}</span>{item.collected_by_name ? ` · lo recogió ${item.collected_by_name}` : ""}</p>}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-3 text-xs text-muted-foreground">
              <Link href={detailPath} className="font-medium text-primary hover:underline">Ver paquete →</Link>
              {item.status !== "delivered" && <PackageQuickDeliver propertyId={propertyId} packageId={item.id} />}
            </div>
          </article></div>;
        })}
    </section>
    {tab === "historial" && (page > 1 || hasMore) && <nav aria-label="Páginas del historial" className="mt-6 flex items-center justify-between gap-3 text-sm">
      {page > 1 ? <Link href={`${base}?vista=historial${historyDate ? `&fecha=${historyDate}` : ""}${page > 2 ? `&pagina=${page - 1}` : ""}`} className="inline-flex min-h-10 items-center font-medium text-primary hover:underline">{historyDate ? "← Días anteriores" : "← Más recientes"}</Link> : <span />}
      {hasMore && <Link href={`${base}?vista=historial${historyDate ? `&fecha=${historyDate}` : ""}&pagina=${page + 1}`} className="inline-flex min-h-10 items-center font-medium text-primary hover:underline">{historyDate ? "Días siguientes →" : "Más antiguas →"}</Link>}
    </nav>}
  </>;
}
