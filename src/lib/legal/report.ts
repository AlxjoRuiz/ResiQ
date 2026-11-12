// Informe jurídico por mes, fase 1 (12/11/2026). Convierte lo que devuelve legal_report_month en las cifras y
// secciones del informe. Se usa en la página y en el Excel, para que los dos digan exactamente lo mismo.
// Sin intereses de mora: no aplican por ahora (decisión de Alejandro, 12/11/2026).

export type ReportUnit = {
  unit_id: string; building: string; code: string; owner_name: string | null; overdue: number; total: number; oldest_due_on: string | null;
  days: number; last_payment_on: string | null; first_notice_on: string | null; last_notice_on: string | null; notice_count: number; agreement_active: boolean;
};
type State = {
  as_of: string; units_total: number; billed_total: number; collected_month: number; payments_month: number; expected_month: number; agreements_month: number;
  buildings: { name: string; units: number }[]; units: ReportUnit[];
  notices_month: { sent_at: string; unit: string; recipient: string; total: number; delivery: string }[];
};
export type ReportData = {
  property: { name: string; city: string | null; address: string | null }; month: string; month_end: string; as_of: string; today: string; partial: boolean;
  generated_at: string; timezone: string; started_on: string | null; first_month: string | null; prepared_by: string | null;
  note: { body: string; updated_at: string } | null; current: State; previous: State;
  // Fase 2 (12/11/2026): cierre que se está mostrando (null = cálculo con fechas), tendencia de 6 meses e historial.
  range?: { from: string; to: string } | null;
  closure?: { version: number; closed_at: string; automatic: boolean; reason: string | null; closed_by: string | null } | null;
  trend?: { month: string; arrears: number; debtors: number; collected: number; closed: boolean }[];
  month_closed?: boolean; can_close?: boolean;
  history?: { month: string; version: number; closed_at: string; automatic: boolean; reason: string | null; closed_by: string | null }[];
};

// Estado del caso de cada apartamento en mora (fase 1: deducido de los datos; las etapas completas llegan en la fase 2).
export type CaseState = "agreement" | "notice" | "none";
export const caseStateLabels: Record<CaseState, string> = { agreement: "Acuerdo de pago", notice: "Requerimiento enviado", none: "Sin gestión" };

// Gravedad por antigüedad de la deuda más vieja sin pagar. Se muestra con texto, no solo con color.
export const severities = [
  { key: "low", label: "Leve", range: "1 a 30 días", min: 1, max: 30, tone: "bg-sky-100 text-sky-900" },
  { key: "medium", label: "Moderada", range: "31 a 60 días", min: 31, max: 60, tone: "bg-amber-100 text-amber-900" },
  { key: "high", label: "Alta", range: "61 a 90 días", min: 61, max: 90, tone: "bg-orange-100 text-orange-900" },
  { key: "veryHigh", label: "Muy alta", range: "91 a 180 días", min: 91, max: 180, tone: "bg-urgent/10 text-urgent" },
  { key: "critical", label: "Crítica", range: "Más de 180 días", min: 181, max: Infinity, tone: "bg-urgent text-white" },
] as const;
export type Severity = (typeof severities)[number];
export const severityFor = (days: number): Severity => severities.find((item) => days >= item.min && days <= item.max) ?? severities[0];

const toNumber = (value: unknown) => Number(value ?? 0) || 0;
const caseState = (unit: ReportUnit): CaseState => unit.agreement_active ? "agreement" : unit.notice_count > 0 ? "notice" : "none";

export type Debtor = ReportUnit & { state: CaseState; severity: Severity; months: number };

