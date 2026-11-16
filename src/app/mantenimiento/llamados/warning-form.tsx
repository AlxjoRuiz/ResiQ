"use client";

import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { DatePicker } from "@/components/ui/date-picker";
import { useState } from "react";
import { useFormActionState } from "@/lib/forms/use-form-action-state";
import { LegalFilesField, withFiles } from "@/components/legal/legal-files-field";
import { createWarning, deleteWarning, removeWarningAttachment, updateWarning, type WarningState } from "./actions";

type WarningAttachment = { id: string; name: string };

const field = "mt-1 h-11 w-full rounded-lg border bg-white px-3 text-sm";

// Admin: nuevo llamado de atención. La fecha arranca en hoy y no puede ser futura.
export function NewWarningForm({ workers, today }: { workers: { staffId: string; name: string }[]; today: string }) {
  // Documentos (13/11/2026): el mismo selector de adjuntos del resto de ResiQ.
  const [files, setFiles] = useState<File[]>([]);
  const [state, action, pending] = useFormActionState(async (previous: WarningState, data: FormData) => {
    const result = await createWarning(previous, withFiles(data, files));
    if (!result?.error) setFiles([]);
    return result;
  }, undefined as WarningState);
  if (!workers.length) return <p className="text-sm text-muted-foreground">Primero registra trabajadores en «Trabajadores».</p>;
  return <form onSubmit={action} className="grid gap-4 sm:grid-cols-2">
    <label className="text-sm font-medium">Trabajador<select name="staffId" required defaultValue="" className={field}><option value="" disabled>Elige un trabajador</option>{workers.map((worker) => <option key={worker.staffId} value={worker.staffId}>{worker.name}</option>)}</select></label>
    <label className="text-sm font-medium">Fecha<DatePicker name="date" required defaultValue={today} max={today} /></label>
    <label className="text-sm font-medium sm:col-span-2">Motivo<input name="reason" required minLength={3} maxLength={120} placeholder="Ej.: Llegada tarde" className={field} /></label>
    <label className="text-sm font-medium sm:col-span-2">Descripción<textarea name="description" required minLength={3} maxLength={2000} rows={4} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" /></label>
    <div className="sm:col-span-2"><LegalFilesField files={files} onChange={setFiles} disabled={pending} /></div>
    <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><Button disabled={pending}>{pending ? "Registrando…" : "Registrar llamado"}</Button>{state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}{state?.success && <p role="status" className="text-sm text-primary">{state.success}</p>}</div>
  </form>;
}

// Admin: editar o borrar un llamado ya registrado (13/11/2026). Borrar pide confirmación con el aviso rojo común (15/11/2026).
function RemoveAttachment({ attachment }: { attachment: WarningAttachment }) {
  const [state, action, pending] = useFormActionState(removeWarningAttachment, undefined as WarningState);
  return <form onSubmit={action} className="flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2 text-sm"><input type="hidden" name="attachmentId" value={attachment.id} />
    <span className="flex min-w-0 items-center gap-2 text-primary"><Paperclip size={14} className="shrink-0" aria-hidden="true" /><span className="break-all">{attachment.name}</span></span>
    <span className="flex shrink-0 items-center gap-2">{state?.error && <span role="alert" className="text-xs text-destructive">{state.error}</span>}<ConfirmButton disabled={pending} title="Quitar documento" message={<>¿Desea quitar el documento «{attachment.name}» de este llamado de atención? El trabajador dejará de verlo.</>} confirmLabel="Sí, quitar">{pending ? "Quitando…" : "Quitar"}</ConfirmButton></span>
  </form>;
}

export function WarningAdminActions({ warning, today, attachments = [] }: { warning: { id: string; date: string; reason: string; description: string }; today: string; attachments?: WarningAttachment[] }) {
  const [mode, setMode] = useState<"none" | "edit">("none");
  const [files, setFiles] = useState<File[]>([]);
  const [editState, edit, saving] = useFormActionState(async (previous: WarningState, data: FormData) => {
    const result = await updateWarning(previous, withFiles(data, files));
    // Al guardar (14/11/2026) se cierra la edición y el aviso queda junto a «Editar».
    if (!result?.error) { setFiles([]); setMode("none"); }
    return result;
  }, undefined as WarningState);
  const [deleteState, remove, deleting] = useFormActionState(deleteWarning, undefined as WarningState);
  return <div className="mt-4 border-t pt-3">
    {mode === "none" && <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setMode("edit")}>Editar</Button><form onSubmit={remove}><input type="hidden" name="warningId" value={warning.id} /><ConfirmButton className="text-destructive" disabled={deleting} title="Borrar llamado de atención" message="¿Desea borrar este llamado de atención? El trabajador ya no lo verá y esta acción no se puede deshacer." confirmLabel="Sí, borrar">{deleting ? "Borrando…" : "Borrar"}</ConfirmButton></form>{deleteState?.error && <p role="alert" className="self-center text-sm text-destructive">{deleteState.error}</p>}{editState?.success && <p role="status" className="self-center text-sm text-primary">{editState.success}</p>}</div>}
    {/* Edición en un recuadro (14/11/2026): primero los documentos cargados (cada uno con «Quitar»), después los datos. */}
    {mode === "edit" && <div className="grid gap-4 rounded-xl border bg-secondary/30 p-4">
      <p className="text-sm font-semibold text-primary">Editar llamado</p>
      {attachments.length > 0 && <div className="grid gap-2"><p className="text-sm font-medium">Documentos cargados</p>{attachments.map((attachment) => <RemoveAttachment key={attachment.id} attachment={attachment} />)}</div>}
      <form onSubmit={edit} className="grid gap-4 sm:grid-cols-2"><input type="hidden" name="warningId" value={warning.id} />
        <label className="text-sm font-medium">Fecha<DatePicker name="date" required defaultValue={warning.date} max={today} /></label>
        <label className="text-sm font-medium">Motivo<input name="reason" required minLength={3} maxLength={120} defaultValue={warning.reason} className={field} /></label>
        <label className="text-sm font-medium sm:col-span-2">Descripción<textarea name="description" required minLength={3} maxLength={2000} rows={4} defaultValue={warning.description} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" /></label>
        <div className="sm:col-span-2"><LegalFilesField files={files} onChange={setFiles} disabled={saving} /></div>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2"><Button size="sm" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</Button><Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => setMode("none")}>Cancelar</Button>{editState?.error && <p role="alert" className="text-sm text-destructive">{editState.error}</p>}</div>
      </form>
    </div>}
  </div>;
}
