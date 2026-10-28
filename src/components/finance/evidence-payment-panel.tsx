"use client";

import { useRef, useState } from "react";
import { voidPayment, voidReceivable, type FinanceState } from "@/app/panel/propiedades/[propertyId]/cartera/actions";
import { PaymentForm, type OpenReceivable, type PaymentPrefill } from "@/components/finance/finance-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { statusPill } from "@/lib/ui/status-tones";
import { formatCop } from "@/lib/finance/constants";
import { useFormActionState } from "@/lib/forms/use-form-action-state";

export type PostedPayment = { id: string; label: string };

// Anular un pago registrado por error: se elige el pago y se escribe el motivo.
function VoidPaymentPicker({ propertyId, unitId, payments }: { propertyId: string; unitId: string; payments: PostedPayment[] }) {
  const [state, action, pending] = useFormActionState(voidPayment, undefined as FinanceState);
  return <details className="mt-6 border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Anular un pago</summary>
    {payments.length ? <form onSubmit={action} className="mt-4 grid gap-3"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="unitId" value={unitId} />
      <label className="block text-sm font-medium">Pago<select name="paymentId" required defaultValue="" className="mt-2 block h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"><option value="" disabled>Selecciona</option>{payments.map((payment) => <option key={payment.id} value={payment.id}>{payment.label}</option>)}</select></label>
      <label className="block text-sm font-medium">Motivo de anulación<input name="reason" minLength={3} maxLength={500} required className="mt-2 block h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></label>
      <div className="flex flex-wrap items-center gap-3"><Button size="sm" variant="outline" disabled={pending}>{pending ? "Anulando…" : "Anular pago"}</Button>{state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}{state?.success && <p role="status" className="text-sm text-primary">{state.success}</p>}</div>
    </form> : <p className="mt-3 text-sm text-muted-foreground">No hay pagos registrados para anular.</p>}
  </details>;
}

