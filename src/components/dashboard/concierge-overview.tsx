import Link from "next/link";
import { CalendarDays, DoorOpen, Package } from "lucide-react";
import { receivedItemLabel } from "@/lib/packages/constants";
import { visitStatusLabel } from "@/lib/visitors/constants";

export type ConciergeDashboard = {
  visits: { expected: number; inside: number; exited: number; upcoming: { id: string; visitor_name: string; scheduled_start: string; status: string; unit: string }[] };
  packages: { count: number; items: { id: string; kind: string; utility_service: string | null; recipient_name: string; received_at: string; unit: string }[] };
  reservations: { id: string; amenity: string; starts_at: string; ends_at: string; unit: string }[];
};

function Count({ value, label }: { value: number; label: string }) {
  return <div className="rounded-xl bg-secondary/60 px-3 py-2 text-center"><p className="text-xl font-semibold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>;
}

// Inicio de portería (28/10/2026): visitas de hoy, paquetes por entregar y reservas de hoy.
export function ConciergeOverview({ propertyId, timeZone, data }: { propertyId: string; timeZone: string; data: ConciergeDashboard }) {
  const base = `/panel/propiedades/${propertyId}`;
  const time = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone });
  const when = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone });
  const header = (title: string, Icon: typeof DoorOpen, href: string, label: string) => <header className="mb-3 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><Icon size={18} className="text-primary" aria-hidden="true" />{title}</h2><Link href={href} className="text-xs text-primary hover:underline">{label} →</Link></header>;
  return <div className="mb-6 grid gap-4 lg:grid-cols-2">
    <article className="rounded-2xl border bg-white p-5 lg:col-span-2">
      {header("Visitas de hoy", DoorOpen, `${base}/visitas`, "Ver visitas")}
      <div className="grid grid-cols-3 gap-2"><Count value={data.visits.expected} label="Por llegar" /><Count value={data.visits.inside} label="Adentro" /><Count value={data.visits.exited} label="Ya salieron" /></div>
      {data.visits.upcoming.length ? <ul className="mt-4 grid gap-2 text-sm">{data.visits.upcoming.map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-2"><span><strong>{item.visitor_name}</strong> · {item.unit}</span><span className="text-xs text-muted-foreground">{time.format(new Date(item.scheduled_start))} · {visitStatusLabel(item.status)}</span></li>)}</ul> : <p className="mt-4 text-sm text-muted-foreground">No hay visitas pendientes para hoy.</p>}
    </article>
    <article className="rounded-2xl border bg-white p-5">
      {header("Paquetes por entregar", Package, `${base}/paquetes`, "Ver paquetes")}
      <p className="text-2xl font-semibold">{data.packages.count}</p>
      {data.packages.items.length ? <ul className="mt-3 grid gap-2 text-sm">{data.packages.items.map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-2"><span>{receivedItemLabel(item.kind, item.utility_service)} · <strong>{item.unit}</strong></span><span className="text-xs text-muted-foreground">{when.format(new Date(item.received_at))}</span></li>)}{data.packages.count > data.packages.items.length && <li className="text-xs text-muted-foreground">y {data.packages.count - data.packages.items.length} más</li>}</ul> : <p className="mt-2 text-sm text-muted-foreground">No hay paquetes por entregar.</p>}
    </article>
    <article className="rounded-2xl border bg-white p-5">
      {header("Reservas de hoy", CalendarDays, `${base}/reservas`, "Ver reservas")}
      {data.reservations.length ? <ul className="grid gap-2 text-sm">{data.reservations.map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-2"><span><strong>{item.amenity}</strong> · {item.unit}</span><span className="text-xs text-muted-foreground">{time.format(new Date(item.starts_at))} – {time.format(new Date(item.ends_at))}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">No hay reservas aprobadas para hoy.</p>}
    </article>
  </div>;
}
