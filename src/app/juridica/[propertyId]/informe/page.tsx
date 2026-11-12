import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CalendarRange, CircleCheck, FileSpreadsheet, Gavel, Scale, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { requireLegalStaff } from "@/lib/auth/require-legal-staff";
import { buildReport, caseStateLabels, change, formatCop, formatGenerated, formatLong, formatMonth, formatPercent, formatShort, parseMonth, parseRange, periodInfo, reportFileName, reportQuery, summaryText, trendPoints, type ReportData } from "@/lib/legal/report";
import { CloseMonth } from "./close-month";
import { COLOMBIA_TIME_ZONE, dateInputValue } from "@/lib/time-zone";
import { uuidPattern } from "../../legal-data";
import { DebtorsTable } from "./debtors-table";
import { PeriodPicker } from "./period-picker";
import { PrintButton } from "./print-button";

// Informe jurídico por mes, fase 1 (12/11/2026, pedido de Alejandro). De lo general a lo detallado:
// datos del informe, resumen ejecutivo, antigüedad, torres, morosos (con filtros), estado de los casos, gestión del
// mes y evolución. El mes elegido se calcula con las fechas de cada movimiento (el mes en curso es
// un corte parcial a hoy). Descarga en PDF (impresión del navegador, con encabezado y páginas) y en Excel.
// Fase 2 (12/11/2026): si el mes tiene cierre se muestra la foto guardada (o la versión elegida); con ?actual=1, los
// datos de hoy. Además: botón para cerrar el mes o corregirlo, evolución de 6 meses e historial de cierres.
// Rango (12/11/2026): con ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD el informe es de un día a otro o de un mes a otro.
type Props = { params: Promise<{ propertyId: string }>; searchParams: Promise<{ mes?: string; version?: string; actual?: string; desde?: string; hasta?: string }> };

