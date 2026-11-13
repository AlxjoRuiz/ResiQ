// Calendario de un acuerdo de pago (05/11/2026): lo calcula la base de datos (private.agreement_schedule) y es el
// mismo para el admin, el residente y la abogada. Lo que falta del acuerdo es siempre lo que falta de sus deudas.
export type InstallmentState = "paid" | "settled" | "late" | "pending";
type AgreementSchedule = {
  agreement_id: string; status: string; total: number; remaining: number; paid: number;
  // Deudas que cubre el acuerdo (05/11/2026): las demás salen como «No está en el acuerdo de pago».
  debt_ids?: string[];
  installments: { id: string; number: number; due_on: string; amount: number; due_amount: number; state: InstallmentState }[];
};

// paid: cubierta con pagos · settled: ya no queda saldo (las deudas bajaron por otra razón, p. ej. una anulación).
export const installmentStateLabels: Record<InstallmentState, string> = { paid: "Pagada", settled: "Sin saldo", late: "Vencida", pending: "Por vencer" };

export function parseSchedule(value: unknown): AgreementSchedule | null {
  if (!value || typeof value !== "object") return null;
  const row = value as AgreementSchedule;
  return { ...row, total: Number(row.total), remaining: Number(row.remaining), paid: Number(row.paid),
    installments: (row.installments ?? []).map((item) => ({ ...item, amount: Number(item.amount), due_amount: Number(item.due_amount) })) };
}