// Todas las cifras del informe de un mes.
export function buildReport(raw: ReportData) {
  const normalize = (state: State) => ({
    ...state,
    units: state.units.map((unit) => ({ ...unit, overdue: toNumber(unit.overdue), total: toNumber(unit.total), days: toNumber(unit.days), notice_count: toNumber(unit.notice_count) })),
    billed_total: toNumber(state.billed_total), collected_month: toNumber(state.collected_month), expected_month: toNumber(state.expected_month),
    units_total: toNumber(state.units_total), payments_month: toNumber(state.payments_month), agreements_month: toNumber(state.agreements_month),
  });
  const current = normalize(raw.current), previous = normalize(raw.previous);
  const debtors: Debtor[] = current.units.filter((unit) => unit.overdue > 0).map((unit) => ({ ...unit, state: caseState(unit), severity: severityFor(unit.days), months: Math.floor(unit.days / 30) }));
  const previousDebtors = previous.units.filter((unit) => unit.overdue > 0);
  const arrears = debtors.reduce((sum, unit) => sum + unit.overdue, 0);
  const previousArrears = previousDebtors.reduce((sum, unit) => sum + unit.overdue, 0);
  const owed = debtors.reduce((sum, unit) => sum + unit.total, 0);
  const finalized = current.units.filter((unit) => unit.notice_count > 0 && unit.total <= 0);
  // Se pusieron al día en el mes: estaban en mora al cierre del mes anterior y ahora no.
  const debtorIds = new Set(debtors.map((unit) => unit.unit_id));
  const caughtUp = previousDebtors.filter((unit) => !debtorIds.has(unit.unit_id)).length;
  const aging = severities.map((severity) => { const items = debtors.filter((unit) => unit.severity.key === severity.key); return { ...severity, count: items.length, amount: items.reduce((sum, unit) => sum + unit.overdue, 0) }; });
  const buildings = current.buildings.map((building) => {
    const items = debtors.filter((unit) => unit.building === building.name);
    return { name: building.name, units: toNumber(building.units), debtors: items.length, amount: items.reduce((sum, unit) => sum + unit.overdue, 0) };
  // Torres en orden natural (13/11/2026): Torre 1, 2, 3… 10, no 1, 10, 11. También en el Excel y en los filtros.
  }).sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }));
  const byState = (["agreement", "notice", "none"] as const).map((state) => { const items = debtors.filter((unit) => unit.state === state); return { state, label: caseStateLabels[state], count: items.length, amount: items.reduce((sum, unit) => sum + unit.overdue, 0) }; });
  const critical = [...debtors].sort((a, b) => b.days - a.days || b.overdue - a.overdue).slice(0, 5);
  return {
    raw, current, previous, debtors, arrears, previousArrears, owed, finalized, caughtUp, aging, buildings, byState, critical,
    debtorShare: current.units_total ? debtors.length / current.units_total : 0,
    billedShare: current.billed_total ? arrears / current.billed_total : 0,
    collectedShare: current.expected_month ? current.collected_month / current.expected_month : 0,
  };
}
export type Report = ReturnType<typeof buildReport>;