// Una sola consulta por solicitud aunque la usen el título del documento y la página.
const loadReport = cache(async (propertyId: string, month: string, version: number | null, live: boolean) => {
  const { supabase } = await requireLegalStaff();
  const { data, error } = await supabase.rpc("legal_report_view", { target_property_id: propertyId, target_month: month, target_version: version, live });
  return { data: data as ReportData | null, error: error?.message ?? null };
});
const loadPeriod = cache(async (propertyId: string, from: string, to: string) => {
  const { supabase } = await requireLegalStaff();
  const { data, error } = await supabase.rpc("legal_report_period", { target_property_id: propertyId, period_from: from, period_to: to });
  return { data: data as ReportData | null, error: error?.message ?? null };
});
const lastDayOf = (month: string) => { const date = new Date(`${month.slice(0, 7)}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + 1, 0); return date.toISOString().slice(0, 10); };

async function resolve({ params, searchParams }: Props) {
  const { propertyId } = await params;
  if (!uuidPattern.test(propertyId)) notFound();
  const today = dateInputValue(new Date(), COLOMBIA_TIME_ZONE);
  const query = await searchParams;
  const parsed = parseRange(query, today);
  const range = parsed && "from" in parsed ? parsed : null;
  const month = parsed && "month" in parsed ? parsed.month : parseMonth(query.mes, today);
  const { version, live } = reportQuery(query);
  if (range) return { propertyId, month: range.from, range, today, version: null, live: false, ...(await loadPeriod(propertyId, range.from, range.to)) };
  return { propertyId, month, range: null, today, version, live, ...(await loadReport(propertyId, month, version, live)) };
}

// El título del documento es el nombre con que el navegador guarda el PDF.
export async function generateMetadata(props: Props): Promise<Metadata> {
  const { data, month, range } = await resolve(props);
  return { title: data ? reportFileName(data.property.name, month, data.closure?.version, range) : "Informe jurídico" };
}

const card = "rounded-2xl border border-slate-200 bg-white p-5 break-inside-avoid";
const sectionTitle = "flex items-center gap-2 text-lg font-semibold tracking-tight";
// Flecha de tendencia: azul si el cambio es bueno (menos mora, más recaudo), roja si es malo.
function Trend({ direction, good }: { direction: number; good: "up" | "down" }) {
  if (direction === 0) return null;
  const Icon = direction > 0 ? TrendingUp : TrendingDown;
  return <Icon size={15} className={(direction > 0) === (good === "up") ? "text-primary" : "text-urgent"} aria-hidden="true" />;
}
const number = (index: number) => <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">{index}</span>;

export default async function LegalReportPage(props: Props) {
  const { propertyId, month, range, today, live, data, error } = await resolve(props);
  if (error?.includes("not_authorized")) notFound();
  const monthParam = month.slice(0, 7);
  const excelHref = range ? `/api/legal/report/${propertyId}?desde=${range.from}&hasta=${range.to}`
    : `/api/legal/report/${propertyId}?mes=${monthParam}${data?.closure ? `&version=${data.closure.version}` : live ? "&actual=1" : ""}`;
  // Selector: «Mes a mes» si el rango va de inicio a fin de mes, «Día a día» si no, «Un mes» sin rango.
  const pickerFrom = range?.from ?? month;
  const pickerTo = range?.to ?? lastDayOf(month);
  const pickerMode = !range ? "month" as const : range.from.endsWith("-01") && range.to === lastDayOf(range.to) ? "months" as const : "days" as const;
  const pickerLabel = data ? periodInfo({ ...data, range: range ?? data.range ?? null }).title : range ? `${formatShort(range.from)} al ${formatShort(range.to)}` : formatMonth(month);
  const controls = (raw: ReportData | null) => <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
    <Link href={`/juridica/${propertyId}`} className="text-sm text-muted-foreground hover:text-foreground">← Cartera del conjunto</Link>
    <div className="flex flex-wrap items-end gap-2">
      <PeriodPicker key={`${pickerFrom}_${pickerTo}`} label={pickerLabel} today={today} firstMonth={raw?.first_month ?? null} initialMode={pickerMode} from={pickerFrom} to={pickerTo} />
      {raw && <><PrintButton /><a href={excelHref} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium hover:bg-secondary"><FileSpreadsheet size={16} aria-hidden="true" />Descargar Excel</a></>}
    </div>
  </div>;
  if (!data) return <div className="mx-auto w-full max-w-6xl">{controls(null)}<p role="status" className="mt-8 rounded-2xl border bg-white p-6 text-sm text-slate-600">No pudimos generar el informe de {pickerLabel}. Revisa el periodo elegido o inténtalo de nuevo en unos minutos.</p></div>;

  const raw = data;
  const report = buildReport(raw);
  const { current, debtors } = report;
  const period = periodInfo(raw);
  const arrearsChange = change(report.arrears, report.previousArrears, period.previous);
  const collectedChange = change(current.collected_month, report.previous.collected_month, period.previous);
  const debtorsChange = change(debtors.length, report.previous.units.filter((unit) => Number(unit.overdue) > 0).length, period.previous);
  const cut = raw.partial ? `Corte parcial al ${formatLong(raw.as_of)}` : `${period.isRange ? "Fin del periodo" : "Cierre del mes"}: ${formatLong(raw.month_end)}`;
  const generated = formatGenerated(raw.generated_at, raw.timezone);
  const maxAging = Math.max(...report.aging.map((item) => item.amount), 1);
  const maxBuilding = Math.max(...report.buildings.map((item) => item.amount), 1);
  const beforeStart = raw.started_on && raw.month_end < raw.started_on;
  const closure = raw.closure ?? null;
  const trend = trendPoints(raw);
  const maxTrend = Math.max(...trend.map((item) => Math.max(item.arrears, item.collected)), 1);
  const monthLabel = formatMonth(raw.month).toLowerCase();

  return <div className="mx-auto w-full max-w-6xl print:max-w-none">
    {/* Página impresa: márgenes, encabezado con el conjunto y el periodo, y números de página. */}
    <style>{`@page { size: A4; margin: 18mm 14mm 16mm; @top-left { content: ${JSON.stringify(`${raw.property.name} · Informe jurídico · ${period.title}`)}; font-size: 9px; color: #475569; } @bottom-left { content: "Documento confidencial · uso exclusivo de la administración"; font-size: 8px; color: #64748b; } @bottom-right { content: "Página " counter(page) " de " counter(pages); font-size: 9px; color: #475569; } } @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }`}</style>
    {controls(raw)}

    {/* 11 · Datos del informe (al inicio, como membrete). */}
    <header className="mt-5 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/8 to-white p-6 break-inside-avoid">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold tracking-wider text-primary uppercase">Informe de gestión de cartera · Cobro jurídico</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{raw.property.name}</h1><p className="mt-1 text-sm text-slate-600">{[raw.property.address, raw.property.city].filter(Boolean).join(" · ")}</p></div>
        {closure ? <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">Mes cerrado</span>
          : raw.partial ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Corte parcial · {period.isRange ? "periodo en curso" : "mes en curso"}</span>
          : period.isRange ? <span className="rounded-full bg-primary/12 px-3 py-1 text-xs font-semibold text-primary">Periodo completo</span>
          : <span className="rounded-full bg-primary/12 px-3 py-1 text-xs font-semibold text-primary">{raw.month_closed ? "Datos actuales · no es el cierre" : "Mes completo · sin cierre todavía"}</span>}
      </div>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-xs text-slate-500">Periodo</dt><dd className="font-medium">{period.title}</dd></div>
        <div><dt className="text-xs text-slate-500">Corte</dt><dd className="font-medium">{cut}</dd></div>
        <div><dt className="text-xs text-slate-500">Generado</dt><dd className="font-medium">{generated}</dd></div>
        <div><dt className="text-xs text-slate-500">Elaborado por</dt><dd className="font-medium">{raw.prepared_by ?? "Abogada de cobros"}</dd></div>
      </dl>
      {beforeStart && <p className="mt-4 rounded-xl bg-white/80 p-3 text-xs text-slate-600">Este periodo es anterior al inicio de la gestión jurídica ({formatLong(raw.started_on)}): muestra la cartera del conjunto, no gestiones de cobro.</p>}
      {/* Cierre: quién y cuándo. */}
      {closure && <p className="mt-4 rounded-xl bg-white/80 p-3 text-xs text-slate-600">Cerrado el {formatGenerated(closure.closed_at, raw.timezone)} · {closure.automatic ? "cierre automático" : `por ${closure.closed_by ?? "la abogada"}`}{closure.reason ? ` · Motivo de la corrección: ${closure.reason}` : ""}. Este informe guarda los datos tal como estaban y no cambia.</p>}
      {/* Solo «Cerrar mes» para meses terminados sin cierre: sin correcciones, versiones ni «datos de hoy» (pedido de Alejandro, 12/11/2026). */}
      {raw.can_close && !raw.month_closed && <div className="mt-4 flex flex-wrap items-center gap-2 text-xs print:hidden">
        <CloseMonth propertyId={propertyId} month={raw.month} closed={false} monthLabel={monthLabel} />
      </div>}
    </header>

    {/* 1 · Resumen ejecutivo. */}
    <section className="mt-6 break-inside-avoid" aria-labelledby="resumen">
      <h2 id="resumen" className={sectionTitle}>{number(1)}Resumen ejecutivo</h2>
      <div className="mt-3 grid gap-2 text-[15px] leading-7 text-slate-700">{summaryText(report).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={card}><span className="flex size-9 items-center justify-center rounded-xl bg-urgent/10 text-urgent"><Wallet size={18} aria-hidden="true" /></span><p className="mt-3 text-xs text-slate-500">Cartera vencida</p><p className="text-2xl font-semibold tracking-tight">{formatCop(report.arrears)}</p><p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Trend direction={arrearsChange.direction} good="down" />{arrearsChange.text}</p></div>
        <div className={card}><span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Scale size={18} aria-hidden="true" /></span><p className="mt-3 text-xs text-slate-500">Apartamentos en mora</p><p className="text-2xl font-semibold tracking-tight">{debtors.length} <span className="text-sm font-normal text-slate-500">de {current.units_total}</span></p><p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Trend direction={debtorsChange.direction} good="down" />{formatPercent(report.debtorShare)} del conjunto · {debtorsChange.text.toLowerCase()}</p></div>
        <div className={card}><span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><AlertTriangle size={18} aria-hidden="true" /></span><p className="mt-3 text-xs text-slate-500">Morosidad sobre lo facturado</p><p className="text-2xl font-semibold tracking-tight">{formatPercent(report.billedShare)}</p><p className="mt-1 text-xs text-slate-500">Facturado a la fecha: {formatCop(current.billed_total)}</p></div>
        <div className={card}><span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><CircleCheck size={18} aria-hidden="true" /></span><p className="mt-3 text-xs text-slate-500">Recaudo {period.isRange ? "del periodo" : "del mes"}</p><p className="text-2xl font-semibold tracking-tight">{formatCop(current.collected_month)}</p><p className="mt-1 text-xs text-slate-500">{current.expected_month ? `${formatPercent(report.collectedShare)} de ${formatCop(current.expected_month)} esperado` : `Sin vencimientos en ${period.unit}`}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><Trend direction={collectedChange.direction} good="up" />{collectedChange.text}</p></div>
      </div>
      {report.critical.length > 0 && <div className={`${card} mt-3`}><p className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle size={16} className="text-urgent" aria-hidden="true" />Casos que requieren atención inmediata</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{report.critical.map((item) => <li key={item.unit_id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm"><span><span className="font-medium">{item.building} · {item.code}</span><span className="block text-xs text-slate-500">{item.severity.label} · {item.days} días · {caseStateLabels[item.state]}</span></span><span className="font-semibold text-urgent">{formatCop(item.overdue)}</span></li>)}</ul>
      </div>}
    </section>

    {/* 2 · Cartera por antigüedad. */}
    <section className={`${card} mt-6`} aria-labelledby="antiguedad">
      <h2 id="antiguedad" className={sectionTitle}>{number(2)}Cartera por antigüedad</h2>
      <p className="mt-1 text-xs text-slate-500">Según la deuda más antigua sin pagar de cada apartamento.</p>
      <ul className="mt-4 grid gap-3">{report.aging.map((item) => <li key={item.key} className="grid items-center gap-2 text-sm sm:grid-cols-[180px_1fr_200px]">
        <span><span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${item.tone}`}>{item.label}</span> <span className="text-xs text-slate-500">{item.range}</span></span>
        <span className="h-3 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-primary" style={{ width: `${(item.amount / maxAging) * 100}%` }} /></span>
        <span className="text-right"><span className="font-semibold">{formatCop(item.amount)}</span> <span className="text-xs text-slate-500">· {item.count} {item.count === 1 ? "apto." : "aptos."}</span></span>
      </li>)}</ul>
    </section>

    {/* 3 · Cartera por torre. */}
    <section className={`${card} mt-6`} aria-labelledby="torres">
      <h2 id="torres" className={sectionTitle}>{number(3)}Cartera por torre</h2>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="bg-primary text-xs text-white"><th className="rounded-l-lg px-3 py-2 font-medium">Torre</th><th className="px-3 py-2 text-center font-medium">Apartamentos</th><th className="px-3 py-2 text-center font-medium">En mora</th><th className="px-3 py-2 text-center font-medium">% en mora</th><th className="px-3 py-2 font-medium">Cartera vencida</th><th className="rounded-r-lg px-3 py-2 text-right font-medium">Valor</th></tr></thead>
        <tbody>{report.buildings.map((item) => <tr key={item.name} className="border-b border-slate-100 last:border-0"><td className="px-3 py-2.5 font-medium">{item.name}</td><td className="px-3 py-2.5 text-center">{item.units}</td><td className="px-3 py-2.5 text-center">{item.debtors}</td><td className="px-3 py-2.5 text-center">{item.units ? formatPercent(item.debtors / item.units) : "—"}</td><td className="px-3 py-2.5"><span className="block h-2.5 w-full min-w-24 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-primary" style={{ width: `${(item.amount / maxBuilding) * 100}%` }} /></span></td><td className="px-3 py-2.5 text-right font-medium">{formatCop(item.amount)}</td></tr>)}</tbody></table></div>
    </section>

    {/* 4 · Detalle de apartamentos en mora. */}
    <section className={`${card} mt-6 print:break-inside-auto`} aria-labelledby="morosos">
      <h2 id="morosos" className={sectionTitle}>{number(4)}Apartamentos en mora ({debtors.length})</h2>
      <p className="mt-1 text-xs text-slate-500">Capital vencido: lo vencido sin pagar. Total adeudado: incluye lo que aún no vence. Sin intereses de mora (no aplican por ahora). El propietario o residente es el registrado hoy en el censo.</p>
      {debtors.length ? <DebtorsTable debtors={debtors} buildings={report.buildings.map((item) => item.name)} propertyId={propertyId} /> : <p className="mt-4 text-sm text-slate-500">No hay apartamentos en mora en este periodo.</p>}
    </section>

    {/* 5 · Estado de los casos. */}
    <section className={`${card} mt-6`} aria-labelledby="casos">
      <h2 id="casos" className={sectionTitle}>{number(5)}Estado de la gestión por caso</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {report.byState.map((item) => <div key={item.state} className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{item.label}</p><p className="text-2xl font-semibold">{item.count}</p><p className="text-xs text-slate-500">{formatCop(item.amount)} vencidos</p></div>)}
        <div className="rounded-xl bg-primary/8 p-4"><p className="text-xs text-primary">Finalizados (ya pagaron)</p><p className="text-2xl font-semibold text-primary">{report.finalized.length}</p><p className="text-xs text-slate-500">Con requerimiento y hoy sin deuda</p></div>
      </div>
      <p className="mt-3 text-xs text-slate-500">En esta versión el estado se deduce de los datos: «Requerimiento enviado» si la abogada le envió uno, «Acuerdo de pago» si tiene uno vigente. Las etapas completas (contacto, cobro prejurídico, proceso jurídico, cierre) llegan en la siguiente fase.</p>
    </section>

    {/* 6 · Gestión realizada en el periodo. */}
    <section className={`${card} mt-6`} aria-labelledby="gestion">
      <h2 id="gestion" className={sectionTitle}>{number(6)}Gestión realizada {period.isRange ? "en el periodo" : `en ${period.title.toLowerCase()}`}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        {[{ icon: Gavel, label: "Requerimientos enviados", value: current.notices_month.length }, { icon: Wallet, label: "Pagos registrados", value: current.payments_month }, { icon: CalendarRange, label: "Acuerdos de pago creados", value: current.agreements_month }, { icon: CircleCheck, label: "Se pusieron al día", value: report.caughtUp }].map(({ icon: Icon, label, value }) => <div key={label} className="flex items-center gap-3 rounded-xl bg-slate-50 p-4"><Icon size={18} className="text-primary" aria-hidden="true" /><div><p className="text-xl font-semibold">{value}</p><p className="text-xs text-slate-500">{label}</p></div></div>)}
      </div>
      {current.notices_month.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr className="bg-primary text-xs text-white"><th className="rounded-l-lg px-3 py-2 font-medium">Fecha</th><th className="px-3 py-2 font-medium">Apartamento</th><th className="px-3 py-2 font-medium">Destinatario</th><th className="px-3 py-2 text-right font-medium">Valor requerido</th><th className="rounded-r-lg px-3 py-2 font-medium">Correo</th></tr></thead>
        <tbody>{current.notices_month.map((item, index) => <tr key={index} className="border-b border-slate-100 last:border-0"><td className="px-3 py-2.5">{formatShort(item.sent_at.slice(0, 10))}</td><td className="px-3 py-2.5 font-medium">{item.unit}</td><td className="px-3 py-2.5 text-slate-600">{item.recipient}</td><td className="px-3 py-2.5 text-right">{formatCop(Number(item.total))}</td><td className="px-3 py-2.5 text-xs">{{ held: "Retenido (modo de prueba)", queued: "En cola", processing: "Enviando", accepted: "Enviado", failed: "No se pudo enviar", cancelled: "Cancelado" }[item.delivery] ?? item.delivery}</td></tr>)}</tbody></table></div>
        : <p className="mt-4 text-sm text-slate-500">No se enviaron requerimientos de pago en este periodo.</p>}
    </section>

    {/* 9 · Evolución en el tiempo (fase 2): 6 meses hasta el elegido, del cierre si existe o calculado. */}
    {trend.length > 0 && <section className={`${card} mt-6`} aria-labelledby="evolucion">
      <h2 id="evolucion" className={sectionTitle}>{number(7)}Evolución de los últimos 6 meses</h2>
      <p className="mt-1 flex flex-wrap items-center gap-4 text-xs text-slate-500"><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-urgent" />Cartera vencida</span><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" />Recaudo del mes</span><span>Los meses sin cierre salen calculados con fechas.</span></p>
      <div className="mt-4 grid grid-cols-6 items-end gap-2 sm:gap-4" style={{ height: 180 }} aria-hidden="true">
        {trend.map((item) => <div key={item.month} className="flex h-full items-end justify-center gap-1">
          <span className="w-1/3 max-w-7 rounded-t-md bg-urgent" style={{ height: `${Math.max((item.arrears / maxTrend) * 100, item.arrears ? 2 : 0)}%` }} title={`Cartera vencida: ${formatCop(item.arrears)}`} />
          <span className="w-1/3 max-w-7 rounded-t-md bg-primary" style={{ height: `${Math.max((item.collected / maxTrend) * 100, item.collected ? 2 : 0)}%` }} title={`Recaudo: ${formatCop(item.collected)}`} />
        </div>)}
      </div>
      <div className="mt-2 grid grid-cols-6 gap-2 text-center text-[11px] text-slate-500 sm:gap-4" aria-hidden="true">{trend.map((item) => <span key={item.month}>{formatMonth(item.month).slice(0, 3)} {item.month.slice(2, 4)}</span>)}</div>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="bg-primary text-xs text-white"><th className="rounded-l-lg px-3 py-2 font-medium">Mes</th><th className="px-3 py-2 text-right font-medium">Cartera vencida</th><th className="px-3 py-2 text-center font-medium">Apartamentos en mora</th><th className="px-3 py-2 text-right font-medium">Recaudo</th><th className="rounded-r-lg px-3 py-2 font-medium">Fuente</th></tr></thead>
        <tbody>{trend.map((item, index) => { const before = trend[index - 1]; const delta = before ? change(item.arrears, before.arrears) : null; return <tr key={item.month} className={`border-b border-slate-100 last:border-0 ${item.month === raw.month ? "bg-primary/5 font-medium" : ""}`}>
          <td className="px-3 py-2.5">{formatMonth(item.month)}</td><td className="px-3 py-2.5 text-right">{formatCop(item.arrears)}{delta && delta.direction !== 0 && <span className={`ml-2 text-xs ${delta.direction > 0 ? "text-urgent" : "text-primary"}`}>{delta.direction > 0 ? "▲" : "▼"}</span>}</td>
          <td className="px-3 py-2.5 text-center">{item.debtors}</td><td className="px-3 py-2.5 text-right">{formatCop(item.collected)}</td><td className="px-3 py-2.5 text-xs text-slate-600">{item.closed ? "Cierre" : "Calculado"}</td>
        </tr>; })}</tbody></table></div>
    </section>}


    <p className="mt-6 text-center text-xs text-slate-500">Documento confidencial con datos personales de residentes (Ley 1581 de 2012). Uso exclusivo de la administración de {raw.property.name}. · ResiQ · Generado el {generated}</p>
  </div>;
}
