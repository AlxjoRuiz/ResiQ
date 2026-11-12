"use client";

import { useState } from "react";
import { applyUnitCredit, createUnitCredit, registerCreditRequest, rejectCreditRequest, requestUnitCredit, voidUnitCredit, type FinanceState } from "@/app/panel/propiedades/[propertyId]/cartera/actions";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { useFormActionState } from "@/lib/forms/use-form-action-state";
import { formatCop } from "@/lib/finance/constants";
import { displayDate } from "@/lib/finance/receivable-date";
import { statusPill } from "@/lib/ui/status-tones";

// Saldos a favor del apartamento (13/11/2026, pedido de Alejandro). Entran por el Excel de cartera (valor negativo)
// o con «Registrar saldo a favor». La administración puede aplicarlos directo; el residente envía una solicitud
// («Usar saldo a favor») que le llega a la administración como un comprobante de pago y que ella registra o rechaza.
export type UnitCredit = { id: string; concept: string; amount: number; remaining: number; pending?: number; issued_on: string; source: string; status: string; void_reason: string | null };
export type CreditRequest = { id: string; creditConcept: string; debtConcept: string; amount: number; status: string; createdAt: string; rejectReason: string | null };
type OpenDebt = { id: string; concept: string; dueOn: string; outstanding: number };

const inputClass = "mt-2 block box-border h-11 min-w-0 w-full max-w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "block min-w-0 text-sm font-medium";
const available = (credit: UnitCredit) => Math.max(Number(credit.remaining) - Number(credit.pending ?? 0), 0);

function Result({ state }: { state: FinanceState }) {
  if (state?.error) return <p role="alert" className="text-sm text-destructive">{state.error}</p>;
  if (state?.success) return <p role="status" className="text-sm text-primary">{state.success}</p>;
  return null;
}

