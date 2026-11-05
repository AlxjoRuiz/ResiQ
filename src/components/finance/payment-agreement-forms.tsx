"use client";

import { useEffect, useState } from "react";
import { useFormActionState } from "@/lib/forms/use-form-action-state";
import { addReceivableToAgreement, cancelPaymentAgreement, createPaymentAgreement, type FinanceState } from "@/app/panel/propiedades/[propertyId]/cartera/actions";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
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

// Acuerdo de pago amarrado a sus deudas (05/11/2026): el admin marca las deudas del apartamento que entran (todas
// al empezar), el total es exactamente la suma de su saldo y las cuotas deben sumar ese total para poder guardar.
// Las cuotas se generan mensuales e iguales y se pueden ajustar, siempre sumando lo mismo.
type AgreementDebt = { id: string; concept: string; due_on: string; outstanding: number };
const cents = (value: number) => Math.round(value * 100);
const shortDate = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "UTC" });

export function PaymentAgreementForm({ propertyId, unitId }: { propertyId: string; unitId: string }) {
  const [state, action, pending] = useFormActionState(createPaymentAgreement, undefined as FinanceState);
  const [debts, setDebts] = useState<AgreementDebt[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [count, setCount] = useState("3");
  const [firstDue, setFirstDue] = useState("");
  const [installments, setInstallments] = useState<Installment[]>([]);

  useEffect(() => {
    let active = true;
    fetch(`/api/finance/agreement-debts?propertyId=${propertyId}&unitId=${unitId}`, { cache: "no-store" })
      .then(async (response) => { const result = await response.json() as { debts?: AgreementDebt[]; error?: string }; if (!response.ok) throw new Error(result.error ?? "No se pudieron cargar las deudas."); return result.debts ?? []; })
      .then((rows) => { if (!active) return; setDebts(rows); setSelected(new Set(rows.map((row) => row.id))); })
      .catch((error: unknown) => { if (active) setLoadError(error instanceof Error ? error.message : "No se pudieron cargar las deudas."); });
    return () => { active = false; };
  }, [propertyId, unitId]);

  const total = (debts ?? []).filter((debt) => selected.has(debt.id)).reduce((sum, debt) => sum + debt.outstanding, 0);
  const sum = installments.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
  const difference = cents(total) - cents(sum);
  // Cambiar las deudas cambia el total: las cuotas se vuelven a generar.
  const pick = (next: Set<string>) => { setSelected(next); setInstallments([]); };
  const toggle = (id: string, checked: boolean) => { const next = new Set(selected); if (checked) next.add(id); else next.delete(id); pick(next); };
  function generate() {
    const parts = Math.trunc(Number(count));
    if (!(cents(total) > 0) || !(parts >= 1 && parts <= 120) || !/^\d{4}-\d{2}-\d{2}$/.test(firstDue)) return;
    const base = Math.floor(total / parts);
    setInstallments(Array.from({ length: parts }, (_, index) => ({
      amount: String(index === parts - 1 ? Math.round((total - base * (parts - 1)) * 100) / 100 : base),
      due_on: addMonths(firstDue, index),
    })));
  }
  const change = (index: number, key: keyof Installment, value: string) => setInstallments((current) => current.map((item, position) => position === index ? { ...item, [key]: value } : item));

  if (loadError) return <p role="alert" className="text-sm text-destructive">{loadError}</p>;
  if (!debts) return <p className="text-sm text-muted-foreground">Cargando las deudas del apartamento…</p>;
  if (!debts.length) return <p className="text-sm text-muted-foreground">Este apartamento no tiene deudas con saldo. El acuerdo de pago se arma con deudas pendientes.</p>;
  return <form onSubmit={action} className="grid gap-4">
    <input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="unitId" value={unitId} />
    <input type="hidden" name="receivableIds" value={JSON.stringify([...selected])} />
    <input type="hidden" name="installments" value={JSON.stringify(installments.map((item) => ({ amount: Number(item.amount), due_on: item.due_on })))} />
    <fieldset className="grid gap-2 rounded-xl border p-3"><legend className="px-1 text-sm font-medium">Deudas que entran al acuerdo</legend>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={selected.size === debts.length} onClick={() => pick(new Set(debts.map((debt) => debt.id)))}>Seleccionar todas</Button>
        <Button type="button" size="sm" variant="outline" disabled={!selected.size} onClick={() => pick(new Set())}>Desmarcar todas</Button>
      </div>
      {debts.map((debt) => <label key={debt.id} className={`flex items-start gap-3 rounded-lg border p-2 text-sm ${selected.has(debt.id) ? "border-primary/40 bg-primary/5" : ""}`}>
        <input type="checkbox" checked={selected.has(debt.id)} onChange={(event) => toggle(debt.id, event.target.checked)} className="mt-0.5 size-4 accent-primary" />
        <span className="min-w-0 flex-1"><span className="block">{debt.concept}</span><span className="block text-xs text-muted-foreground">Vence {shortDate.format(new Date(`${debt.due_on}T00:00:00Z`))}</span></span>
        <span className="font-medium">{formatCop(debt.outstanding)}</span>
      </label>)}
      <p className="flex justify-between rounded-lg bg-secondary px-3 py-2 text-sm font-semibold"><span>Total del acuerdo</span><span>{formatCop(total)}</span></p>
    </fieldset>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className={labelClass}>Número de cuotas<input className={inputClass} type="number" min={1} max={120} step={1} value={count} onChange={(event) => setCount(event.target.value)} /></label>
      <label className={labelClass}>Primera cuota<DatePicker className="mt-2" value={firstDue} onChange={setFirstDue} /></label>
    </div>
    <div><Button type="button" size="sm" variant="outline" onClick={generate} disabled={!selected.size}>Generar cuotas mensuales</Button></div>
    {installments.length > 0 && <div className="grid gap-2">
      <p className="text-sm font-medium">Cuotas ({installments.length}) · suman {formatCop(sum)}</p>
      <ol className="grid max-h-80 gap-2 overflow-y-auto">{installments.map((item, index) => <li key={index} className="grid grid-cols-[2.5rem_1fr_1fr] items-center gap-2 text-sm">
        <span className="font-semibold text-primary">{index + 1}.</span>
        <label className="sr-only" htmlFor={`cuota-valor-${index}`}>Valor de la cuota {index + 1}</label><input id={`cuota-valor-${index}`} className="h-10 rounded-lg border bg-white px-3" type="number" min={1} step="0.01" value={item.amount} onChange={(event) => change(index, "amount", event.target.value)} required />
        <label className="sr-only" htmlFor={`cuota-fecha-${index}`}>Fecha de la cuota {index + 1}</label><DatePicker id={`cuota-fecha-${index}`} className="mt-0 h-10" label={`Fecha de la cuota ${index + 1}`} floating value={item.due_on} onChange={(value) => change(index, "due_on", value)} required />
      </li>)}</ol>
      {difference !== 0 && <p role="alert" className="text-sm text-destructive">Las cuotas deben sumar {formatCop(total)}: {difference > 0 ? `faltan ${formatCop(difference / 100)}` : `sobran ${formatCop(-difference / 100)}`}.</p>}
    </div>}
    <label className={labelClass}>Nota para el residente (opcional)<textarea className="mt-2 block min-h-20 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" name="notes" maxLength={1000} placeholder="Condiciones del acuerdo" /></label>
    <div className="flex flex-wrap items-center gap-3"><Button disabled={pending || !installments.length || !selected.size || difference !== 0}>{pending ? "Guardando…" : "Registrar acuerdo"}</Button><Result state={state} /></div>
  </form>;
}

// Suma al acuerdo una deuda con saldo que no esté en él; su saldo se reparte entre las cuotas pendientes.
export function AddDebtToAgreementForm({ propertyId, unitId, debts }: { propertyId: string; unitId: string; debts: { id: string; label: string }[] }) {
  const [state, action, pending] = useFormActionState(addReceivableToAgreement, undefined as FinanceState);
  if (!debts.length) return null;
  return <form onSubmit={action} className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4">
    <input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="unitId" value={unitId} />
    <label className={`${labelClass} min-w-64 flex-1`}>Sumar una deuda al acuerdo<select className={inputClass} name="receivableId" required defaultValue=""><option value="" disabled>Selecciona</option>{debts.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <Button size="sm" disabled={pending}>{pending ? "Sumando…" : "Sumar al acuerdo"}</Button><Result state={state} />
  </form>;
}

export function CancelPaymentAgreementForm({ propertyId, unitId, agreementId }: { propertyId: string; unitId: string; agreementId: string }) {
  const [state, action, pending] = useFormActionState(cancelPaymentAgreement, undefined as FinanceState);
  return <form onSubmit={action} className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4">
    <input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="unitId" value={unitId} /><input type="hidden" name="agreementId" value={agreementId} />
    <label className={`${labelClass} min-w-64 flex-1`}>Motivo de cancelación<input className={inputClass} name="reason" minLength={4} maxLength={1000} required /></label>
    <Button size="sm" variant="outline" disabled={pending}>{pending ? "Cancelando…" : "Cancelar acuerdo"}</Button><Result state={state} />
  </form>;
}
