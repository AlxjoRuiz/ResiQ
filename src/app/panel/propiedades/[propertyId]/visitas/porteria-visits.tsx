import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { VisitQuickAction } from "@/components/visitors/visit-forms";
import { visitKindLabel, visitStatusLabel } from "@/lib/visitors/constants";
import { addDays, dateInputValue, zonedDayStart } from "@/lib/time-zone";

// Visitas en portería: pestañas Hoy (por día), Dentro, Mantenimiento y Todas (aceptadas y
// rechazadas). Las tarjetas siguen el diseño de Notificaciones; la entrada y la salida se
// marcan desde la tarjeta, con comentario. Verde: ya entró. Amarillo: ya salió.
type Unit = { code: string; buildings: { name: string } | { name: string }[] | null };
type Entry = { entered_at: string; exited_at: string | null; notes: string | null; exit_notes: string | null };
type Visit = { id: string; visitor_name: string; kind: string; service_type: string | null; people_count: number; status: string; scheduled_start: string; scheduled_end: string; units: Unit | Unit[] | null; visitor_entries: Entry[] | null };
type Tab = "dia" | "dentro" | "mantenimiento" | "todas";

const acceptedOrRejected = ["authorized", "entered", "exited", "rejected"];
const cardTone: Record<string, string> = {
  entered: "border-emerald-300 bg-emerald-50 hover:bg-emerald-100/70",
  exited: "border-amber-300 bg-amber-50 hover:bg-amber-100/70",
  rejected: "border-rose-300 bg-rose-50 hover:bg-rose-100/70",
};
const pillTone: Record<string, string> = {
  entered: "bg-emerald-200 text-emerald-950",
  exited: "bg-amber-200 text-amber-950",
  rejected: "bg-rose-200 text-rose-950",
};

function unitLabel(units: Visit["units"]) {
  const unit = Array.isArray(units) ? units[0] : units;
  const building = Array.isArray(unit?.buildings) ? unit.buildings[0] : unit?.buildings;
  return [building?.name, unit?.code].filter(Boolean).join(" · ") || "Apartamento";
}