// Mismo formulario para «Aplicar» (administración) y «Usar saldo a favor» (residente); cambia la acción.
function UseForm({ propertyId, unitId, credit, debts, admin }: { propertyId: string; unitId: string; credit: UnitCredit; debts: OpenDebt[]; admin: boolean }) {
  const [state, action, pending] = useFormActionState(admin ? applyUnitCredit : requestUnitCredit, undefined as FinanceState);
  const [debtId, setDebtId] = useState(debts[0]?.id ?? "");
  const debt = debts.find((item) => item.id === debtId);
  const free = available(credit);
  const suggested = debt ? Math.min(free, debt.outstanding) : free;
  if (!debts.length) return <p className="mt-3 text-xs text-muted-foreground">No hay deudas con saldo para usarlo.</p>;
  return <form onSubmit={action} className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
    <input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="unitId" value={unitId} /><input type="hidden" name="creditId" value={credit.id} />
    <label className={labelClass}>{admin ? "Aplicar a" : "Usarlo para pagar"}<select className={inputClass} name="receivableId" value={debtId} onChange={(event) => setDebtId(event.target.value)} required>{debts.map((item) => <option key={item.id} value={item.id}>{item.concept} · vence {displayDate(item.dueOn)} · saldo {formatCop(item.outstanding)}</option>)}</select></label>
    <label className={labelClass}>Valor<input key={`${debtId}-${suggested}`} className={inputClass} name="amount" type="number" min={1} step="any" max={suggested} defaultValue={suggested} required /></label>
    <Button size="sm" disabled={pending}>{pending ? (admin ? "Aplicando…" : "Enviando…") : admin ? "Aplicar" : "Enviar solicitud"}</Button>
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

const requestLabel = (status: string) => status === "registered" ? { label: "Registrado", tone: "success" as const } : status === "rejected" ? { label: "Rechazado", tone: "danger" as const } : { label: "Por revisar", tone: "warning" as const };

// Solicitud en «Comprobantes de pago» de la administración: a qué deuda se abona, y registrar o rechazar.
export function CreditRequestCard({ propertyId, unitId, request }: { propertyId: string; unitId: string; request: CreditRequest }) {
  const [registerState, register, registering] = useFormActionState(registerCreditRequest, undefined as FinanceState);
  const [rejectState, reject, rejecting] = useFormActionState(rejectCreditRequest, undefined as FinanceState);
  const state = requestLabel(request.status);
  return <article className="rounded-xl border border-primary/30 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><p className="break-words font-semibold">{request.debtConcept}</p><p className="mt-0.5 text-xs text-muted-foreground">Pago con saldo a favor · {formatCop(request.amount)} · enviado {request.createdAt}</p></div>
      <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusPill[state.tone]}`}>{state.label}</span>
    </div>
    <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm"><p className="text-xs font-medium text-primary">Se abona así (lo eligió el residente)</p><p className="mt-1 flex justify-between gap-3"><span className="min-w-0">{request.debtConcept}</span><span className="shrink-0 font-medium">{formatCop(request.amount)}</span></p><p className="mt-1 text-xs text-muted-foreground">Sale del saldo a favor «{request.creditConcept}».</p></div>
    {request.rejectReason && <p className="mt-2 text-xs text-muted-foreground">Motivo del rechazo: {request.rejectReason}</p>}
    {request.status === "pending" && <div className="mt-3 grid gap-2">
      <form onSubmit={register}><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="unitId" value={unitId} /><input type="hidden" name="requestId" value={request.id} /><Button size="sm" disabled={registering}>{registering ? "Registrando…" : "Aceptar y registrar"}</Button></form>
      <details><summary className="cursor-pointer text-xs font-medium text-muted-foreground">Rechazar</summary>
        <form onSubmit={reject} className="mt-2 flex flex-wrap items-end gap-3"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="unitId" value={unitId} /><input type="hidden" name="requestId" value={request.id} />
          <label className={`${labelClass} min-w-56 flex-1`}>Motivo<input className={inputClass} name="reason" minLength={3} maxLength={500} required /></label>
          <Button size="sm" variant="outline" disabled={rejecting}>{rejecting ? "Rechazando…" : "Rechazar"}</Button>
        </form>
      </details>
      <Result state={registerState} /><Result state={rejectState} />
    </div>}
  </article>;
}

export function UnitCreditsCard({ propertyId, unitId, credits, requests, debts, admin, today, className = "mt-7" }: { propertyId: string; unitId: string; credits: UnitCredit[]; requests: CreditRequest[]; debts: OpenDebt[]; admin: boolean; today: string; className?: string }) {
  const active = credits.filter((credit) => credit.status === "active");
  const total = active.reduce((sum, credit) => sum + available(credit), 0);
  if (!admin && !active.length) return null;
  return <section className={`${className} rounded-2xl border bg-card p-5 sm:p-6`} aria-labelledby="saldo-a-favor">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="saldo-a-favor" className="text-lg font-semibold">Saldo a favor</h2><p className="text-2xl font-semibold text-primary">{formatCop(total)}</p></div>
    <p className="mt-1 text-sm text-muted-foreground">{admin ? "Se aplica a una deuda con saldo y queda como un abono a esa deuda. Las solicitudes del residente llegan a «Comprobantes de pago»." : "Dinero a favor de tu apartamento. Elige la deuda y el valor, y envía la solicitud: la administración la revisa y, al registrarla, se descuenta de tu deuda."}</p>
    {active.length > 0 && <div className="mt-4 grid gap-3">{active.map((credit) => <article key={credit.id} className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{credit.concept}</p><p className="text-xs text-muted-foreground">{displayDate(credit.issued_on)} · {credit.source === "import" ? "Cargado desde Excel" : "Registrado a mano"} · valor inicial {formatCop(credit.amount)}</p></div>
        <div className="text-right text-sm"><p>Disponible <strong>{formatCop(available(credit))}</strong></p>{Number(credit.pending ?? 0) > 0 && <p className="text-xs text-amber-700">{formatCop(Number(credit.pending))} en revisión</p>}</div></div>
      {available(credit) > 0 && <UseForm propertyId={propertyId} unitId={unitId} credit={credit} debts={debts} admin={admin} />}
      {admin && Number(credit.remaining) === Number(credit.amount) && !Number(credit.pending ?? 0) && <VoidForm propertyId={propertyId} unitId={unitId} creditId={credit.id} />}
    </article>)}</div>}
    {!admin && requests.length > 0 && <div className="mt-4 grid gap-2"><p className="text-sm font-medium">Mis solicitudes</p>{requests.map((request) => { const state = requestLabel(request.status); return <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"><span className="min-w-0">{formatCop(request.amount)} para «{request.debtConcept}» · {request.createdAt}{request.rejectReason ? ` · Motivo: ${request.rejectReason}` : ""}</span><span className={`rounded-full px-3 py-1 text-xs font-medium ${statusPill[state.tone]}`}>{state.label}</span></div>; })}</div>}
    {admin && <CreateForm propertyId={propertyId} unitId={unitId} today={today} />}
  </section>;
}
