"use client";

import { useState } from "react";
import { applyUnitCredit, createUnitCredit, voidUnitCredit, type FinanceState } from "@/app/panel/propiedades/[propertyId]/cartera/actions";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { useFormActionState } from "@/lib/forms/use-form-action-state";
import { formatCop } from "@/lib/finance/constants";
import { displayDate } from "@/lib/finance/receivable-date";

// Saldos a favor del apartamento (13/11/2026, pedido de Alejandro). Entran por el Excel de cartera (valor negativo)
// o con «Registrar saldo a favor». La administración decide cuándo aplicarlos a una obligación con saldo; el
// residente solo los ve.
export type UnitCredit = { id: string; concept: string; amount: number; remaining: number; issued_on: string; source: string; status: string; void_reason: string | null };
type OpenDebt = { id: string; concept: string; dueOn: string; outstanding: number };

const inputClass = "mt-2 block box-border h-11 min-w-0 w-full max-w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "block min-w-0 text-sm font-medium";

function Result({ state }: { state: FinanceState }) {
  if (state?.error) return <p role="alert" className="text-sm text-destructive">{state.error}</p>;
  if (state?.success) return <p role="status" className="text-sm text-primary">{state.success}</p>;
  return null;
}

function ApplyForm({ propertyId, unitId, credit, debts }: { propertyId: string; unitId: string; credit: UnitCredit; debts: OpenDebt[] }) {
  const [state, action, pending] = useFormActionState(applyUnitCredit, undefined as FinanceState);
  const [debtId, setDebtId] = useState(debts[0]?.id ?? "");
  const debt = debts.find((item) => item.id === debtId);
  const suggested = debt ? Math.min(credit.remaining, debt.outstanding) : credit.remaining;
  if (!debts.length) return <p className="mt-3 text-xs text-muted-foreground">El apartamento no tiene obligaciones con saldo para aplicarlo.</p>;
  return <form onSubmit={action} className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
    <input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="unitId" value={unitId} /><input type="hidden" name="creditId" value={credit.id} />
    <label className={labelClass}>Aplicar a<select className={inputClass} name="receivableId" value={debtId} onChange={(event) => setDebtId(event.target.value)} required>{debts.map((item) => <option key={item.id} value={item.id}>{item.concept} · vence {displayDate(item.dueOn)} · saldo {formatCop(item.outstanding)}</option>)}</select></label>
    <label className={labelClass}>Valor<input key={`${debtId}-${suggested}`} className={inputClass} name="amount" type="number" min={1} step="any" max={suggested} defaultValue={suggested} required /></label>
    <Button size="sm" disabled={pending}>{pending ? "Aplicando…" : "Aplicar"}</Button>
    <div className="sm:col-span-3"><Result state={state} /></div>
  </form>;
}

function VoidForm({ propertyId, unitId, creditId }: { propertyId: string; unitId: string; creditId: string }) {
  const [state, action, pending] = useFormActionState(voidUnitCredit, undefined as FinanceState);
  return <details className="mt-3"><summary className="cursor-pointer text-xs font-medium text-muted-foreground">Anular este saldo a favor</summary>
    <form onSubmit={action} className="mt-2 flex flex-wrap items-end gap-3"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="unitId" value={unitId} /><input type="hidden" name="creditId" value={creditId} />
      <label className={`${labelClass} min-w-56 flex-1`}>Motivo<input className={inputClass} name="reason" minLength={3} maxLength={500} required /></label>
      <Button size="sm" variant="outline" disabled={pending}>{pending ? "Anulando…" : "Anular"}</Button><Result state={state} />
    </form>
  </details>;
}

function CreateForm({ propertyId, unitId, today }: { propertyId: string; unitId: string; today: string }) {
  const [state, action, pending] = useFormActionState(createUnitCredit, undefined as FinanceState);
  return <details className="mt-5 rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Registrar saldo a favor</summary>
    <form onSubmit={action} className="mt-4 grid gap-4 sm:grid-cols-3"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="unitId" value={unitId} />
      <label className={`${labelClass} sm:col-span-3`}>Concepto<input className={inputClass} name="concept" minLength={2} maxLength={180} placeholder="Ej.: Saldo a favor de octubre" required /></label>
      <label className={labelClass}>Valor<input className={inputClass} name="amount" type="number" min={1} step="any" required /></label>
      <div className={labelClass}>Fecha<DatePicker className="mt-2" name="issuedOn" defaultValue={today} max={today} required /></div>
      <div className="flex items-end"><Button disabled={pending}>{pending ? "Guardando…" : "Registrar"}</Button></div>
      <div className="sm:col-span-3"><Result state={state} /></div>
    </form>
  </details>;
}

export function UnitCreditsCard({ propertyId, unitId, credits, debts, admin, today }: { propertyId: string; unitId: string; credits: UnitCredit[]; debts: OpenDebt[]; admin: boolean; today: string }) {
  const active = credits.filter((credit) => credit.status === "active");
  const available = active.reduce((sum, credit) => sum + Number(credit.remaining), 0);
  if (!admin && !active.length) return null;
  return <section className="mt-7 rounded-2xl border bg-card p-5 sm:p-6" aria-labelledby="saldo-a-favor">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="saldo-a-favor" className="text-lg font-semibold">Saldo a favor</h2><p className="text-2xl font-semibold text-primary">{formatCop(available)}</p></div>
    <p className="mt-1 text-sm text-muted-foreground">{admin ? "La administración decide cuándo aplicarlo a una obligación con saldo. Al aplicarlo queda como un abono a esa obligación." : "Dinero a favor de tu apartamento. La administración lo aplica a tus obligaciones."}</p>
    {active.length > 0 && <div className="mt-4 grid gap-3">{active.map((credit) => <article key={credit.id} className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{credit.concept}</p><p className="text-xs text-muted-foreground">{displayDate(credit.issued_on)} · {credit.source === "import" ? "Cargado desde Excel" : "Registrado a mano"} · valor inicial {formatCop(credit.amount)}</p></div><p className="text-sm">Disponible <strong>{formatCop(credit.remaining)}</strong></p></div>
      {admin && Number(credit.remaining) > 0 && <ApplyForm propertyId={propertyId} unitId={unitId} credit={{ ...credit, remaining: Number(credit.remaining) }} debts={debts} />}
      {admin && Number(credit.remaining) === Number(credit.amount) && <VoidForm propertyId={propertyId} unitId={unitId} creditId={credit.id} />}
    </article>)}</div>}
    {admin && <CreateForm propertyId={propertyId} unitId={unitId} today={today} />}
  </section>;
}