export async function PorteriaVisits({ supabase, propertyId, timeZone, tab, day }: { supabase: SupabaseClient; propertyId: string; timeZone: string; tab: Tab; day?: string }) {
  const today = dateInputValue(new Date(), timeZone);
  const selectedDay = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : today;
  const base = `/panel/propiedades/${propertyId}/visitas`;
  let query = supabase.from("visitors")
    .select("id,visitor_name,kind,service_type,people_count,status,scheduled_start,scheduled_end,units(code,buildings(name)),visitor_entries(entered_at,exited_at,notes,exit_notes)")
    .eq("property_id", propertyId);
  if (tab === "dia") {
    query = query.in("status", ["authorized", "entered", "exited"])
      .lt("scheduled_start", zonedDayStart(addDays(selectedDay, 1), timeZone).toISOString())
      .gt("scheduled_end", zonedDayStart(selectedDay, timeZone).toISOString())
      .order("scheduled_start", { ascending: true });
  } else if (tab === "dentro") {
    query = query.eq("status", "entered").order("scheduled_start", { ascending: true });
  } else {
    query = query.in("status", acceptedOrRejected).order("scheduled_start", { ascending: false }).limit(100);
    if (tab === "mantenimiento") query = query.eq("kind", "maintenance");
  }
  const { data, error } = await query;
  const visits = (data ?? []) as Visit[];

  const time = new Intl.DateTimeFormat("es-CO", { timeStyle: "short", timeZone });
  const dateTime = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone });
  const dayLabel = selectedDay === today ? "Hoy" : selectedDay === addDays(today, 1) ? "Mañana"
    : new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${selectedDay}T12:00:00Z`));
  const tabLink = (label: string, href: string, active: boolean) => <Link href={href} aria-current={active ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-full px-3 py-1.5 text-xs font-medium sm:min-h-0 ${active ? "bg-primary text-white" : "bg-secondary"}`}>{label}</Link>;
  const empty = tab === "dia" ? `No hay visitas aceptadas para ${dayLabel.toLowerCase()}.` : tab === "dentro" ? "No hay visitas dentro del conjunto." : "No hay visitas con este filtro.";

  return <>
    <div className="mt-6 flex flex-wrap gap-2">
      {tabLink("Hoy", base, tab === "dia")}
      {tabLink("Dentro", `${base}?vista=dentro`, tab === "dentro")}
      {tabLink("Mantenimiento", `${base}?vista=mantenimiento`, tab === "mantenimiento")}
      {tabLink("Todas", `${base}?vista=todas`, tab === "todas")}
    </div>
    {tab === "dia" && <nav aria-label="Cambiar de día" className="mt-4 flex items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2 text-sm">
      <Link href={`${base}?dia=${addDays(selectedDay, -1)}`} className="inline-flex min-h-10 items-center px-2 font-medium text-primary hover:underline">← Anterior</Link>
      <span className="font-semibold first-letter:uppercase">{dayLabel}</span>
      <Link href={`${base}?dia=${addDays(selectedDay, 1)}`} className="inline-flex min-h-10 items-center px-2 font-medium text-primary hover:underline">Siguiente →</Link>
    </nav>}
    <section aria-label="Lista de visitas" className="mt-6 grid gap-3">
      {error ? <p role="alert" className="rounded-xl border bg-card p-5 text-sm">No pudimos cargar las visitas. Inténtalo de nuevo.</p>
        : !visits.length ? <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">{empty}</p>
        : visits.map((visit) => {
          const detailPath = `${base}/${visit.id}`;
          const entry = [...(visit.visitor_entries ?? [])].sort((a, b) => b.entered_at.localeCompare(a.entered_at))[0];
          return <article key={visit.id} className={`rounded-xl border p-5 transition-colors motion-reduce:transition-none ${cardTone[visit.status] ?? "bg-card hover:bg-muted/50"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-semibold tracking-wider text-primary uppercase">{visitKindLabel(visit.kind)} · {unitLabel(visit.units)}</p><h2 className="mt-1 text-lg font-semibold"><Link href={detailPath} className="hover:underline">{visit.visitor_name}</Link></h2></div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${pillTone[visit.status] ?? "bg-secondary"}`}>{visitStatusLabel(visit.status)}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{visit.kind === "maintenance" && visit.service_type ? `${visit.service_type} · ` : ""}{visit.people_count} persona{visit.people_count === 1 ? "" : "s"} autorizada{visit.people_count === 1 ? "" : "s"}</p>
            {entry && <div className="mt-2 grid gap-1 text-sm">
              <p><span className="font-medium">Entrada {time.format(new Date(entry.entered_at))}</span>{entry.notes ? ` · ${entry.notes}` : ""}</p>
              {entry.exited_at && <p><span className="font-medium">Salida {time.format(new Date(entry.exited_at))}</span>{entry.exit_notes ? ` · ${entry.exit_notes}` : ""}</p>}
            </div>}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <time dateTime={visit.scheduled_start}>{tab === "dia" ? `${time.format(new Date(visit.scheduled_start))} — ${time.format(new Date(visit.scheduled_end))}` : `${dateTime.format(new Date(visit.scheduled_start))} — ${time.format(new Date(visit.scheduled_end))}`}</time>
              <div className="flex flex-wrap items-center gap-3"><Link href={detailPath} className="font-medium text-primary hover:underline">Ver visita →</Link>
                {visit.status === "authorized" && <VisitQuickAction propertyId={propertyId} visitorId={visit.id} kind="entry" />}
                {visit.status === "entered" && <VisitQuickAction propertyId={propertyId} visitorId={visit.id} kind="exit" />}
              </div>
            </div>
          </article>;
        })}
    </section>
  </>;
}
