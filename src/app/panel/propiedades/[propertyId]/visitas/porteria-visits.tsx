import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HistoryDatePicker } from "@/components/visitors/history-date-picker";
import { VisitQuickAction } from "@/components/visitors/visit-forms";
import { visitKindLabel, visitStatusLabel } from "@/lib/visitors/constants";
import { addDays, dateInputValue, zonedDayStart } from "@/lib/time-zone";

// Visitas en portería: pestañas Hoy (todas las del día presente, también rechazadas, y las que
// sigan dentro), Visitas (las que aún no llegan y las rechazadas, desde hoy, agrupadas por día) e
// Historial (días anteriores, de la más reciente a la más antigua, en páginas de 50).
// Las de mantenimiento aparecen en ambas con su etiqueta. Las tarjetas
// siguen el diseño de Notificaciones; la entrada y la salida se marcan desde la tarjeta, con
// comentario. Verde: ya entró. Amarillo: ya salió. Rojo: rechazada.
type Unit = { code: string; buildings: { name: string } | { name: string }[] | null };
type Entry = { entered_at: string; exited_at: string | null; notes: string | null; exit_notes: string | null };
type Visit = { id: string; visitor_name: string; kind: string; service_type: string | null; people_count: number; status: string; scheduled_start: string; scheduled_end: string; units: Unit | Unit[] | null; visitor_entries: Entry[] | null };
type Tab = "hoy" | "visitas" | "historial";
const historyPageSize = 50;

const acceptedOrRejected = ["authorized", "entered", "exited", "rejected"];
const cardTone: Record<string, string> = {
  entered: "border-emerald-300 bg-emerald-50 hover:bg-emerald-100/70",
  exited: "border-amber-300 bg-amber-50 hover:bg-amber-100/70",
  rejected: "border-red-300 bg-red-50 hover:bg-red-100/70",
};
const pillTone: Record<string, string> = {
  entered: "bg-emerald-200 text-emerald-950",
  exited: "bg-amber-200 text-amber-950",
  rejected: "bg-red-200 text-red-950",
};

function unitLabel(units: Visit["units"]) {
  const unit = Array.isArray(units) ? units[0] : units;
  const building = Array.isArray(unit?.buildings) ? unit.buildings[0] : unit?.buildings;
  return [building?.name, unit?.code].filter(Boolean).join(" · ") || "Apartamento";
}

