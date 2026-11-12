import { requireLegalStaff } from "@/lib/auth/require-legal-staff";
import { buildReport, caseStateLabels, formatGenerated, formatMonth, parseMonth, parseRange, periodInfo, reportFileName, reportQuery, trendPoints, type ReportData } from "@/lib/legal/report";
import { COLOMBIA_TIME_ZONE, dateInputValue } from "@/lib/time-zone";
import { writeWorkbook } from "@/lib/xlsx/write-workbook";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Informe jurídico del mes en Excel (12/11/2026): hojas Resumen, Antigüedad, Torres, Morosos, Gestión y Evolución,
// con las mismas cifras de la página. Solo la abogada con acceso al conjunto (lo valida la base de datos).
export async function GET(request: Request, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  if (!uuidPattern.test(propertyId)) return new Response("No encontrado.", { status: 404 });
  const { supabase } = await requireLegalStaff();
  const search = new URL(request.url).searchParams;
  const today = dateInputValue(new Date(), COLOMBIA_TIME_ZONE);
  // Rango (?desde&hasta): de un día a otro o de un mes a otro; un mes completo se trata como ese mes.
  const parsed = parseRange({ desde: search.get("desde") ?? undefined, hasta: search.get("hasta") ?? undefined }, today);
  const range = parsed && "from" in parsed ? parsed : null;
  const month = parsed && "month" in parsed ? parsed.month : parseMonth(search.get("mes") ?? undefined, today);
  // Fase 2: el cierre del mes (o la versión pedida); con actual=1, los datos de hoy.
  const { version, live } = reportQuery({ version: search.get("version") ?? undefined, actual: search.get("actual") ?? undefined });
  const { data, error } = range
    ? await supabase.rpc("legal_report_period", { target_property_id: propertyId, period_from: range.from, period_to: range.to })
    : await supabase.rpc("legal_report_view", { target_property_id: propertyId, target_month: month, target_version: version, live });
  if (error || !data) return new Response("No se pudo generar el informe.", { status: error?.message.includes("not_authorized") ? 404 : 500 });
  const raw = data as ReportData;
  const report = buildReport(raw);
  const cut = raw.closure ? `Mes cerrado · versión ${raw.closure.version} · ${formatGenerated(raw.closure.closed_at, raw.timezone)}${raw.closure.reason ? ` · Motivo: ${raw.closure.reason}` : ""}`
    : raw.partial ? `Corte parcial al ${raw.as_of}` : `Mes completo sin cierre (calculado al ${raw.month_end})`;
  const percent = (value: number) => Math.round(value * 1000) / 10;

  const archive = writeWorkbook([
    { name: "Resumen", rows: [
      ["Informe jurídico de cartera", raw.property.name],
      ["Periodo", periodInfo(raw).title], ["Corte", cut], ["Generado", formatGenerated(raw.generated_at, raw.timezone)], ["Elaborado por", raw.prepared_by ?? "Abogada de cobros"],
      [],
      ["Indicador", "Valor"],
      ["Cartera vencida (COP)", report.arrears], ["Apartamentos en mora", report.debtors.length], ["Apartamentos del conjunto", report.current.units_total],
      ["% de apartamentos en mora", percent(report.debtorShare)], ["% de la cartera vencida sobre lo facturado", percent(report.billedShare)],
      ["Recaudo del mes (COP)", report.current.collected_month], ["Esperado del mes: lo que vencía (COP)", report.current.expected_month], ["% recaudado de lo esperado", percent(report.collectedShare)],
      ["Cartera vencida del mes anterior (COP)", report.previousArrears], ["Recaudo del mes anterior (COP)", report.previous.collected_month],
      ["Intereses de mora", "No aplican por ahora"],
    ] },
    { name: "Antigüedad", rows: [["Gravedad", "Rango", "Apartamentos", "Cartera vencida (COP)"], ...report.aging.map((item) => [item.label, item.range, item.count, item.amount])] },
    { name: "Torres", rows: [["Torre", "Apartamentos", "En mora", "% en mora", "Cartera vencida (COP)"], ...report.buildings.map((item) => [item.name, item.units, item.debtors, item.units ? percent(item.debtors / item.units) : 0, item.amount])] },
    { name: "Morosos", rows: [["Torre", "Apartamento", "Propietario o residente", "Capital vencido (COP)", "Total adeudado (COP)", "Días en mora", "Meses en mora", "Último pago", "Gravedad", "Estado del caso", "Primer requerimiento"],
      ...report.debtors.map((item) => [item.building, item.code, item.owner_name ?? "", item.overdue, item.total, item.days, item.months, item.last_payment_on ?? "", item.severity.label, caseStateLabels[item.state], item.first_notice_on ?? ""])] },
    { name: "Gestión", rows: [["Requerimientos de pago enviados en el mes"], ["Fecha", "Apartamento", "Destinatario", "Total requerido (COP)", "Estado del correo"],
      ...report.current.notices_month.map((item) => [formatGenerated(item.sent_at, raw.timezone), item.unit, item.recipient, Number(item.total), item.delivery]),
      [], ["Pagos registrados en el mes", report.current.payments_month], ["Acuerdos de pago creados en el mes", report.current.agreements_month], ["Apartamentos que se pusieron al día", report.caughtUp]] },
    { name: "Evolución", rows: [["Mes", "Cartera vencida (COP)", "Apartamentos en mora", "Recaudo (COP)", "Fuente"], ...trendPoints(raw).map((item) => [formatMonth(item.month), item.arrears, item.debtors, item.collected, item.closed ? "Cierre" : "Calculado"])] },
  ]);
  return new Response(Buffer.from(archive), { headers: {
    "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "content-disposition": `attachment; filename="${reportFileName(raw.property.name, raw.month, raw.closure?.version, range)}.xlsx"`,
    "cache-control": "no-store",
  } });
}
