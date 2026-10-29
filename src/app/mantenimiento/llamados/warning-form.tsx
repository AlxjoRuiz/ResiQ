"use client";

import { Button } from "@/components/ui/button";
import { useFormActionState } from "@/lib/forms/use-form-action-state";
import { createWarning, type WarningState } from "./actions";

const field = "mt-1 h-11 w-full rounded-lg border bg-white px-3 text-sm";

// Admin: nuevo llamado de atención. La fecha arranca en hoy y no puede ser futura.
export function NewWarningForm({ workers, today }: { workers: { staffId: string; name: string }[]; today: string }) {
  const [state, action, pending] = useFormActionState(createWarning, undefined as WarningState);
  if (!workers.length) return <p className="text-sm text-muted-foreground">Primero registra trabajadores en «Trabajadores».</p>;
  return <form onSubmit={action} className="grid gap-4 sm:grid-cols-2">
    <label className="text-sm font-medium">Trabajador<select name="staffId" required defaultValue="" className={field}><option value="" disabled>Elige un trabajador</option>{workers.map((worker) => <option key={worker.staffId} value={worker.staffId}>{worker.name}</option>)}</select></label>
    <label className="text-sm font-medium">Fecha<input name="date" type="date" required defaultValue={today} max={today} className={field} /></label>
    <label className="text-sm font-medium sm:col-span-2">Motivo<input name="reason" required minLength={3} maxLength={120} placeholder="Ej.: Llegada tarde" className={field} /></label>
    <label className="text-sm font-medium sm:col-span-2">Descripción<textarea name="description" required minLength={3} maxLength={2000} rows={4} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" /></label>
    <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><Button disabled={pending}>{pending ? "Registrando…" : "Registrar llamado"}</Button>{state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}{state?.success && <p role="status" className="text-sm text-primary">{state.success}</p>}</div>
  </form>;
}