export async function PorteriaVisits({ supabase, propertyId, timeZone, tab, page = 1, date }: { supabase: SupabaseClient; propertyId: string; timeZone: string; tab: Tab; page?: number; date?: string }) {
  const today = dateInputValue(new Date(), timeZone);
  const todayStart = zonedDayStart(today, timeZone).toISOString();
  const yesterday = addDays(today, -1);
  // Historial: fecha elegida en el calendario (desde ese día hacia atrás); nunca hoy ni futura.
  const historyDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= yesterday ? date : undefined;
  const base = `/panel/propiedades/${propertyId}/visitas`;
  let query = supabase.from("visitors")
    .select("id,visitor_name,kind,service_type,people_count,status,scheduled_start,scheduled_end,units(code,buildings(name)),visitor_entries(entered_at,exited_at,notes,exit_notes)")
    .eq("property_id", propertyId);
  if (tab === "hoy") {
    // Todas las del día presente, más cualquiera que siga dentro (aunque sea de otro día),
    // para que siempre se pueda marcar su salida.
    const tomorrowStart = zonedDayStart(addDays(today, 1), timeZone).toISOString();
    query = query.in("status", acceptedOrRejected)
      .or(`status.eq.entered,and(scheduled_start.lt."${tomorrowStart}",scheduled_end.gt."${todayStart}")`)
      .order("scheduled_start", { ascending: true });
  } else if (tab === "visitas") {
    // Visitas: solo las que aún no llegan y las rechazadas, desde hoy (personales y de mantenimiento).
    query = query.in("status", ["authorized", "rejected"]).gt("scheduled_end", todayStart).order("scheduled_start", { ascending: true }).limit(200);
  } else {
    // Historial: días anteriores, de la más reciente a la más antigua. Las que siguen dentro
    // quedan en Hoy para poder marcar su salida. Se pide una de más para saber si hay otra página.
    query = query.in("status", ["authorized", "exited", "rejected", "cancelled"]).lte("scheduled_end", todayStart);
    if (historyDate) query = query.lt("scheduled_start", zonedDayStart(addDays(historyDate, 1), timeZone).toISOString());
    query = query.order("scheduled_start", { ascending: false }).range((page - 1) * historyPageSize, page * historyPageSize);
  }
  const { data, error } = await query;
  const hasOlder = tab === "historial" && (data?.length ?? 0) > historyPageSize;
  const visits = (data ?? []).slice(0, tab === "historial" ? historyPageSize : undefined) as Visit[];

  const time = new Intl.DateTimeFormat("es-CO", { timeStyle: "short", timeZone });
  const dateTime = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone });
  const dayLabel = (day: string) => day === today ? "Hoy" : day === addDays(today, 1) ? "Mañana" : day === addDays(today, -1) ? "Ayer"
    : new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  const tabLink = (label: string, href: string, active: boolean) => <Link href={href} aria-current={active ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-full px-3 py-1.5 text-xs font-medium sm:min-h-0 ${active ? "bg-primary text-white" : "bg-secondary"}`}>{label}</Link>;
  const empty = tab === "hoy" ? "No hay visitas para hoy." : tab === "visitas" ? "No hay visitas programadas desde hoy." : historyDate ? "No hay visitas en el historial hasta esa fecha." : "No hay visitas en el historial.";

  return <>
    <div className="mt-6 flex items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">
        {tabLink("Hoy", base, tab === "hoy")}
        {tabLink("Visitas", `${base}?vista=visitas`, tab === "visitas")}
        {tabLink("Historial", `${base}?vista=historial`, tab === "historial")}
      </div>
      {tab === "historial" && <HistoryDatePicker base={base} max={yesterday} value={historyDate} />}
    </div>
    {tab === "historial" && historyDate && <p className="mt-4 flex flex-wrap items-center gap-3 text-sm"><span>Desde el <strong>{new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${historyDate}T12:00:00Z`))}</strong> hacia atrás.</span><Link href={`${base}?vista=historial`} className="inline-flex min-h-10 items-center font-medium text-primary hover:underline">Ver las más recientes</Link></p>}
    <section aria-label="Lista de visitas" className="mt-6 grid gap-3">
      {error ? <p role="alert" className="rounded-xl border bg-card p-5 text-sm">No pudimos cargar las visitas. Inténtalo de nuevo.</p>
        : !visits.length ? <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">{empty}</p>
        : visits.map((visit, index) => {
          const detailPath = `${base}/${visit.id}`;
          const visitDay = dateInputValue(new Date(visit.scheduled_start), timeZone);
          const showDay = tab !== "hoy" && (index === 0 || dateInputValue(new Date(visits[index - 1].scheduled_start), timeZone) !== visitDay);
          const entry = [...(visit.visitor_entries ?? [])].sort((a, b) => b.entered_at.localeCompare(a.entered_at))[0];
          return <div key={visit.id} className="grid gap-3">{showDay && <h2 className="mt-3 text-sm font-semibold first-letter:uppercase">{dayLabel(visitDay)}</h2>}<article className={`rounded-xl border p-5 transition-colors motion-reduce:transition-none ${cardTone[visit.status] ?? "bg-card hover:bg-muted/50"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-semibold tracking-wider text-primary uppercase">{visitKindLabel(visit.kind)} · {unitLabel(visit.units)}</p><h2 className="mt-1 text-lg font-semibold"><Link href={detailPath} className="hover:underline">{visit.visitor_name}</Link></h2></div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${pillTone[visit.status] ?? "bg-secondary"}`}>{tab === "historial" && visit.status === "authorized" ? "No llegó" : visitStatusLabel(visit.status)}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{visit.kind === "maintenance" && visit.service_type ? `${visit.service_type} · ` : ""}{visit.people_count} persona{visit.people_count === 1 ? "" : "s"} autorizada{visit.people_count === 1 ? "" : "s"}</p>
            {entry && <div className="mt-2 grid gap-1 text-sm">
              <p><span className="font-medium">Entrada {time.format(new Date(entry.entered_at))}</span>{entry.notes ? ` · ${entry.notes}` : ""}</p>
              {entry.exited_at && <p><span className="font-medium">Salida {time.format(new Date(entry.exited_at))}</span>{entry.exit_notes ? ` · ${entry.exit_notes}` : ""}</p>}
            </div>}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <time dateTime={visit.scheduled_start}>{tab !== "hoy" || visitDay === today ? `${time.format(new Date(visit.scheduled_start))} — ${time.format(new Date(visit.scheduled_end))}` : `${dateTime.format(new Date(visit.scheduled_start))} — ${time.format(new Date(visit.scheduled_end))}`}</time>
              <div className="flex flex-wrap items-center gap-3"><Link href={detailPath} className="font-medium text-primary hover:underline">Ver visita →</Link>
                {visit.status === "authorized" && tab !== "historial" && <VisitQuickAction propertyId={propertyId} visitorId={visit.id} kind="entry" />}
                {visit.status === "entered" && <VisitQuickAction propertyId={propertyId} visitorId={visit.id} kind="exit" />}
              </div>
            </div>
          </article></div>;
        })}
    </section>
    {tab === "historial" && (page > 1 || hasOlder) && <nav aria-label="Páginas del historial" className="mt-6 flex items-center justify-between gap-3 text-sm">
      {page > 1 ? <Link href={`${base}?vista=historial${historyDate ? `&fecha=${historyDate}` : ""}${page > 2 ? `&pagina=${page - 1}` : ""}`} className="inline-flex min-h-10 items-center font-medium text-primary hover:underline">← Más recientes</Link> : <span />}
      {hasOlder && <Link href={`${base}?vista=historial${historyDate ? `&fecha=${historyDate}` : ""}&pagina=${page + 1}`} className="inline-flex min-h-10 items-center font-medium text-primary hover:underline">Más antiguas →</Link>}
    </nav>}
  </>;
}
