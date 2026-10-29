import Link from "next/link";
import { COLOMBIA_TIME_ZONE } from "@/lib/time-zone";

export type MaintenanceDashboard = {
  active_workers: number; open_previous: number; to_review: number; overdue: number; due_today: number;
  on_shift: { name: string; check_in_at: string }[];
};

const time = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: COLOMBIA_TIME_ZONE });

// Inicio del admin de mantenimiento (28/10/2026): por atender y quién está en jornada. Debajo, la página
// pone las gráficas del informe del mes (29/10/2026), las mismas del PDF.
export function MaintenanceOverview({ data }: { data: MaintenanceDashboard }) {
  const items = [
    { label: "Tareas por revisar", count: data.to_review, href: "/mantenimiento/tareas?estado=submitted", urgent: false },
    { label: "Tareas vencidas", count: data.overdue, href: "/mantenimiento/tareas?estado=overdue", urgent: true },
    { label: "Tareas que vencen hoy", count: data.due_today, href: "/mantenimiento/tareas?estado=pending", urgent: false },
    { label: "Jornadas sin salida de días anteriores", count: data.open_previous, href: "/mantenimiento/asistencia", urgent: true },
  ].filter((item) => item.count > 0);
  return <section className="grid gap-4 lg:grid-cols-2">
    <article aria-labelledby="por-atender" className="rounded-2xl border bg-white p-5">
      <h2 id="por-atender" className="text-lg font-semibold">Por atender</h2>
      {items.length ? <ul className="mt-3 grid gap-2">{items.map((item) => <li key={item.label}><Link href={item.href} className="flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors hover:bg-secondary">
        <span className="flex items-center gap-2 font-medium">{item.urgent && <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-red-500" />}{item.label}</span>
        <span className="shrink-0 rounded-full bg-primary/12 px-2.5 py-0.5 text-sm font-semibold text-primary">{item.count}</span>
      </Link></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Todo al día: no hay pendientes por atender.</p>}
    </article>
    <article aria-labelledby="en-jornada" className="rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between gap-3"><h2 id="en-jornada" className="text-lg font-semibold">En jornada ahora</h2><Link href="/mantenimiento/asistencia" className="text-xs text-muted-foreground hover:text-foreground">Ver asistencia →</Link></div>
      {data.on_shift.length ? <ul className="mt-3 grid gap-2">{data.on_shift.map((worker, index) => <li key={index} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm"><span className="font-medium">{worker.name}</span><span className="text-muted-foreground">Llegó a las {time.format(new Date(worker.check_in_at))}</span></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Nadie ha marcado llegada hoy.</p>}
    </article>
  </section>;
}
