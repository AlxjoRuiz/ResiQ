"use client";

import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { changeAttentionCallStatus, createAttentionCall, markAttentionCallRead, type AttentionCallState } from "@/app/panel/propiedades/[propertyId]/llamados/actions";
import { Button } from "@/components/ui/button";
import { attentionCallCategories } from "@/lib/attention-calls/constants";
import { createClient } from "@/lib/supabase/client";

export type AttentionDirectoryRow = { unit_id: string; unit_code: string; building_name: string; member_id: string | null; display_name: string | null };
const inputClass = "mt-2 h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const areaClass = "mt-2 min-h-32 w-full rounded-lg border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "block text-sm font-medium";
function Result({ state }: { state: AttentionCallState }) { if (state?.error) return <p role="alert" className="text-sm text-destructive">{state.error}</p>; if (state?.success) return <p role="status" className="text-sm text-primary">{state.success}</p>; return null; }

export function CreateAttentionCallForm({ propertyId, directory }: { propertyId: string; directory: AttentionDirectoryRow[] }) {
  const [state, action, pending] = useActionState(createAttentionCall, undefined as AttentionCallState);
  const [unitId, setUnitId] = useState("");
  const units = useMemo(() => Array.from(new Map(directory.map((row) => [row.unit_id, { id: row.unit_id, label: `${row.building_name} · ${row.unit_code}` }])).values()), [directory]);
  const members = directory.filter((row) => row.unit_id === unitId && row.member_id && row.display_name);
  return <form action={action} className="grid gap-5">
    <input type="hidden" name="propertyId" value={propertyId} />
    <label className={labelClass}>Apartamento<select className={inputClass} name="unitId" value={unitId} onChange={(event) => setUnitId(event.target.value)} required><option value="" disabled>Selecciona</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label>
    <fieldset className="rounded-xl border p-4"><legend className="px-2 text-sm font-medium">Destinatarios explícitos</legend>{!unitId ? <p className="text-sm text-muted-foreground">Selecciona primero el apartamento.</p> : members.length ? <div className="grid gap-3">{members.map((member) => <label key={member.member_id!} className="flex items-center gap-3 text-sm"><input type="checkbox" name="recipientIds" value={member.member_id!} className="size-4 accent-primary" />{member.display_name}</label>)}</div> : <p className="text-sm text-muted-foreground">Este apartamento no tiene miembros vigentes.</p>}</fieldset>
    <div className="grid gap-5 sm:grid-cols-2"><label className={labelClass}>Categoría<select className={inputClass} name="category" defaultValue="coexistence">{attentionCallCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className={labelClass}>Fecha<input className={inputClass} type="date" name="issuedOn" defaultValue={new Date().toISOString().slice(0, 10)} required /></label></div>
    <label className={labelClass}>Motivo<input className={inputClass} name="reason" minLength={4} maxLength={180} required placeholder="Resumen concreto del llamado" /></label>
    <label className={labelClass}>Descripción<textarea className={areaClass} name="description" minLength={10} maxLength={5000} required placeholder="Describe los hechos con información verificable." /></label>
    <p className="text-xs text-muted-foreground">Después de crear el llamado podrás adjuntar hasta cinco evidencias PDF, JPG o PNG.</p>
    <div className="flex items-center gap-4"><Button disabled={pending || !unitId || members.length === 0}>{pending ? "Creando…" : "Crear llamado"}</Button><Result state={state} /></div>
  </form>;
}

export function AttentionCallStatusForm({ propertyId, attentionCallId, currentStatus }: { propertyId: string; attentionCallId: string; currentStatus: string }) {
  const [state, action, pending] = useActionState(changeAttentionCallStatus, undefined as AttentionCallState);
  const target = currentStatus === "notified" ? "in_review" : currentStatus === "in_review" ? "closed" : null;
  if (!target) return null;
  return <form action={action} className="grid gap-4"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="attentionCallId" value={attentionCallId} /><input type="hidden" name="status" value={target} />{target === "closed" && <label className={labelClass}>Nota de cierre<textarea className={areaClass} name="note" minLength={4} maxLength={1000} required placeholder="Explica cómo terminó el caso." /></label>}<div className="flex items-center gap-4"><Button variant="outline" disabled={pending}>{pending ? "Actualizando…" : target === "closed" ? "Cerrar llamado" : "Iniciar revisión"}</Button><Result state={state} /></div></form>;
}

export function MarkAttentionCallRead({ propertyId, attentionCallId, alreadyRead }: { propertyId: string; attentionCallId: string; alreadyRead: boolean }) {
  useEffect(() => { if (!alreadyRead) startTransition(() => { void markAttentionCallRead(propertyId, attentionCallId); }); }, [alreadyRead, attentionCallId, propertyId]);
  return null;
}

type PreparedUpload = { documentId: string; path: string; token: string };
export function AttentionCallAttachmentUpload({ attentionCallId, availableSlots }: { attentionCallId: string; availableSlots: number }) {
  const router = useRouter(); const inputRef = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string>();
  async function upload() {
    const files = Array.from(inputRef.current?.files ?? []); if (!files.length || files.length > availableSlots) return setMessage(`Selecciona entre 1 y ${availableSlots} archivo(s).`);
    setBusy(true); setMessage(undefined);
    try { for (const file of files) { const preparedResponse = await fetch("/api/attention-calls/attachments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "prepare", attentionCallId, name: file.name, mimeType: file.type, size: file.size }) }); const prepared = await preparedResponse.json() as PreparedUpload & { error?: string }; if (!preparedResponse.ok) throw new Error(prepared.error ?? "No se pudo preparar el archivo."); const supabase = createClient(); const { error: uploadError } = await supabase.storage.from("private-documents").uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type }); if (uploadError) throw new Error("No se pudo subir el archivo."); const completedResponse = await fetch("/api/attention-calls/attachments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "finalize", documentId: prepared.documentId }) }); const completed = await completedResponse.json() as { error?: string }; if (!completedResponse.ok) throw new Error(completed.error ?? "El archivo no superó la validación."); } if (inputRef.current) inputRef.current.value = ""; setMessage("Evidencia cargada y validada."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo cargar el archivo."); } finally { setBusy(false); }
  }
  if (availableSlots < 1) return <p className="text-sm text-muted-foreground">Ya se alcanzó el máximo de cinco evidencias.</p>;
  return <div className="grid gap-3"><input ref={inputRef} type="file" multiple accept="application/pdf,image/jpeg,image/png" disabled={busy} className="block w-full text-sm" /><p className="text-xs text-muted-foreground">Máximo {availableSlots} archivo(s) restante(s), 10 MB cada uno.</p><div className="flex items-center gap-4"><Button type="button" variant="outline" onClick={upload} disabled={busy}>{busy ? "Validando…" : "Subir evidencias"}</Button>{message && <p role="status" className="text-sm">{message}</p>}</div></div>;
}
