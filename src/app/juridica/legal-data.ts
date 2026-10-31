import "server-only";

// Tipos y textos del módulo jurídico (31/10/2026), compartidos por sus páginas.
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type LegalProperty = { property_id: string; property_name: string; city: string | null; overdue_days: number; units_in_arrears: number; arrears_amount: number; units_current: number; news_count: number; seen_at: string | null };
export type LegalAccount = { unit_id: string; building_name: string; unit_code: string; owner_name: string | null; outstanding: number; overdue: number; days_overdue: number; last_payment_on: string | null; agreement_active: boolean; in_arrears: boolean };
export type LegalNews = { occurred_at: string; kind: string; unit_id: string; unit_label: string; description: string; amount: number; is_new: boolean };

export const newsLabels: Record<string, string> = {
  charge_import: "Cobro cargado del Excel", charge_manual: "Cobro, multa u obligación manual", charge_opening: "Saldo inicial",
  charge_voided: "Cobro anulado", payment: "Pago registrado", payment_voided: "Pago anulado", agreement: "Acuerdo de pago", agreement_cancelled: "Acuerdo cancelado",
};

// Fechas sin hora (YYYY-MM-DD): se formatean al mediodía UTC para que no cambien de día.
const dayFormat = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "UTC" });
export const formatDay = (value: string | null) => value ? dayFormat.format(new Date(`${value.slice(0, 10)}T12:00:00Z`)) : "—";
export const formatMoment = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });
