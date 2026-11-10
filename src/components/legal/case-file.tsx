"use client";

import { useState } from "react";
import { addLegalCaseAction, addLegalCommitment, openLegalCase, setLegalCommitmentStatus, updateLegalCase, type CollectionNoticeState } from "@/app/juridica/actions";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { useFormActionState } from "@/lib/forms/use-form-action-state";
import { formatCop } from "@/lib/finance/constants";
import { caseActionLabels, caseStatusLabels, caseStatusTones, commitmentLabels } from "@/lib/legal/case-labels";

export type CaseFile = {
  id: string; status: string; next_follow_up: string | null; closed_reason: string | null; opened_at: string; closed_at: string | null; today: string;
  actions: { id: string; kind: string; occurred_on: string; summary: string; created_at: string }[];
  commitments: { id: string; amount: number; due_on: string; note: string | null; status: string }[];
};
const field = "mt-1 block w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const dayFormat = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "UTC" });
const formatDay = (value: string) => dayFormat.format(new Date(`${value.slice(0, 10)}T12:00:00Z`));

function Result({ state }: { state: CollectionNoticeState }) {
  if (state?.error) return <p role="alert" className="text-sm text-destructive">{state.error}</p>;
  if (state?.success) return <p role="status" className="text-sm text-primary">{state.success}</p>;
  return null;
}
function Ids({ propertyId, unitId }: { propertyId: string; unitId: string }) {
  return <><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="unitId" value={unitId} /></>;
}

// Expediente prejurídico del apartamento (03/11/2026): estado, próximo seguimiento, gestiones y compromisos
// de pago. Los requerimientos enviados y las respuestas del residente se anotan solos como gestiones.
export function CaseFilePanel({ propertyId, unitId, caseFile }: { propertyId: string; unitId: string; caseFile: CaseFile | null }) {
  const [openState, openAction, opening] = useFormActionState(openLegalCase, undefined as CollectionNoticeState);
  if (!caseFile || caseFile.status === "closed") return <div className="grid gap-3">
    {caseFile && <p className="text-sm text-muted-foreground">Último expediente cerrado el {formatDay(caseFile.closed_at ?? caseFile.opened_at)}{caseFile.closed_reason ? ` · ${caseFile.closed_reason}` : ""}.</p>}
    <form onSubmit={openAction} className="flex flex-wrap items-center gap-3"><Ids propertyId={propertyId} unitId={unitId} />
      <Button disabled={opening}>{opening ? "Abriendo…" : caseFile ? "Abrir un expediente nuevo" : "Abrir expediente"}</Button><Result state={openState} /></form>
    <p className="text-xs text-muted-foreground">También se abre solo al enviar un requerimiento de pago. Mientras esté abierto, la administración ve el apartamento «En cobro jurídico».</p>
  </div>;
  return <OpenCase propertyId={propertyId} unitId={unitId} caseFile={caseFile} />;
}

