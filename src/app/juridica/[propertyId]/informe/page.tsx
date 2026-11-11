import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, DollarSign, FileWarning, Handshake, Scale, TrendingDown, TrendingUp, UsersRound } from "lucide-react";
import { requireLegalStaff } from "@/lib/auth/require-legal-staff";
import { formatCop } from "@/lib/finance/constants";
import { uuidPattern } from "../../legal-data";
import { PrintButton } from "./print-button";

// Informe de gestión de cartera del conjunto (11/11/2026, pedido de Alejandro), guiado por el informe de
// referencia que compartió: texto de resumen, cifras, recaudo por mes, distribución por estado, resumen
// ejecutivo y detalle por caso. Todo sale de legal_property_report (solo lectura). «Descargar PDF» abre la
// impresión del navegador; al imprimir no salen la barra lateral ni los filtros.
type State = "finalized" | "agreement" | "pre_legal";
type Case = { unit_id: string; unit_label: string; owner_name: string | null; first_notice_on: string; notice_count: number; first_total: number; outstanding: number; collected: number; state: State };
type Report = {
  property: { name: string; city: string | null; address: string | null }; today: string; started_on: string | null; first_notice_on: string | null;
  cases: Case[]; monthly: { month: string; amount: number }[]; units_total: number; units_in_arrears: number; arrears_total: number; unmanaged: { count: number; amount: number };
};

const stateInfo: Record<State, { label: string; color: string; pill: string; summary: string }> = {
  finalized: { label: "Finalizado", color: "#1d4ed8", pill: "bg-primary/12 text-primary", summary: "Casos que ya pagaron toda la deuda: hoy no deben nada." },
  agreement: { label: "Acuerdo de pago", color: "#60a5fa", pill: "bg-sky-100 text-sky-800", summary: "Casos con acuerdo de pago vigente, en seguimiento cuota a cuota." },
  pre_legal: { label: "Prejurídico", color: "#f59e0b", pill: "bg-amber-100 text-amber-900", summary: "Casos con requerimiento enviado que todavía tienen saldo y no han firmado acuerdo." },
};
const unmanagedColor = "#dc2626";