// Formatos en español de Colombia.
export const formatCop = (value: number) => Number(value).toLocaleString("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 });
export const formatPercent = (value: number) => `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(value * 100)} %`;
const longDate = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const shortDate = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const monthTitle = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" });
const asDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`);
export const formatLong = (value: string | null) => value ? longDate.format(asDate(value)) : "—";
export const formatShort = (value: string | null) => value ? shortDate.format(asDate(value)) : "—";
export const formatMonth = (value: string) => { const text = monthTitle.format(asDate(value)); return text.charAt(0).toUpperCase() + text.slice(1); };
export const formatGenerated = (value: string, timeZone: string) => new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone }).format(new Date(value));
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

// Periodo del informe (12/11/2026): un mes, o un rango de fechas (de un día a otro o de un mes a otro).
// title = «Octubre 2026» o «1 de octubre de 2026 al 15 de noviembre de 2026»; inText = para usar dentro de frases.
export function periodInfo(raw: ReportData) {
  if (!raw.range) { const title = formatMonth(raw.month); return { isRange: false, title, inText: `en ${title.toLowerCase()}`, previous: "mes anterior", unit: "el mes" }; }
  const { from, to } = raw.range;
  const fullMonths = from.slice(8, 10) === "01" && new Date(Date.parse(`${to}T12:00:00Z`) + 86400000).getUTCDate() === 1;
  const title = fullMonths ? (from.slice(0, 7) === to.slice(0, 7) ? formatMonth(from) : `${formatMonth(from)} a ${formatMonth(to).toLowerCase()}`) : `${formatLong(from)} al ${formatLong(to)}`;
  return { isRange: true, title, inText: `entre el ${formatLong(from)} y el ${formatLong(to)}`, previous: "periodo anterior", unit: "el periodo" };
}

// Variación frente al mes (o periodo) anterior, en texto: «sube 12 %», «baja 5 %», «igual».
export function change(now: number, before: number, previous = "mes anterior") {
  if (!before && !now) return { text: "Sin cambio", direction: 0 };
  if (!before) return { text: `Nuevo frente al ${previous}`, direction: 1 };
  const delta = (now - before) / before;
  if (Math.abs(delta) < 0.0005) return { text: `Igual que el ${previous}`, direction: 0 };
  return { text: `${delta > 0 ? "Sube" : "Baja"} ${formatPercent(Math.abs(delta))} frente al ${previous}`, direction: delta > 0 ? 1 : -1 };
}

// Texto del resumen ejecutivo, redactado con las cifras del periodo.
export function summaryText(report: Report) {
  const { raw, current, debtors, arrears, previousArrears } = report;
  const period = periodInfo(raw);
  const cut = raw.partial ? `con corte parcial al ${formatLong(raw.as_of)}` : `al ${formatLong(raw.month_end)}`;
  const inText = period.inText.charAt(0).toUpperCase() + period.inText.slice(1);
  if (!debtors.length) return [`${raw.property.name} no tiene apartamentos en mora ${cut}. ${inText} se recaudaron ${formatCop(current.collected_month)}.`];
  const paragraphs = [
    `${raw.property.name} tiene ${plural(debtors.length, "apartamento", "apartamentos")} en mora ${cut}, por un total vencido de ${formatCop(arrears)}. Esto equivale al ${formatPercent(report.debtorShare)} de los ${current.units_total} apartamentos del conjunto y al ${formatPercent(report.billedShare)} de lo facturado.`,
    `${inText} se recaudaron ${formatCop(current.collected_month)}${current.expected_month ? ` de ${formatCop(current.expected_month)} que vencían en ${period.unit} (${formatPercent(report.collectedShare)})` : ""}. La cartera vencida ${previousArrears ? change(arrears, previousArrears, period.previous).text.toLowerCase() : `no tiene comparación con el ${period.previous}`}.`,
  ];
  const critical = debtors.filter((unit) => unit.severity.key === "critical" || unit.severity.key === "veryHigh");
  if (critical.length) paragraphs.push(`Requieren atención inmediata ${plural(critical.length, "apartamento", "apartamentos")} con más de 90 días de mora, que suman ${formatCop(critical.reduce((sum, unit) => sum + unit.overdue, 0))}.`);
  return paragraphs;
}

// Mes (YYYY-MM) a partir de la dirección; si no viene o no es válido, el mes en curso (todayIso = hoy en Bogotá, YYYY-MM-DD).
export function parseMonth(value: string | undefined, todayIso: string) {
  if (value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value <= todayIso.slice(0, 7)) return `${value}-01`;
  return `${todayIso.slice(0, 7)}-01`;
}

// Nombre de archivo claro: Informe-Juridico_ConjuntoBonavento_2026-10 (mes), …_2026-10-01_a_2026-11-15 (rango) y _v2
// si es una corrección del cierre.
export function reportFileName(propertyName: string, month: string, version?: number | null, range?: { from: string; to: string } | null) {
  const name = propertyName.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, " ").trim().split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("");
  return `Informe-Juridico_${name || "Conjunto"}_${range ? `${range.from}_a_${range.to}` : month.slice(0, 7)}${version && version > 1 ? `_v${version}` : ""}`;
}

// Rango de fechas pedido en la dirección (?desde=AAAA-MM-DD&hasta=AAAA-MM-DD). Si es exactamente un mes completo
// se trata como ese mes (así conserva su cierre). null = no hay rango válido.
const isDay = (value?: string) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
export function parseRange(params: { desde?: string; hasta?: string }, todayIso: string): { month: string } | { from: string; to: string } | null {
  if (!isDay(params.desde) || !isDay(params.hasta)) return null;
  const [from, to] = params.desde! <= params.hasta! ? [params.desde!, params.hasta!] : [params.hasta!, params.desde!];
  if (from > todayIso) return null;
  const nextDay = new Date(Date.parse(`${to}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
  if (from.slice(8) === "01" && from.slice(0, 7) === to.slice(0, 7) && nextDay.slice(8) === "01") return { month: from };
  return { from, to };
}

// Parámetros del informe en la dirección: ?mes=2026-10&version=2&actual=1 (versión de cierre o datos actuales).
export function reportQuery(searchParams: { mes?: string; version?: string; actual?: string }) {
  const version = Number(searchParams.version);
  return { version: Number.isInteger(version) && version > 0 && version < 1000 ? version : null, live: searchParams.actual === "1" };
}

// Tendencia con números (lo que llega de la base de datos puede venir como texto).
export const trendPoints = (raw: ReportData) => (raw.trend ?? []).map((item) => ({ ...item, arrears: toNumber(item.arrears), debtors: toNumber(item.debtors), collected: toNumber(item.collected) }));