function OpenCase({ propertyId, unitId, caseFile }: { propertyId: string; unitId: string; caseFile: CaseFile }) {
  const [caseState, caseAction, savingCase] = useFormActionState(updateLegalCase, undefined as CollectionNoticeState);
  const [actionState, actionAction, savingAction] = useFormActionState(addLegalCaseAction, undefined as CollectionNoticeState);
  const [commitState, commitAction, savingCommit] = useFormActionState(addLegalCommitment, undefined as CollectionNoticeState);
  const [status, setStatus] = useState(caseFile.status);
  const late = caseFile.next_follow_up && caseFile.next_follow_up <= caseFile.today;
  return <div className="grid gap-6">
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className={`rounded-full px-3 py-1 text-xs font-medium ${caseStatusTones[caseFile.status] ?? "bg-secondary"}`}>{caseStatusLabels[caseFile.status] ?? caseFile.status}</span>
      <span className="text-muted-foreground">Abierto el {formatDay(caseFile.opened_at)}</span>
      {caseFile.next_follow_up && <span className={`rounded-full px-3 py-1 text-xs font-medium ${late ? "bg-urgent/10 text-urgent" : "bg-secondary"}`}>{late ? (caseFile.next_follow_up === caseFile.today ? "Seguimiento hoy" : "Seguimiento vencido") : "Próximo seguimiento"} · {formatDay(caseFile.next_follow_up)}</span>}
    </div>

    <form onSubmit={caseAction} className="grid gap-3 rounded-xl border p-4"><Ids propertyId={propertyId} unitId={unitId} /><input type="hidden" name="caseId" value={caseFile.id} />
      <p className="font-medium">Estado y seguimiento</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">Estado<select name="status" value={status} onChange={(event) => setStatus(event.target.value)} className={`${field} h-11`}>{Object.entries(caseStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {status !== "closed" ? <label className="text-sm font-medium">Próximo seguimiento<DatePicker name="nextFollowUp" defaultValue={caseFile.next_follow_up ?? ""} min={caseFile.today} className="mt-1" label="Elegir la fecha del próximo seguimiento" /></label>
          : <label className="text-sm font-medium">Motivo del cierre<input name="closedReason" required minLength={3} maxLength={500} placeholder="Ej.: pagó la totalidad de la deuda" className={`${field} h-11`} /></label>}
      </div>
      <div className="flex flex-wrap items-center gap-3"><Button size="sm" disabled={savingCase}>{savingCase ? "Guardando…" : status === "closed" ? "Cerrar expediente" : "Guardar"}</Button><Result state={caseState} /></div>
    </form>

    <div className="grid gap-3">
      <p className="font-medium">Compromisos de pago</p>
      {caseFile.commitments.length ? <ul className="grid gap-2">{caseFile.commitments.map((item) => <CommitmentRow key={item.id} propertyId={propertyId} unitId={unitId} item={item} today={caseFile.today} />)}</ul> : <p className="text-sm text-muted-foreground">Sin compromisos todavía.</p>}
      <details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Registrar compromiso</summary>
        <form onSubmit={commitAction} className="mt-3 grid gap-3 sm:grid-cols-3"><Ids propertyId={propertyId} unitId={unitId} /><input type="hidden" name="caseId" value={caseFile.id} />
          <label className="text-sm font-medium">Valor (COP)<input name="amount" type="number" min={1} step={1} required className={`${field} h-11`} /></label>
          <label className="text-sm font-medium">Fecha de pago<DatePicker name="dueOn" required min={caseFile.today} className="mt-1" label="Elegir la fecha del compromiso" /></label>
          <label className="text-sm font-medium">Nota (opcional)<input name="note" maxLength={500} placeholder="Ej.: paga en dos partes" className={`${field} h-11`} /></label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-3"><Button size="sm" disabled={savingCommit}>{savingCommit ? "Guardando…" : "Registrar compromiso"}</Button><Result state={commitState} /></div>
        </form></details>
    </div>

    <div className="grid gap-3">
      <p className="font-medium">Gestiones</p>
      <details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Registrar gestión</summary>
        <form onSubmit={actionAction} className="mt-3 grid gap-3 sm:grid-cols-2"><Ids propertyId={propertyId} unitId={unitId} /><input type="hidden" name="caseId" value={caseFile.id} />
          <label className="text-sm font-medium">Tipo<select name="kind" required defaultValue="call" className={`${field} h-11`}>{["call", "email", "whatsapp", "visit", "note"].map((value) => <option key={value} value={value}>{caseActionLabels[value]}</option>)}</select></label>
          <label className="text-sm font-medium">Fecha<DatePicker name="occurredOn" required defaultValue={caseFile.today} max={caseFile.today} className="mt-1" label="Elegir la fecha de la gestión" /></label>
          <label className="text-sm font-medium sm:col-span-2">Resumen<textarea name="summary" required minLength={2} maxLength={2000} rows={3} placeholder="Ej.: se habló con la propietaria, pagará el viernes" className={`${field} py-2`} /></label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><Button size="sm" disabled={savingAction}>{savingAction ? "Guardando…" : "Registrar gestión"}</Button><Result state={actionState} /></div>
        </form></details>
      {caseFile.actions.length ? <ol className="grid gap-2">{caseFile.actions.map((item) => <li key={item.id} className="rounded-xl border p-3 text-sm">
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-foreground">{caseActionLabels[item.kind] ?? item.kind}</span>{formatDay(item.occurred_on)}</p>
        <p className="mt-1 whitespace-pre-line break-words">{item.summary}</p>
      </li>)}</ol> : <p className="text-sm text-muted-foreground">Sin gestiones todavía.</p>}
    </div>
  </div>;
}

function CommitmentRow({ propertyId, unitId, item, today }: { propertyId: string; unitId: string; item: CaseFile["commitments"][number]; today: string }) {
  const [state, action, pending] = useFormActionState(setLegalCommitmentStatus, undefined as CollectionNoticeState);
  const late = item.status === "pending" && item.due_on < today;
  return <li className={`grid gap-2 rounded-xl border p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center ${item.status === "broken" || late ? "border-urgent/40 bg-urgent/5" : item.status === "met" ? "border-primary/40 bg-primary/5" : ""}`}>
    <div><p className="font-medium">{formatCop(item.amount)} · {formatDay(item.due_on)}{late ? " · vencido" : ""}</p>{item.note && <p className="text-muted-foreground">{item.note}</p>}</div>
    {item.status === "pending" ? <form onSubmit={action} className="flex flex-wrap items-center gap-2"><Ids propertyId={propertyId} unitId={unitId} /><input type="hidden" name="commitmentId" value={item.id} />
      <Button size="sm" variant="outline" name="status" value="met" disabled={pending}>Cumplido</Button><Button size="sm" variant="outline" name="status" value="broken" disabled={pending}>Incumplido</Button><Result state={state} /></form>
      : <span className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${item.status === "met" ? "bg-primary/12 text-primary" : "bg-urgent/10 text-urgent"}`}>{commitmentLabels[item.status]}</span>}
  </li>;
}
