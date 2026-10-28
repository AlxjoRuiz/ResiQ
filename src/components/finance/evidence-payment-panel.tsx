"use client";

import { useState, useTransition } from "react";
import { acceptEvidence, voidPayment, voidReceivable, type FinanceState } from "@/app/panel/propiedades/[propertyId]/cartera/actions";
import { PaymentForm, type OpenReceivable } from "@/components/finance/finance-forms";
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

export type EvidenceRow = { id: string; receivableId: string; concept: string; originalName: string; uploadedAt: string; uploadedDay: string; receivedAt: string | null; periodLabel: string | null; comment: string | null; declaredAmount: number | null; registered: boolean };

// Comprobantes de pago del apartamento y, al lado, «Registrar pago». «Aceptar y registrar pago»
// registra el pago con la deuda y el valor que eligió el residente y lo vincula al comprobante
// (un comprobante no se puede registrar dos veces). «Registrar pago» es para pagos sin comprobante.
export function EvidencePaymentPanel({ propertyId, unitId, evidences, receivables, payments, voidableReceivables }: { propertyId: string; unitId: string; evidences: EvidenceRow[]; receivables: OpenReceivable[]; payments: PostedPayment[]; voidableReceivables: PostedPayment[] }) {
  const [error, setError] = useState<string>();
  const [pendingId, setPendingId] = useState<string>();
  const [, startTransition] = useTransition();

  function accept(evidence: EvidenceRow) {
    setError(undefined); setPendingId(evidence.id);
    startTransition(async () => {
      const result = await acceptEvidence(propertyId, unitId, evidence.id);
      setPendingId(undefined);
      if (result?.error) setError(result.error);
    });
  }

  return <section className="mt-7 grid gap-6 lg:grid-cols-2">
    <Card><CardContent>
      <h2 className="text-lg font-semibold">Comprobantes de pago</h2>
      <p className="mt-2 text-sm text-muted-foreground">Los comprobantes que sube el residente, con la deuda y el valor que eligió. Revísalo y acéptalo para registrar el pago.</p>
      <div className="mt-5 grid gap-3">
        {evidences.map((evidence) => <article key={evidence.id} className="rounded-xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            {/* Título: lo que se paga; debajo, más pequeño, el mes, el valor y la fecha; luego el archivo. */}
            <div className="min-w-0"><p className="break-words font-semibold">{evidence.concept}</p><p className="mt-0.5 text-xs text-muted-foreground">{evidence.periodLabel ? `Pago de ${evidence.periodLabel} · ` : ""}{evidence.declaredAmount !== null ? `${formatCop(evidence.declaredAmount)} · ` : ""}cargado {evidence.uploadedAt}</p><a href={`/api/finance/evidence/${evidence.id}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block break-words text-xs font-medium text-primary underline underline-offset-2">{evidence.originalName}</a></div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusPill[evidence.registered ? "success" : "warning"]}`}>{evidence.registered ? "Pago registrado" : evidence.receivedAt ? "Recibido" : "Por revisar"}</span>
          </div>
          {evidence.comment && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-secondary px-3 py-2 text-sm">{evidence.comment}</p>}
          {evidence.receivedAt && <p className="mt-2 text-xs text-muted-foreground">Recibido {evidence.receivedAt}</p>}
          {!evidence.registered && <div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" disabled={pendingId === evidence.id} onClick={() => accept(evidence)}>{pendingId === evidence.id ? "Registrando…" : "Aceptar y registrar pago"}</Button></div>}
        </article>)}
        {!evidences.length && <p className="text-sm text-muted-foreground">El residente aún no ha subido comprobantes.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    </CardContent></Card>
    <Card><CardContent>
      <h2 className="text-lg font-semibold">Registrar pago</h2>
      <p className="mt-2 text-sm text-muted-foreground">Para pagos recibidos sin comprobante. Los comprobantes se registran con «Aceptar y registrar pago».</p>
      <div className="mt-5"><PaymentForm propertyId={propertyId} unitId={unitId} receivables={receivables} /></div>
      <VoidPaymentPicker propertyId={propertyId} unitId={unitId} payments={payments} />
      <VoidReceivablePicker propertyId={propertyId} unitId={unitId} receivables={voidableReceivables} />
    </CardContent></Card>
  </section>;
}
