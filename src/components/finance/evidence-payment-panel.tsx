"use client";

import { useRef, useState } from "react";
import { voidPayment, voidReceivable, type FinanceState } from "@/app/panel/propiedades/[propertyId]/cartera/actions";
import { PaymentForm, type OpenReceivable, type PaymentPrefill } from "@/components/finance/finance-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentCard } from "@/components/finance/payment-card";
import { CreditRequestCard, type CreditRequest } from "@/components/finance/unit-credits";
import { formatCop } from "@/lib/finance/constants";
import { useFormActionState } from "@/lib/forms/use-form-action-state";

type PostedPayment = { id: string; label: string };

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

type EvidenceRow = { id: string; receivableId: string; concept: string; originalName: string; uploadedAt: string; createdIso: string; uploadedDay: string; receivedAt: string | null; periodLabel: string | null; comment: string | null; declaredAmount: number | null; registered: boolean; voidReason: string | null ; plannedAllocations?: { receivable_id: string; amount: number; concept?: string }[] | null };

// Comprobantes de pago del apartamento y, al lado, «Registrar pago». «Aceptar pago» llena el formulario
// con la deuda, el valor y la fecha del comprobante; la administración revisa y pulsa «Registrar pago».
// El pago queda amarrado al comprobante (no se puede registrar dos veces).
// Solicitudes del residente para usar su saldo a favor (13/11/2026), como comprobantes. Orden: primero todo lo que
// está por revisar (solicitudes y comprobantes) y después lo ya registrado o anulado.
export function EvidencePaymentPanel({ propertyId, unitId, evidences, receivables, payments, voidableReceivables, creditRequests = [] }: { propertyId: string; unitId: string; evidences: EvidenceRow[]; receivables: OpenReceivable[]; payments: PostedPayment[]; voidableReceivables: PostedPayment[]; creditRequests?: CreditRequest[] }) {
  const [prefill, setPrefill] = useState<PaymentPrefill>();
  const formRef = useRef<HTMLDivElement>(null);
  // Máximo 3 tarjetas entre comprobantes y solicitudes de saldo a favor (13/11/2026): siempre todo lo que está por
  // revisar y, con el espacio que quede, lo más reciente ya registrado. Lo demás queda en «Ver historial de pagos».
  type Item = { key: string; iso: string; pending: boolean; evidence?: EvidenceRow; request?: CreditRequest };
  const items: Item[] = [
    ...evidences.map((evidence) => ({ key: evidence.id, iso: evidence.createdIso, pending: !evidence.registered && evidence.voidReason === null, evidence })),
    ...creditRequests.map((request) => ({ key: request.id, iso: request.createdIso, pending: request.status === "pending", request })),
  ];
  const byNewest = (a: Item, b: Item) => b.iso.localeCompare(a.iso);
  const pendingItems = items.filter((item) => item.pending).sort(byNewest);
  const shown = [...pendingItems, ...items.filter((item) => !item.pending).sort(byNewest).slice(0, Math.max(0, 3 - pendingItems.length))];
  const inHistory = items.length - shown.length;
  function accept(evidence: EvidenceRow) {
    const outstanding = receivables.find((item) => item.id === evidence.receivableId)?.outstanding ?? 0;
    setPrefill({ evidenceId: evidence.id, label: evidence.concept, amount: evidence.declaredAmount ?? outstanding, paidOn: evidence.uploadedDay, reference: `Comprobante: ${evidence.originalName}`.slice(0, 120), receivableId: evidence.receivableId, allocations: evidence.plannedAllocations ?? undefined });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const evidenceCard = (evidence: EvidenceRow) => <PaymentCard key={evidence.id} title={evidence.concept} kind="Pago con comprobante"
    status={evidence.voidReason !== null ? { label: "Pago anulado", tone: "danger" } : evidence.registered ? { label: "Registrado", tone: "success" } : { label: evidence.receivedAt ? "Recibido" : "Por revisar", tone: "warning" }}
    facts={[{ label: "Valor", value: evidence.declaredAmount !== null ? formatCop(evidence.declaredAmount) : "Sin indicar" }, { label: "Enviado", value: evidence.uploadedAt }, { label: "Mes que paga", value: evidence.periodLabel ?? "Sin indicar" },
      { label: "Comprobante", value: <a href={`/api/finance/evidence/${evidence.id}`} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline underline-offset-2">{evidence.originalName}</a> }]}
    allocations={evidence.plannedAllocations?.length ? evidence.plannedAllocations.map((item) => ({ key: item.receivable_id, concept: item.concept ?? "Obligación", amount: item.amount })) : [{ key: evidence.receivableId, concept: evidence.concept, amount: evidence.declaredAmount }]}>
    {evidence.comment && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-secondary px-3 py-2 text-sm">{evidence.comment}</p>}
    {evidence.receivedAt && <p className="mt-2 text-xs text-muted-foreground">Recibido {evidence.receivedAt}</p>}
    {evidence.voidReason && <p className="mt-2 text-xs text-muted-foreground">Motivo de la anulación: {evidence.voidReason}</p>}
    {!evidence.registered && evidence.voidReason === null && <div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" variant={prefill?.evidenceId === evidence.id ? "outline" : "default"} onClick={() => accept(evidence)}>{prefill?.evidenceId === evidence.id ? "En el formulario →" : "Aceptar pago"}</Button></div>}
  </PaymentCard>;

  return <section className="mt-7 grid gap-6 lg:grid-cols-2">
    <Card><CardContent>
      <h2 className="text-lg font-semibold">Comprobantes de pago</h2>
      <p className="mt-2 text-sm text-muted-foreground">Los comprobantes que sube el residente, con la deuda y el valor que eligió. «Aceptar pago» llena el formulario de al lado para que lo revises y lo registres.</p>
      <div className="mt-5 grid gap-3">
        {shown.map((item) => item.evidence ? evidenceCard(item.evidence) : item.request ? <CreditRequestCard key={item.key} propertyId={propertyId} unitId={unitId} request={item.request} /> : null)}
        {!items.length && <p className="text-sm text-muted-foreground">El residente aún no ha subido comprobantes.</p>}
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
