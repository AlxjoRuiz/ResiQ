"use client";

import { useActionState, useState } from "react";
import { Lock } from "lucide-react";
import { closeReportMonth, type CloseReportState } from "@/app/juridica/actions";
import { Button } from "@/components/ui/button";

// Botón para cerrar el mes (12/11/2026). Si ya está cerrado, registra una corrección con motivo (versión nueva).
export function CloseMonth({ propertyId, month, closed, monthLabel }: { propertyId: string; month: string; closed: boolean; monthLabel: string }) {
  const [state, action, pending] = useActionState(closeReportMonth, undefined as CloseReportState);
  const [open, setOpen] = useState(false);
  if (!open || state?.success) return <div className="flex flex-wrap items-center gap-2 print:hidden">
    <Button type="button" variant="outline" onClick={() => setOpen(true)}><Lock size={15} aria-hidden="true" />{closed ? "Registrar corrección" : "Cerrar mes"}</Button>
    {state?.success && <span role="status" className="text-sm text-primary">{state.success}</span>}
  </div>;
  return <form action={action} className="grid gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 print:hidden">
    <input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="month" value={month} />
    <p className="text-sm">{closed
      ? <>Vas a guardar una <strong>corrección</strong> del cierre de {monthLabel}. La versión anterior se conserva; esta será la nueva versión con los datos de hoy.</>
      : <>Vas a <strong>cerrar {monthLabel}</strong>. Se guarda el informe tal como está ahora y ya no cambiará.</>}</p>
    {closed && <label className="text-sm font-medium">Motivo de la corrección<textarea name="reason" required minLength={3} maxLength={500} rows={2} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /></label>}
    <div className="flex flex-wrap items-center gap-2">
      <Button type="submit" disabled={pending}>{pending ? "Guardando…" : closed ? "Guardar corrección" : "Cerrar mes"}</Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      {state?.error && <span role="alert" className="text-sm text-destructive">{state.error}</span>}
    </div>
  </form>;
}