const longDate = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const formatLong = (value: string | null) => value ? longDate.format(new Date(`${value.slice(0, 10)}T12:00:00Z`)) : "—";
const monthName = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" });
const monthShort = new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: "UTC" });
const asDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`);
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const percent = (part: number, whole: number) => whole > 0 ? `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format((part / whole) * 100)} %` : "0 %";
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

// Texto del informe redactado con las cifras reales del conjunto.
function narrative(report: Report, totals: { requested: number; collected: number; byState: Record<State, Case[]> }) {
  const name = report.property.name;
  const cases = report.cases.length;
  const paragraphs: string[] = [];
  if (!cases) {
    paragraphs.push(`${report.started_on ? `El ${formatLong(report.started_on)} ResiQ asignó ${name} a gestión de cobro. ` : ""}A la fecha aún no se han enviado requerimientos de pago, por lo que no hay casos en gestión.`);
    if (report.unmanaged.count) paragraphs.push(`Hoy ${plural(report.unmanaged.count, "apartamento está", "apartamentos están")} en mora por ${formatCop(report.unmanaged.amount)}. Se recomienda iniciar su gestión con el envío de los requerimientos de pago.`);
    return paragraphs;
  }
  const finalized = totals.byState.finalized, agreement = totals.byState.agreement, preLegal = totals.byState.pre_legal;
  paragraphs.push(`${report.started_on ? `El ${formatLong(report.started_on)} iniciamos la gestión de cobro de ${name}` : `Iniciamos la gestión de cobro de ${name}`}${report.first_notice_on ? ` y desde el ${formatLong(report.first_notice_on)} enviamos requerimientos de pago` : ""} a ${plural(cases, "apartamento", "apartamentos")}, con una cartera requerida de ${formatCop(totals.requested)}. A la fecha hemos logrado un recaudo efectivo de ${formatCop(totals.collected)}, que corresponde al ${percent(totals.collected, totals.requested)} de la cartera requerida.`);
  const balance = [finalized.length ? `${plural(finalized.length, "caso finalizado", "casos finalizados")}, con la deuda saldada` : "", agreement.length ? `${plural(agreement.length, "acuerdo de pago vigente", "acuerdos de pago vigentes")} en seguimiento` : "", preLegal.length ? `${plural(preLegal.length, "caso", "casos")} en gestión prejurídica con un saldo de ${formatCop(preLegal.reduce((sum, item) => sum + Number(item.outstanding), 0))}` : ""].filter(Boolean);
  paragraphs.push(`En este balance, la gestión se resume en ${balance.length > 1 ? `${balance.slice(0, -1).join(", ")} y ${balance.at(-1)}` : balance[0]}.${preLegal.length ? " La prioridad es lograr compromisos de pago con los casos prejurídicos y hacer seguimiento a los acuerdos vigentes para que se materialicen nuevos ingresos." : agreement.length ? " La prioridad es hacer seguimiento a los acuerdos vigentes para que cada cuota se pague a tiempo." : ""}`);
  if (report.unmanaged.count) paragraphs.push(`Además, ${plural(report.unmanaged.count, "apartamento está", "apartamentos están")} hoy en mora por ${formatCop(report.unmanaged.amount)} sin requerimiento de pago; se recomienda incluirlos en la gestión.`);
  return paragraphs;
}

// Gráfica de barras del recaudo por mes (SVG, se imprime igual).
function MonthlyChart({ monthly }: { monthly: Report["monthly"] }) {
  const width = 560, height = 230, left = 56, bottom = 30, top = 16;
  const max = Math.max(...monthly.map((item) => Number(item.amount)), 1);
  const step = (width - left - 10) / monthly.length;
  const scale = (value: number) => (height - bottom - top) * (value / max);
  const ticks = [0, 0.5, 1].map((part) => part * max);
  const short = (value: number) => value >= 1_000_000 ? `$${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(value / 1_000_000)} M` : value >= 1000 ? `$${Math.round(value / 1000)} mil` : `$${Math.round(value)}`;
  return <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Recaudo por mes de los últimos seis meses" className="h-auto w-full">
    {ticks.map((tick) => { const y = height - bottom - scale(tick); return <g key={tick}><line x1={left} x2={width - 10} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" /><text x={left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">{short(tick)}</text></g>; })}
    {monthly.map((item, index) => { const value = Number(item.amount); const barHeight = scale(value); const x = left + index * step + step * 0.22; const barWidth = step * 0.56; return <g key={item.month}>
      <rect x={x} y={height - bottom - barHeight} width={barWidth} height={Math.max(barHeight, value > 0 ? 2 : 0)} rx="6" fill="#1d4ed8"><title>{`${capital(monthName.format(asDate(item.month)))}: ${formatCop(value)}`}</title></rect>
      {value > 0 && <text x={x + barWidth / 2} y={height - bottom - barHeight - 6} textAnchor="middle" fontSize="10.5" fill="#1e3a8a" fontWeight="600">{short(value)}</text>}
      <text x={x + barWidth / 2} y={height - 10} textAnchor="middle" fontSize="11.5" fill="#475569">{capital(monthShort.format(asDate(item.month)).replace(".", ""))}</text>
    </g>; })}
  </svg>;
}

// Gráfica de anillo con la distribución de los apartamentos por estado.
function StateDonut({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  const radius = 70, circumference = 2 * Math.PI * radius;
  let offset = 0;
  return <div className="flex flex-wrap items-center justify-center gap-6">
    <svg viewBox="0 0 200 200" role="img" aria-label="Distribución de apartamentos por estado" className="size-48 shrink-0 -rotate-90">
      <circle cx="100" cy="100" r={radius} fill="none" stroke="#eef2f7" strokeWidth="26" />
      {total > 0 && parts.filter((part) => part.value > 0).map((part) => { const length = (part.value / total) * circumference; const dash = <circle key={part.label} cx="100" cy="100" r={radius} fill="none" stroke={part.color} strokeWidth="26" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset}><title>{`${part.label}: ${part.value}`}</title></circle>; offset += length; return dash; })}
      <text x="100" y="100" transform="rotate(90 100 100)" textAnchor="middle" dominantBaseline="central" fontSize="30" fontWeight="600" fill="#0f172a">{total}</text>
    </svg>
    <ul className="grid gap-2 text-sm">{parts.map((part) => <li key={part.label} className="flex items-center gap-2"><span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: part.color }} /><span className="text-slate-700">{part.label}</span><span className="ml-auto pl-4 font-semibold">{part.value}</span><span className="w-14 text-right text-xs text-slate-500">{percent(part.value, total)}</span></li>)}</ul>
  </div>;
}

export default async function LegalReportPage({ params, searchParams }: { params: Promise<{ propertyId: string }>; searchParams: Promise<{ estado?: string }> }) {
  const { propertyId } = await params;
  if (!uuidPattern.test(propertyId)) notFound();
  const { supabase } = await requireLegalStaff();
  const { data, error } = await supabase.rpc("legal_property_report", { target_property_id: propertyId });
  if (error || !data) notFound();
  const report = data as Report;
  const cases = report.cases.map((item) => ({ ...item, first_total: Number(item.first_total), outstanding: Number(item.outstanding), collected: Number(item.collected) }));
  const byState = { finalized: cases.filter((item) => item.state === "finalized"), agreement: cases.filter((item) => item.state === "agreement"), pre_legal: cases.filter((item) => item.state === "pre_legal") } as Record<State, Case[]>;
  const totals = { requested: cases.reduce((sum, item) => sum + item.first_total, 0), collected: cases.reduce((sum, item) => sum + item.collected, 0), byState };
  const sumCollected = (items: Case[]) => items.reduce((sum, item) => sum + item.collected, 0);
  const sumOutstanding = (items: Case[]) => items.reduce((sum, item) => sum + item.outstanding, 0);
  const { estado } = await searchParams;
  const filter = (["finalized", "agreement", "pre_legal"] as const).find((value) => value === estado) ?? null;
  const shown = filter ? byState[filter] : cases;
  const lastMonths = report.monthly.slice(-3);
  const generated = formatLong(report.today);
  const kpis = [
    { icon: DollarSign, label: "Recaudo total", value: formatCop(totals.collected), detail: `${percent(totals.collected, totals.requested)} de lo requerido` },
    { icon: UsersRound, label: "Casos en gestión", value: String(cases.length), detail: `Cartera requerida ${formatCop(totals.requested)}` },
    { icon: CircleCheck, label: "Finalizados", value: String(byState.finalized.length), detail: formatCop(sumCollected(byState.finalized)) },
    { icon: Handshake, label: "Acuerdo de pago", value: String(byState.agreement.length), detail: formatCop(sumCollected(byState.agreement)) },
    { icon: Scale, label: "Prejurídico", value: String(byState.pre_legal.length), detail: `Saldo ${formatCop(sumOutstanding(byState.pre_legal))}` },
  ];
  const card = "rounded-2xl border border-slate-200 bg-white p-5 break-inside-avoid";

  return <div className="mx-auto w-full max-w-6xl print:max-w-none">
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <Link href={`/juridica/${propertyId}`} className="text-sm text-muted-foreground hover:text-foreground">← Cartera del conjunto</Link>
      <PrintButton />
    </div>

    <header className="mt-4 flex flex-wrap items-end justify-between gap-4 border-b pb-6">
      <div>
        <p className="text-xs font-semibold tracking-wider text-primary uppercase">Informe de gestión de cartera</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{report.property.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{[report.property.address, report.property.city].filter(Boolean).join(" · ")}{report.started_on ? ` · Gestión desde el ${formatLong(report.started_on)}` : ""} · Corte al {generated}</p>
      </div>
      <p className="text-right text-xs text-muted-foreground">ResiQ · Cobro jurídico</p>
    </header>

    <section aria-label="Resumen" className="mt-6 grid gap-3 text-[15px] leading-7 text-slate-700">{narrative(report, totals).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>

    <section aria-label="Cifras principales" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {kpis.map(({ icon: Icon, label, value, detail }) => <div key={label} className={card}>
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon size={18} aria-hidden="true" /></span>
        <p className="mt-3 text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold tracking-tight">{value}</p><p className="mt-0.5 text-xs text-slate-500">{detail}</p>
      </div>)}
    </section>

    <section aria-label="Recaudo de los últimos meses" className="mt-3 grid gap-3 sm:grid-cols-3">
      {lastMonths.map((item, index) => { const previous = index > 0 ? Number(lastMonths[index - 1].amount) : null; const up = previous === null || Number(item.amount) >= previous; const Trend = up ? TrendingUp : TrendingDown; return <div key={item.month} className={`${card} flex items-center justify-between gap-3`}>
        <div><p className="text-xs text-muted-foreground">Recaudo {monthName.format(asDate(item.month))}</p><p className="text-xl font-semibold tracking-tight">{formatCop(item.amount)}</p></div>
        <span className={`flex size-9 items-center justify-center rounded-xl ${up ? "bg-primary/10 text-primary" : "bg-urgent/10 text-urgent"}`}><Trend size={18} aria-hidden="true" /></span>
      </div>; })}
    </section>

    <section className="mt-6 grid gap-4 lg:grid-cols-2">
      <div className={card}><h2 className="font-semibold">Recaudo mensual</h2><p className="text-xs text-muted-foreground">Pagos de los casos en gestión, desde su primer requerimiento.</p><div className="mt-4"><MonthlyChart monthly={report.monthly} /></div></div>
      <div className={card}><h2 className="font-semibold">Distribución por estado</h2><p className="text-xs text-muted-foreground">Apartamentos en gestión y en mora sin requerimiento.</p><div className="mt-4"><StateDonut parts={[...(["finalized", "agreement", "pre_legal"] as const).map((state) => ({ label: stateInfo[state].label, value: byState[state].length, color: stateInfo[state].color })), { label: "En mora sin requerimiento", value: report.unmanaged.count, color: unmanagedColor }]} /></div></div>
    </section>

    <section className={`${card} mt-6`}>
      <h2 className="font-semibold">Resumen ejecutivo</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {(["finalized", "agreement", "pre_legal"] as const).map((state) => <li key={state} className="flex gap-3 rounded-xl bg-slate-50 p-4"><span className="mt-1 size-3 shrink-0 rounded-full" style={{ backgroundColor: stateInfo[state].color }} /><div><p className="font-semibold">{stateInfo[state].label} · {byState[state].length}</p><p className="mt-1 text-sm text-slate-600">{stateInfo[state].summary}</p></div></li>)}
        <li className="flex gap-3 rounded-xl bg-slate-50 p-4"><FileWarning size={16} className="mt-0.5 shrink-0 text-urgent" aria-hidden="true" /><div><p className="font-semibold">En mora sin requerimiento · {report.unmanaged.count}</p><p className="mt-1 text-sm text-slate-600">Apartamentos que hoy deben {formatCop(report.unmanaged.amount)} y aún no tienen requerimiento de pago.</p></div></li>
      </ul>
      <p className="mt-4 text-xs text-muted-foreground">El conjunto tiene {report.units_total} apartamentos; {report.units_in_arrears} están hoy en mora por {formatCop(report.arrears_total)}.</p>
    </section>

    <section className={`${card} mt-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Detalle por caso ({shown.length})</h2>
        <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2 print:hidden">{[{ value: null, label: "Todos" }, ...(["finalized", "agreement", "pre_legal"] as const).map((value) => ({ value, label: stateInfo[value].label }))].map((option) => <Link key={option.label} href={option.value ? `?estado=${option.value}` : "?"} scroll={false} aria-current={filter === option.value ? "page" : undefined} className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filter === option.value ? "border-primary bg-primary text-white" : "bg-white hover:bg-secondary"}`}>{option.label}</Link>)}</nav>
      </div>
      {shown.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
        <thead><tr className="bg-primary text-xs text-white"><th className="rounded-l-lg px-3 py-2 font-medium">Apartamento</th><th className="px-3 py-2 font-medium">Propietario o residente</th><th className="px-3 py-2 font-medium">Primer requerimiento</th><th className="px-3 py-2 text-right font-medium">Cartera requerida</th><th className="px-3 py-2 text-right font-medium">Recaudo</th><th className="px-3 py-2 text-right font-medium">Saldo hoy</th><th className="rounded-r-lg px-3 py-2 font-medium">Estado</th></tr></thead>
        <tbody>{shown.map((item) => <tr key={item.unit_id} className="border-b last:border-0 break-inside-avoid">
          <td className="px-3 py-2.5 font-medium"><Link href={`/juridica/${propertyId}/${item.unit_id}`} className="hover:text-primary print:no-underline">{item.unit_label}</Link></td>
          <td className="px-3 py-2.5 text-slate-600">{item.owner_name ?? "—"}</td>
          <td className="px-3 py-2.5 text-slate-600">{formatLong(item.first_notice_on)}{item.notice_count > 1 ? ` · ${item.notice_count} envíos` : ""}</td>
          <td className="px-3 py-2.5 text-right">{formatCop(item.first_total)}</td>
          <td className="px-3 py-2.5 text-right font-medium text-primary">{formatCop(item.collected)}</td>
          <td className={`px-3 py-2.5 text-right ${item.outstanding > 0 ? "text-urgent" : ""}`}>{formatCop(item.outstanding)}</td>
          <td className="px-3 py-2.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${stateInfo[item.state].pill}`}>{stateInfo[item.state].label}</span></td>
        </tr>)}</tbody>
      </table></div> : <p className="mt-4 text-sm text-muted-foreground">{cases.length ? "No hay casos con este estado." : "Aún no hay casos: se crean al enviar el primer requerimiento de pago a un apartamento."}</p>}
    </section>

    <p className="mt-6 text-center text-xs text-muted-foreground">ResiQ · Gestión de recuperación de cartera · {report.property.name} · Actualizado el {generated}</p>
  </div>;
}
