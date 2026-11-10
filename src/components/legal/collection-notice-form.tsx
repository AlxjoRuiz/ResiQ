"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { sendCollectionNotice, type CollectionNoticeState } from "@/app/juridica/actions";
import { Button } from "@/components/ui/button";
import { useFormActionState } from "@/lib/forms/use-form-action-state";
import { LegalFilesField, withFiles } from "@/components/legal/legal-files-field";
import { formatCop } from "@/lib/finance/constants";

type Debt = { id: string; concept: string; due_on: string; outstanding: number; overdue: boolean };
type Recipient = { email: string; name: string | null; kind: string };
// Acuerdo vigente (09/11/2026): sus cuotas con saldo se pueden cobrar igual que las deudas. Las deudas que están en
// el acuerdo no se cobran junto con sus cuotas (se cobraría dos veces): elegir una cosa bloquea la otra.
type NoticeInstallment = { id: string; number: number; due_on: string; outstanding: number; overdue: boolean };
export type NoticeAgreement = { total: number; remaining: number | null; installmentCount: number; debtIds: string[]; installments: NoticeInstallment[] };
const field = "mt-1 block w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const dayFormat = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "UTC" });
const formatDay = (value: string) => dayFormat.format(new Date(`${value}T12:00:00Z`));

// Requerimiento de pago (31/10/2026): la abogada elige las deudas (ninguna marcada al empezar; botones para
// marcar o desmarcar todas), el correo del apartamento y escribe el mensaje. El correo lleva el detalle de
// las deudas elegidas y su firma; si el residente responde desde su correo, le llega a Respuestas.
export function CollectionNoticeForm({ propertyId, unitId, unitLabel, propertyName, debts, recipients, agreement = null }: { propertyId: string; unitId: string; unitLabel: string; propertyName: string; debts: Debt[]; recipients: Recipient[]; agreement?: NoticeAgreement | null }) {
  const inAgreement = new Set(agreement?.debtIds ?? []);
  // Adjuntos (05/11/2026): van en el correo del requerimiento.
  const [files, setFiles] = useState<File[]>([]);
  const [state, action, pending] = useFormActionState(async (previous: CollectionNoticeState, data: FormData) => {
    const result = await sendCollectionNotice(previous, withFiles(data, files));
    if (!result?.error) setFiles([]);
    return result;
  }, undefined as CollectionNoticeState);
  // Empieza sin ninguna deuda marcada; la abogada elige una por una o todas con el botón.
  const [selected, setSelected] = useState(() => new Set<string>());
  const installments = agreement?.installments ?? [];
  const total = [...debts, ...installments].filter((item) => selected.has(item.id)).reduce((sum, item) => sum + item.outstanding, 0);
  const itemCount = debts.length + installments.length;
  const installmentChosen = installments.some((item) => selected.has(item.id));
  const agreementDebtChosen = debts.some((debt) => inAgreement.has(debt.id) && selected.has(debt.id));
  // «Seleccionar todas»: con cuotas por cobrar, las cuotas más las deudas que no están en el acuerdo.
  const everything = installments.length ? [...installments.map((item) => item.id), ...debts.filter((debt) => !inAgreement.has(debt.id)).map((debt) => debt.id)] : debts.map((debt) => debt.id);
  const toggle = (id: string, checked: boolean) => setSelected((current) => { const next = new Set(current); if (checked) next.add(id); else next.delete(id); return next; });
  const message = `Respetado(a) propietario(a) o residente:\n\nEn nombre de ${propertyName}, le informamos que el apartamento ${unitLabel} presenta obligaciones pendientes con la copropiedad, relacionadas al final de este mensaje.\n\nLe solicitamos ponerse al día dentro de los cinco (5) días hábiles siguientes al recibo de esta comunicación, o comunicarse con nosotros para acordar una forma de pago. De no recibir respuesta, el caso podrá continuar con el cobro jurídico.\n\nSi ya realizó el pago, por favor indíquelo con el botón «Responder» de este correo.`;

  if (!itemCount) return <p className="text-sm text-muted-foreground">Este apartamento no tiene deudas con saldo para cobrar.</p>;
  if (!recipients.length) return <p className="text-sm text-muted-foreground">Este apartamento no tiene correos en el censo ni cuentas con acceso a la cartera. Pide a la administración que actualice el censo.</p>;
  return <form onSubmit={action} className="grid gap-5">
    <input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="unitId" value={unitId} />
    <details className="group rounded-xl border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 marker:hidden">
        <span className="min-w-0"><span className="block text-sm font-medium">Deudas que se cobran</span><span className="block text-xs text-muted-foreground">{selected.size} de {itemCount} elegidas · toca para cambiarlas</span></span>
        <span className="flex shrink-0 items-center gap-2 text-sm font-semibold">{formatCop(total)}<ChevronDown size={18} aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-180" /></span>
      </summary>
      <fieldset className="grid gap-2 border-t p-3"><legend className="sr-only">Deudas que se cobran</legend>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={everything.every((id) => selected.has(id)) && selected.size === everything.length} onClick={() => setSelected(new Set(everything))}>Seleccionar todas</Button>
        <Button type="button" size="sm" variant="outline" disabled={!selected.size} onClick={() => setSelected(new Set())}>Desmarcar todas</Button>
      </div>
      {debts.length > 0 && <p className="mt-1 text-xs font-semibold text-muted-foreground uppercase">Deudas</p>}
      {debts.map((debt) => { const blocked = installmentChosen && inAgreement.has(debt.id); return <label key={debt.id} className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${blocked ? "opacity-60" : ""}`}>
        <input type="checkbox" name="debt" value={debt.id} checked={selected.has(debt.id)} disabled={blocked} onChange={(event) => toggle(debt.id, event.target.checked)} className="mt-0.5 size-4 accent-primary" />
        <span className="min-w-0 flex-1"><span className="block font-medium">{debt.concept}{agreement && (inAgreement.has(debt.id) ? <span className="ml-2 inline-block rounded-full border border-primary/40 bg-white px-2 py-0.5 text-xs font-medium text-primary">En el acuerdo de pago</span> : <span className="ml-2 inline-block rounded-full border border-amber-300 bg-white px-2 py-0.5 text-xs font-medium text-amber-900">No está en el acuerdo de pago</span>)}</span><span className={`block text-xs ${debt.overdue ? "text-urgent" : "text-muted-foreground"}`}>Vence {formatDay(debt.due_on)}{debt.overdue ? " · vencida" : ""}{blocked ? " · se cobra con las cuotas del acuerdo" : ""}</span></span>
        <span className="font-semibold">{formatCop(debt.outstanding)}</span>
      </label>; })}
      {agreement && installments.length > 0 && <>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs font-semibold text-muted-foreground uppercase">Acuerdo de pago vigente<span className="font-medium normal-case">{formatCop(agreement.total)}{agreement.remaining !== null ? ` · falta ${formatCop(agreement.remaining)}` : ""}</span></p>
        {installments.map((item) => { const blocked = agreementDebtChosen; return <label key={item.id} className={`flex items-start gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3 text-sm ${blocked ? "opacity-60" : ""}`}>
          <input type="checkbox" name="installment" value={item.id} checked={selected.has(item.id)} disabled={blocked} onChange={(event) => toggle(item.id, event.target.checked)} className="mt-0.5 size-4 accent-primary" />
          <span className="min-w-0 flex-1"><span className="block font-medium">Acuerdo de pago · Cuota {item.number} de {agreement.installmentCount}</span><span className={`block text-xs ${item.overdue ? "text-urgent" : "text-muted-foreground"}`}>Vence {formatDay(item.due_on)}{item.overdue ? " · vencida" : ""}{blocked ? " · quita las deudas del acuerdo para cobrar sus cuotas" : ""}</span></span>
          <span className="font-semibold">{formatCop(item.outstanding)}</span>
        </label>; })}
      </>}
      <p className="flex justify-between rounded-xl bg-secondary px-3 py-2 text-sm font-semibold"><span>Total que se cobra</span><span>{formatCop(total)}</span></p>
      </fieldset>
    </details>
    <label className="text-sm font-medium">Enviar a<select name="recipient" required defaultValue={recipients[0].email} className={`${field} h-11`}>{recipients.map((recipient) => <option key={recipient.email} value={recipient.email}>{recipient.name ? `${recipient.name} · ` : ""}{recipient.email} ({recipient.kind})</option>)}</select></label>
    <label className="text-sm font-medium">Asunto<input name="subject" required minLength={3} maxLength={150} defaultValue={`Requerimiento de pago · ${unitLabel} · ${propertyName}`} className={`${field} h-11`} /></label>
    <label className="text-sm font-medium">Mensaje<textarea name="message" required minLength={10} maxLength={5000} rows={10} defaultValue={message} className={`${field} py-2 leading-relaxed`} /></label>
    <LegalFilesField files={files} onChange={setFiles} disabled={pending} />
    <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">ResiQ está en modo de prueba: el requerimiento queda registrado, pero el correo no sale hasta activar los envíos reales.</p>
    <div className="flex flex-wrap items-center gap-3"><Button disabled={pending || !selected.size}>{pending ? "Registrando…" : "Enviar requerimiento"}</Button>
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}{state?.success && <p role="status" className="text-sm text-primary">{state.success}</p>}</div>
  </form>;
}
