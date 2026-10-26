"use client";

import { useActionState, useState } from "react";
import { cancelPaymentAgreement, createPaymentAgreement, type FinanceState } from "@/app/panel/propiedades/[propertyId]/cartera/actions";
import { Button } from "@/components/ui/button";
import { formatCop } from "@/lib/finance/constants";

const inputClass = "mt-2 block box-border h-11 min-w-0 w-full max-w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "block min-w-0 text-sm font-medium";
type Installment = { amount: string; due_on: string };

function Result({ state }: { state: FinanceState }) {
  if (state?.error) return <p role="alert" className="text-sm text-destructive">{state.error}</p>;
  if (state?.success) return <p role="status" className="text-sm text-primary">{state.success}</p>;
  return null;
}

/** Suma meses a una fecha AAAA-MM-DD; si el día no existe en ese mes, usa el último día. */
function addMonths(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

// Acuerdo de pago: el admin genera cuotas mensuales iguales desde un total y luego puede ajustar
// el valor o la fecha de cada cuota antes de guardar.
export function PaymentAgreementForm({ propertyId, unitId, suggestedTotal }: { propertyId: string; unitId: string; suggestedTotal: number }) {
  const [state, action, pending] = useActionState(createPaymentAgreement, undefined as FinanceState);
  const [total, setTotal] = useState(suggestedTotal > 0 ? String(Math.round(suggestedTotal)) : "");
  const [count, setCount] = useState("3");
  const [firstDue, setFirstDue] = useState("");
  const [installments, setInstallments] = useState<Installment[]>([]);

  function generate() {
    const amount = Math.round(Number(total)), parts = Math.trunc(Number(count));
    if (!(amount > 0) || !(parts >= 1 && parts <= 120) || !/^\d{4}-\d{2}-\d{2}$/.test(firstDue)) return;
    const base = Math.floor(amount / parts);
    setInstallments(Array.from({ length: parts }, (_, index) => ({
      amount: String(index === parts - 1 ? amount - base * (parts - 1) : base),
      due_on: addMonths(firstDue, index),
    })));
  }
  const change = (index: number, key: keyof Installment, value: string) => setInstallments((current) => current.map((item, position) => position === index ? { ...item, [key]: value } : item));
  const sum = installments.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);

  return <form action={action} className="grid gap-4">
    <input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="unitId" value={unitId} />
    <input type="hidden" name="installments" value={JSON.stringify(installments.map((item) => ({ amount: Number(item.amount), due_on: item.due_on })))} />
    <div className="grid gap-4 sm:grid-cols-3">
      <label className={labelClass}>Total a financiar<input className={inputClass} type="number" min={1} step={1} value={total} onChange={(event) => setTotal(event.target.value)} /></label>
      <label className={labelClass}>Número de cuotas<input className={inputClass} type="number" min={1} max={120} step={1} value={count} onChange={(event) => setCount(event.target.value)} /></label>
      <label className={labelClass}>Primera cuota<input className={inputClass} type="date" value={firstDue} onChange={(event) => setFirstDue(event.target.value)} /></label>
    </div>
    <div><Button type="button" size="sm" variant="outline" onClick={generate}>Generar cuotas mensuales</Button></div>
    {installments.length > 0 && <div className="grid gap-2">
      <p className="text-sm font-medium">Cuotas ({installments.length}) · total {formatCop(sum)}</p>
      <ol className="grid max-h-80 gap-2 overflow-y-auto">{installments.map((item, index) => <li key={index} className="grid grid-cols-[2.5rem_1fr_1fr] items-center gap-2 text-sm">
        <span className="font-semibold text-primary">{index + 1}.</span>
        <label className="sr-only" htmlFor={`cuota-valor-${index}`}>Valor de la cuota {index + 1}</label><input id={`cuota-valor-${index}`} className="h-10 rounded-lg border bg-white px-3" type="number" min={1} step={1} value={item.amount} onChange={(event) => change(index, "amount", event.target.value)} required />
        <label className="sr-only" htmlFor={`cuota-fecha-${index}`}>Fecha de la cuota {index + 1}</label><input id={`cuota-fecha-${index}`} className="h-10 rounded-lg border bg-white px-3" type="date" value={item.due_on} onChange={(event) => change(index, "due_on", event.target.value)} required />
      </li>)}</ol>
    </div>}
    <label className={labelClass}>Nota para el residente (opcional)<textarea className="mt-2 block min-h-20 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" name="notes" maxLength={1000} placeholder="Condiciones del acuerdo" /></label>
    <div className="flex flex-wrap items-center gap-3"><Button disabled={pending || !installments.length}>{pending ? "Guardando…" : "Registrar acuerdo"}</Button><Result state={state} /></div>
  </form>;
}

export function CancelPaymentAgreementForm({ propertyId, unitId, agreementId }: { propertyId: string; unitId: string; agreementId: string }) {
  const [state, action, pending] = useActionState(cancelPaymentAgreement, undefined as FinanceState);
  return <form action={action} className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4">
    <input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="unitId" value={unitId} /><input type="hidden" name="agreementId" value={agreementId} />
    <label className={`${labelClass} min-w-64 flex-1`}>Motivo de cancelación<input className={inputClass} name="reason" minLength={4} maxLength={1000} required /></label>
    <Button size="sm" variant="outline" disabled={pending}>{pending ? "Cancelando…" : "Cancelar acuerdo"}</Button><Result state={state} />
  </form>;
}
