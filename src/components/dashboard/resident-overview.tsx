import Link from "next/link";
import { CalendarDays, DoorOpen, Megaphone, Package, Users, Wallet } from "lucide-react";
import { rsvpLabels } from "@/lib/assemblies/constants";
import { receivedItemLabel } from "@/lib/packages/constants";
import { reservationStatusLabel } from "@/lib/reservations/constants";
import { visitStatusLabel } from "@/lib/visitors/constants";

export type ResidentDashboard = {
  finance: { balance: number; overdue: number; next_due: { concept: string; due_on: string; amount: number } | null; unit_id: string | null };
  packages: { id: string; kind: string; utility_service: string | null; received_at: string }[];
  reservations: { id: string; amenity: string; starts_at: string; ends_at: string; status: string }[];
  visitors: { id: string; visitor_name: string; scheduled_start: string; status: string }[];
  assembly: { id: string; title: string; starts_at: string; location: string; status: string; rsvp: string } | null;
  announcements: { id: string; subject: string; published_at: string }[];
};

const cop = (value: number) => Number(value).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

function Card({ title, icon: Icon, href, linkLabel, children }: { title: string; icon: typeof Wallet; href: string; linkLabel: string; children: React.ReactNode }) {
  return <article className="rounded-2xl border bg-white p-5">
    <header className="mb-3 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><Icon size={18} className="text-primary" aria-hidden="true" />{title}</h2><Link href={href} className="text-xs text-primary hover:underline">{linkLabel} →</Link></header>
    {children}
  </article>;
}

// Inicio del residente (28/10/2026): cartera, paquetes por recoger, próximas reservas y visitas,
// próxima asamblea y comunicados recientes.
export function ResidentOverview({ propertyId, timeZone, data }: { propertyId: string; timeZone: string; data: ResidentDashboard }) {
  const base = `/panel/propiedades/${propertyId}`;
  const when = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone });
  const day = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", timeZone: "UTC" });
  const empty = (text: string) => <p className="text-sm text-muted-foreground">{text}</p>;
  const finance = data.finance;
  return <div className="mb-6 grid gap-4 lg:grid-cols-2">
    <Card title="Mi cartera" icon={Wallet} href={`${base}/cartera`} linkLabel="Ver cartera">
      <div className="flex flex-wrap items-end gap-6"><div><p className="text-2xl font-semibold">{cop(finance.balance)}</p><p className="text-xs text-muted-foreground">Saldo pendiente</p></div>{finance.overdue > 0 && <div><p className="text-lg font-semibold text-red-700">{cop(finance.overdue)}</p><p className="text-xs text-muted-foreground">Vencido</p></div>}</div>
      {finance.next_due ? <p className="mt-3 text-sm">Próximo pago: <strong>{finance.next_due.concept}</strong> · {cop(finance.next_due.amount)} · vence el {day.format(new Date(`${finance.next_due.due_on}T12:00:00Z`))}</p> : <p className="mt-3 text-sm text-muted-foreground">Estás al día.</p>}
      {finance.balance > 0 && finance.unit_id && <Link href={`${base}/cartera/${finance.unit_id}`} className="mt-4 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90">Subir comprobante</Link>}
    </Card>
    <Card title="Paquetes por recoger" icon={Package} href={`${base}/paquetes`} linkLabel="Ver paquetes">
      {data.packages.length ? <ul className="grid gap-2 text-sm">{data.packages.slice(0, 3).map((item) => <li key={item.id} className="flex justify-between gap-3"><span>{receivedItemLabel(item.kind, item.utility_service)}</span><span className="text-xs text-muted-foreground">{when.format(new Date(item.received_at))}</span></li>)}{data.packages.length > 3 && <li className="text-xs text-muted-foreground">y {data.packages.length - 3} más en portería</li>}</ul> : empty("No tienes paquetes en portería.")}
    </Card>
    <Card title="Mis próximas reservas" icon={CalendarDays} href={`${base}/reservas`} linkLabel="Ver reservas">
      {data.reservations.length ? <ul className="grid gap-2 text-sm">{data.reservations.map((item) => <li key={item.id} className="flex justify-between gap-3"><span><strong>{item.amenity}</strong> · {when.format(new Date(item.starts_at))}</span><span className="text-xs text-muted-foreground">{reservationStatusLabel(item.status)}</span></li>)}</ul> : empty("No tienes reservas próximas.")}
    </Card>
    <Card title="Mis próximas visitas" icon={DoorOpen} href={`${base}/visitas`} linkLabel="Ver visitas">
      {data.visitors.length ? <ul className="grid gap-2 text-sm">{data.visitors.map((item) => <li key={item.id} className="flex justify-between gap-3"><span><strong>{item.visitor_name}</strong> · {when.format(new Date(item.scheduled_start))}</span><span className="text-xs text-muted-foreground">{visitStatusLabel(item.status)}</span></li>)}</ul> : empty("No tienes visitas próximas.")}
    </Card>
    <Card title="Próxima asamblea" icon={Users} href={data.assembly ? `${base}/asambleas/${data.assembly.id}` : `${base}/asambleas`} linkLabel={data.assembly ? "Abrir" : "Ver asambleas"}>
      {data.assembly ? <div className="text-sm"><p className="font-medium">{data.assembly.title}</p><p className="mt-1 text-muted-foreground">{when.format(new Date(data.assembly.starts_at))} · {data.assembly.location}</p><p className="mt-2">{data.assembly.status === "in_progress" ? <strong className="text-primary">En curso: entra para marcar tu asistencia y votar.</strong> : <>Tu respuesta: <strong>{rsvpLabels[data.assembly.rsvp] ?? data.assembly.rsvp}</strong></>}</p></div> : empty("No hay asambleas convocadas.")}
    </Card>
    <Card title="Comunicados recientes" icon={Megaphone} href={`${base}/comunicados`} linkLabel="Ver comunicados">
      {data.announcements.length ? <ul className="grid gap-2 text-sm">{data.announcements.map((item) => <li key={item.id}><Link href={`${base}/comunicados/${item.id}`} className="flex justify-between gap-3 hover:text-primary"><span className="min-w-0 truncate">{item.subject}</span><span className="shrink-0 text-xs text-muted-foreground">{when.format(new Date(item.published_at))}</span></Link></li>)}</ul> : empty("No hay comunicados.")}
    </Card>
  </div>;
}
