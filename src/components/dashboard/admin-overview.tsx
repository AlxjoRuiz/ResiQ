import Link from "next/link";
import { CheckCircle2, Clock3, TriangleAlert } from "lucide-react";
import { CollectionChart, type CollectionPoint } from "./collection-chart";

export type AdminDashboard = {
  pending_evidence: { count: number; units: { unit_id: string; label: string }[] };
  pending_reservations: number; urgent_reservations: number; open_pqrs: number; visit_requests: number; convocations_to_approve: number;
  month: { billed: number; collected: number; overdue: number; units_in_arrears: number; active_agreements: number };
  series: CollectionPoint[];
  statuses: { current: number; pending: number; overdue: number };
};

const cop = (value: number) => Number(value).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
// Colores de estado reservados (con ícono y texto, nunca solo color).
const STATUS = [
  { key: "current", label: "Al día", color: "#0ca30c", Icon: CheckCircle2 },
  { key: "pending", label: "Pendiente", color: "#fab219", Icon: Clock3 },
  { key: "overdue", label: "En mora", color: "#d03b3b", Icon: TriangleAlert },
] as const;

function Tile({ value, label, detail }: { value: string; label: string; detail?: string }) {
  return <div className="rounded-2xl border bg-white p-4"><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</div>;
}

// Inicio del admin (28/10/2026): pendientes por atender, cifras de cartera del mes y dos gráficas.
export function AdminOverview({ propertyId, data }: { propertyId: string; data: AdminDashboard }) {
  const base = `/panel/propiedades/${propertyId}`;
  const items = [
    { label: "Comprobantes por registrar", count: data.pending_evidence.count, href: `${base}/cartera`, urgent: data.pending_evidence.count > 0, detail: data.pending_evidence.units.slice(0, 4).map((unit) => unit.label).join(", ") + (data.pending_evidence.units.length > 4 ? ` y ${data.pending_evidence.units.length - 4} más` : "") },
    { label: "Reservas por aprobar", count: data.pending_reservations, href: `${base}/reservas?status=pending`, urgent: data.urgent_reservations > 0, detail: data.urgent_reservations > 0 ? `${data.urgent_reservations} vence${data.urgent_reservations === 1 ? "" : "n"} en menos de 2 horas` : "" },
    { label: "PQRS sin cerrar", count: data.open_pqrs, href: `${base}/pqrs`, urgent: false, detail: "" },
    { label: "Visitas por aprobar", count: data.visit_requests, href: `${base}/visitas`, urgent: false, detail: "" },
    { label: "Convocatorias por aprobar", count: data.convocations_to_approve, href: `${base}/asambleas`, urgent: false, detail: "" },
  ];
  const pending = items.filter((item) => item.count > 0);
  const percent = data.month.billed > 0 ? Math.round((data.month.collected / data.month.billed) * 100) : null;
  const totalUnits = data.statuses.current + data.statuses.pending + data.statuses.overdue;
  return <div className="mb-6 grid gap-6">
    <section aria-labelledby="por-atender" className="rounded-2xl border bg-white p-5">
      <h2 id="por-atender" className="text-lg font-semibold">Por atender</h2>
      {pending.length ? <ul className="mt-3 grid gap-2 sm:grid-cols-2">{pending.map((item) => <li key={item.label}><Link href={item.href} className="flex items-start justify-between gap-3 rounded-xl border p-3 transition-colors hover:bg-secondary">
        <span className="min-w-0"><span className="flex items-center gap-2 font-medium">{item.urgent && <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-red-500" />}{item.label}</span>{item.detail && <span className="mt-0.5 block text-xs text-muted-foreground">{item.detail}</span>}</span>
        <span className="shrink-0 rounded-full bg-primary/12 px-2.5 py-0.5 text-sm font-semibold text-primary">{item.count}</span>
      </Link></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Todo al día: no hay pendientes por atender.</p>}
    </section>
    <section aria-label="Cartera del mes" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Tile value={cop(data.month.collected)} label="Recaudado este mes" detail={percent === null ? "Sin facturación este mes" : `${percent}% de ${cop(data.month.billed)} facturado`} />
      <Tile value={cop(data.month.overdue)} label="Cartera vencida" />
      <Tile value={String(data.month.units_in_arrears)} label="Apartamentos en mora" />
      <Tile value={String(data.month.active_agreements)} label="Acuerdos de pago activos" />
    </section>
    <section aria-label="Gráficas de cartera" className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      <article className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Recaudo de los últimos 6 meses</h2><p className="mb-3 text-xs text-muted-foreground">Facturado (obligaciones emitidas) y recaudado (pagos registrados) cada mes.</p><CollectionChart points={data.series ?? []} /></article>
      <article className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Estado de las cuentas</h2><p className="mb-4 text-xs text-muted-foreground">{totalUnits} apartamentos activos.</p>
        <div role="img" aria-label={STATUS.map((status) => `${status.label}: ${data.statuses[status.key]}`).join(", ")} className="flex h-4 gap-0.5 overflow-hidden rounded-full bg-muted">{STATUS.map((status) => data.statuses[status.key] > 0 && <span key={status.key} title={`${status.label}: ${data.statuses[status.key]}`} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(data.statuses[status.key] / Math.max(totalUnits, 1)) * 100}%`, background: status.color }} />)}</div>
        <ul className="mt-4 grid gap-2 text-sm">{STATUS.map(({ key, label, color, Icon }) => <li key={key} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><Icon size={16} aria-hidden="true" style={{ color }} />{label}</span><span className="font-semibold">{data.statuses[key]} <span className="font-normal text-muted-foreground">({totalUnits ? Math.round((data.statuses[key] / totalUnits) * 100) : 0}%)</span></span></li>)}</ul>
      </article>
    </section>
  </div>;
}