// Anular una obligación registrada por error; las que ya tienen pagos aplicados no se listan.
function VoidReceivablePicker({ propertyId, unitId, receivables }: { propertyId: string; unitId: string; receivables: PostedPayment[] }) {
  const [state, action, pending] = useFormActionState(voidReceivable, undefined as FinanceState);
  return <details className="mt-4 border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Anular una obligación</summary>
    {receivables.length ? <form onSubmit={action} className="mt-4 grid gap-3"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="unitId" value={unitId} />
      <label className="block text-sm font-medium">Obligación<select name="receivableId" required defaultValue="" className="mt-2 block h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"><option value="" disabled>Selecciona</option>{receivables.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label className="block text-sm font-medium">Motivo de anulación<input name="reason" minLength={3} maxLength={500} required className="mt-2 block h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></label>
      <div className="flex flex-wrap items-center gap-3"><Button size="sm" variant="outline" disabled={pending}>{pending ? "Anulando…" : "Anular obligación"}</Button>{state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}{state?.success && <p role="status" className="text-sm text-primary">{state.success}</p>}</div>
    </form> : <p className="mt-3 text-sm text-muted-foreground">No hay obligaciones sin pagos para anular.</p>}
  </details>;
}

export type EvidenceRow = { id: string; receivableId: string; concept: string; originalName: string; uploadedAt: string; uploadedDay: string; receivedAt: string | null; periodLabel: string | null; comment: string | null; declaredAmount: number | null; registered: boolean; voidReason: string | null };

// Comprobantes de pago del apartamento y, al lado, «Registrar pago». «Aceptar pago» llena el formulario
// con la deuda, el valor y la fecha del comprobante; la administración revisa y pulsa «Registrar pago».
// El pago queda amarrado al comprobante (no se puede registrar dos veces).
export function EvidencePaymentPanel({ propertyId, unitId, evidences, receivables, payments, voidableReceivables }: { propertyId: string; unitId: string; evidences: EvidenceRow[]; receivables: OpenReceivable[]; payments: PostedPayment[]; voidableReceivables: PostedPayment[] }) {
  const [prefill, setPrefill] = useState<PaymentPrefill>();
  const formRef = useRef<HTMLDivElement>(null);
  // Máximo 3 tarjetas: siempre todos los pendientes y, después, los registrados más recientes. Los
  // demás registrados quedan en «Ver historial de pagos».
  const pendingEvidences = evidences.filter((evidence) => !evidence.registered && evidence.voidReason === null);
  const shown = [...pendingEvidences, ...evidences.filter((evidence) => evidence.registered || evidence.voidReason !== null).slice(0, Math.max(0, 3 - pendingEvidences.length))];
  const inHistory = evidences.length - shown.length;
  function accept(evidence: EvidenceRow) {
    const outstanding = receivables.find((item) => item.id === evidence.receivableId)?.outstanding ?? 0;
    setPrefill({ evidenceId: evidence.id, label: evidence.concept, amount: evidence.declaredAmount ?? outstanding, paidOn: evidence.uploadedDay, reference: `Comprobante: ${evidence.originalName}`.slice(0, 120), receivableId: evidence.receivableId });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <section className="mt-7 grid gap-6 lg:grid-cols-2">
    <Card><CardContent>
      <h2 className="text-lg font-semibold">Comprobantes de pago</h2>
      <p className="mt-2 text-sm text-muted-foreground">Los comprobantes que sube el residente, con la deuda y el valor que eligió. «Aceptar pago» llena el formulario de al lado para que lo revises y lo registres.</p>
      <div className="mt-5 grid gap-3">
        {shown.map((evidence) => <article key={evidence.id} className="rounded-xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            {/* Título: lo que se paga; debajo, más pequeño, el mes, el valor y la fecha; luego el archivo. */}
            <div className="min-w-0"><p className="break-words font-semibold">{evidence.concept}</p><p className="mt-0.5 text-xs text-muted-foreground">{evidence.periodLabel ? `Pago de ${evidence.periodLabel} · ` : ""}{evidence.declaredAmount !== null ? `${formatCop(evidence.declaredAmount)} · ` : ""}cargado {evidence.uploadedAt}</p><a href={`/api/finance/evidence/${evidence.id}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block break-words text-xs font-medium text-primary underline underline-offset-2">{evidence.originalName}</a></div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusPill[evidence.voidReason !== null ? "danger" : evidence.registered ? "success" : "warning"]}`}>{evidence.voidReason !== null ? "Pago anulado" : evidence.registered ? "Pago registrado" : evidence.receivedAt ? "Recibido" : "Por revisar"}</span>
          </div>
          {evidence.comment && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-secondary px-3 py-2 text-sm">{evidence.comment}</p>}
          {evidence.receivedAt && <p className="mt-2 text-xs text-muted-foreground">Recibido {evidence.receivedAt}</p>}
          {evidence.voidReason && <p className="mt-2 text-xs text-muted-foreground">Motivo de la anulación: {evidence.voidReason}</p>}{!evidence.registered && evidence.voidReason === null && <div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" variant={prefill?.evidenceId === evidence.id ? "outline" : "default"} onClick={() => accept(evidence)}>{prefill?.evidenceId === evidence.id ? "En el formulario →" : "Aceptar pago"}</Button></div>}
        </article>)}
        {!evidences.length && <p className="text-sm text-muted-foreground">El residente aún no ha subido comprobantes.</p>}
        {inHistory > 0 && <p className="text-xs text-muted-foreground">{inHistory === 1 ? "1 comprobante registrado más está" : `${inHistory} comprobantes registrados más están`} en «Ver historial de pagos».</p>}
      </div>
    </CardContent></Card>
    <Card><CardContent>
      <h2 className="text-lg font-semibold">Registrar pago</h2>
      <p className="mt-2 text-sm text-muted-foreground">Llénalo con «Aceptar pago» en un comprobante, o escribe un pago recibido sin comprobante.</p>
      <div ref={formRef} className="mt-5 scroll-mt-6"><PaymentForm key={prefill?.evidenceId ?? "manual"} propertyId={propertyId} unitId={unitId} receivables={receivables} prefill={prefill} onDone={() => setPrefill(undefined)} onCancel={() => setPrefill(undefined)} /></div>
      <VoidPaymentPicker propertyId={propertyId} unitId={unitId} payments={payments} />
      <VoidReceivablePicker propertyId={propertyId} unitId={unitId} receivables={voidableReceivables} />
    </CardContent></Card>
  </section>;
}
