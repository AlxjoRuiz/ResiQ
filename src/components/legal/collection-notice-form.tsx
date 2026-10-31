"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { sendCollectionNotice, type CollectionNoticeState } from "@/app/juridica/actions";
import { Button } from "@/components/ui/button";
import { useFormActionState } from "@/lib/forms/use-form-action-state";
import { formatCop } from "@/lib/finance/constants";

type Debt = { id: string; concept: string; due_on: string; outstanding: number; overdue: boolean };
type Recipient = { email: string; name: string | null; kind: string };
const field = "mt-1 block w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const dayFormat = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "UTC" });
const formatDay = (value: string) => dayFormat.format(new Date(`${value}T12:00:00Z`));

// Requerimiento de pago (31/10/2026): la abogada elige las deudas (vienen marcadas las vencidas), el
// correo del apartamento y escribe el mensaje. El correo lleva el detalle de las deudas elegidas, su firma y
// el botón «Responder»: la respuesta del residente le llega a Respuestas.
export function CollectionNoticeForm({ propertyId, unitId, unitLabel, propertyName, debts, recipients }: { propertyId: string; unitId: string; unitLabel: string; propertyName: string; debts: Debt[]; recipients: Recipient[] }) {
  const [state, action, pending] = useFormActionState(sendCollectionNotice, undefined as CollectionNoticeState);
  const [selected, setSelected] = useState(() => new Set(debts.filter((debt) => debt.overdue).map((debt) => debt.id)));
  const total = debts.filter((debt) => selected.has(debt.id)).reduce((sum, debt) => sum + debt.outstanding, 0);
  const toggle = (id: string, checked: boolean) => setSelected((current) => { const next = new Set(current); if (checked) next.add(id); else next.delete(id); return next; });
  const message = `Respetado(a) propietario(a) o residente:\n\nEn nombre de ${propertyName}, le informamos que el apartamento ${unitLabel} presenta obligaciones pendientes con la copropiedad, relacionadas al final de este mensaje.\n\nLe solicitamos ponerse al día dentro de los cinco (5) días hábiles siguientes al recibo de esta comunicación, o comunicarse con nosotros para acordar una forma de pago. De no recibir respuesta, el caso podrá continuar con el cobro jurídico.\n\nSi ya realizó el pago, por favor indíquelo con el botón «Responder» de este correo.`;

  if (!debts.length) return <p className="text-sm text-muted-foreground">Este apartamento no tiene deudas con saldo para cobrar.</p>;
  if (!recipients.length) return <p className="text-sm text-muted-foreground">Este apartamento no tiene correos en el censo ni cuentas con acceso a la cartera. Pide a la administración que actualice el censo.</p>;
  return <form onSubmit={action} className="grid gap-5">
    <input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="unitId" value={unitId} />
    <details className="group rounded-xl border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 marker:hidden">
        <span className="min-w-0"><span className="block text-sm font-medium">Deudas que se cobran</span><span className="block text-xs text-muted-foreground">{selected.size} de {debts.length} elegidas · toca para cambiarlas</span></span>
        <span className="flex shrink-0 items-center gap-2 text-sm font-semibold">{formatCop(total)}<ChevronDown size={18} aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-180" /></span>
      </summary>
      <fieldset className="grid gap-2 border-t p-3"><legend className="sr-only">Deudas que se cobran</legend>
      {debts.map((debt) => <label key={debt.id} className="flex items-start gap-3 rounded-xl border p-3 text-sm">
        <input type="checkbox" name="debt" value={debt.id} checked={selected.has(debt.id)} onChange={(event) => toggle(debt.id, event.target.checked)} className="mt-0.5 size-4 accent-primary" />
        <span className="min-w-0 flex-1"><span className="block font-medium">{debt.concept}</span><span className={`block text-xs ${debt.overdue ? "text-red-700" : "text-muted-foreground"}`}>Vence {formatDay(debt.due_on)}{debt.overdue ? " · vencida" : ""}</span></span>
        <span className="font-semibold">{formatCop(debt.outstanding)}</span>
      </label>)}
      <p className="flex justify-between rounded-xl bg-secondary px-3 py-2 text-sm font-semibold"><span>Total que se cobra</span><span>{formatCop(total)}</span></p>
      </fieldset>
    </details>
    <label className="text-sm font-medium">Enviar a<select name="recipient" required defaultValue={recipients[0].email} className={`${field} h-11`}>{recipients.map((recipient) => <option key={recipient.email} value={recipient.email}>{recipient.name ? `${recipient.name} · ` : ""}{recipient.email} ({recipient.kind})</option>)}</select></label>
    <label className="text-sm font-medium">Asunto<input name="subject" required minLength={3} maxLength={150} defaultValue={`Requerimiento de pago · ${unitLabel} · ${propertyName}`} className={`${field} h-11`} /></label>
    <label className="text-sm font-medium">Mensaje<textarea name="message" required minLength={10} maxLength={5000} rows={10} defaultValue={message} className={`${field} py-2 leading-relaxed`} /></label>
    <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">ResiQ está en modo de prueba: el requerimiento queda registrado, pero el correo no sale hasta activar los envíos reales.</p>
    <div className="flex flex-wrap items-center gap-3"><Button disabled={pending || !selected.size}>{pending ? "Registrando…" : "Enviar requerimiento"}</Button>
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}{state?.success && <p role="status" className="text-sm text-primary">{state.success}</p>}</div>
  </form>;
}
