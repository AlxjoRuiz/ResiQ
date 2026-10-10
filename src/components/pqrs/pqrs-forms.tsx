"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { pqrsCategories, pqrsRequestTypes, pqrsStatuses } from "@/lib/pqrs/constants";
import { addPqrsMessage, changePqrsStatus, createPqrs, type PqrsState } from "@/app/panel/propiedades/[propertyId]/pqrs/actions";

const inputClass = "mt-2 h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const areaClass = "mt-2 min-h-32 w-full rounded-lg border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "block text-sm font-medium";

function Result({ state }: { state: PqrsState }) {
  if (state?.error) return <p role="alert" className="text-sm text-destructive">{state.error}</p>;
  if (state?.success) return <p role="status" className="text-sm text-primary">{state.success}</p>;
  return null;
}

export function CreatePqrsForm({ propertyId, units }: { propertyId: string; units: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState(createPqrs, undefined as PqrsState);
  return <form action={action} className="grid gap-5">
    <input type="hidden" name="propertyId" value={propertyId} />
    <label className={labelClass}>Apartamento<select className={inputClass} name="unitId" defaultValue="" required><option value="" disabled>Selecciona</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label>
    <label className={labelClass}>Tipo de solicitud<select className={inputClass} name="requestType" defaultValue="" required><option value="" disabled>Selecciona qué deseas presentar</option>{pqrsRequestTypes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label className={labelClass}>Categoría del tema<select className={inputClass} name="category" defaultValue="" required><option value="" disabled>Selecciona el tema</option>{pqrsCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className={labelClass}>Asunto<input className={inputClass} name="subject" required minLength={4} maxLength={140} placeholder="Describe brevemente tu solicitud" /></label>
    <label className={labelClass}>Descripción<textarea className={areaClass} name="description" required minLength={10} maxLength={5000} placeholder="Incluye la información necesaria para atender tu solicitud." /></label>
    <p className="text-xs text-muted-foreground">Primero crea la PQRS. En la página siguiente podrás seleccionar y subir hasta 5 archivos PDF, JPG o PNG.</p>
    <div className="flex items-center gap-4"><Button disabled={pending}>{pending ? "Creando…" : "Crear PQRS"}</Button><Result state={state} /></div>
  </form>;
}

export function PqrsMessageForm({ propertyId, pqrsId }: { propertyId: string; pqrsId: string }) {
  const [state, action, pending] = useActionState(addPqrsMessage, undefined as PqrsState);
  return <form action={action} className="grid gap-3">
    <input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="pqrsId" value={pqrsId} />
    <label className={labelClass}>Nueva respuesta<textarea className={areaClass} name="body" required maxLength={5000} placeholder="Escribe tu respuesta" /></label>
    <div className="flex items-center gap-4"><Button disabled={pending}>{pending ? "Enviando…" : "Enviar respuesta"}</Button><Result state={state} /></div>
  </form>;
}

export function PqrsStatusForm({ propertyId, pqrsId, currentStatus }: { propertyId: string; pqrsId: string; currentStatus: string }) {
  const [state, action, pending] = useActionState(changePqrsStatus, undefined as PqrsState);
  return <form action={action} className="flex flex-wrap items-end gap-3">
    <input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="pqrsId" value={pqrsId} />
    <label className={labelClass}>Estado<select className={`${inputClass} min-w-44`} name="status" defaultValue={currentStatus}>{pqrsStatuses.slice(1).map(([value, label]) => <option key={value} value={value} disabled={value === currentStatus}>{label}</option>)}</select></label>
    <Button variant="outline" disabled={pending}>{pending ? "Actualizando…" : "Actualizar estado"}</Button><Result state={state} />
  </form>;
}

type PreparedUpload = { documentId: string; path: string; token: string };

export function AttachmentUpload({ pqrsId, availableSlots }: { pqrsId: string; availableSlots: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [refreshing, startRefresh] = useTransition();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  async function upload() {
    const files = selectedFiles;
    if (!files.length || files.length > availableSlots) return setMessage(`Selecciona entre 1 y ${availableSlots} archivo(s).`);
    setBusy(true); setMessage(undefined);
    try {
      for (const file of files) {
        const preparedResponse = await fetch("/api/pqrs/attachments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "prepare", pqrsId, name: file.name, mimeType: file.type, size: file.size }) });
        const prepared = await preparedResponse.json() as PreparedUpload & { error?: string };
        if (!preparedResponse.ok) throw new Error(prepared.error ?? "No se pudo preparar el archivo.");
        const supabase = createClient();
        const { error: uploadError } = await supabase.storage.from("private-documents").uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
        if (uploadError) throw new Error("No se pudo subir el archivo.");
        const completedResponse = await fetch("/api/pqrs/attachments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "finalize", documentId: prepared.documentId }) });
        const completed = await completedResponse.json() as { error?: string };
        if (!completedResponse.ok) throw new Error(completed.error ?? "El archivo no superó la validación.");
      }
      if (inputRef.current) inputRef.current.value = "";
      setMessage("Adjunto cargado y validado.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo cargar el archivo."); }
    finally { if (inputRef.current) inputRef.current.value = ""; setSelectedFiles([]); startRefresh(() => router.refresh()); setBusy(false); }
  }

  if (availableSlots < 1) return <div className="grid gap-3"><p className="text-sm text-muted-foreground">Ya alcanzaste el máximo de 5 adjuntos. Los archivos pendientes o rechazados mantienen su cupo hasta que se complete su limpieza.</p>{message && <p role="status" className="text-sm">{message}</p>}</div>;
  return <div className="grid gap-3"><p className="text-sm font-medium">Adjuntar archivos</p><input ref={inputRef} type="file" multiple accept="application/pdf,image/jpeg,image/png" disabled={busy || refreshing} className="sr-only" onChange={(event) => { setSelectedFiles(Array.from(event.target.files ?? [])); setMessage(undefined); }} /><div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy || refreshing}>1. Seleccionar archivos</Button><span className="text-sm text-muted-foreground" aria-live="polite">{selectedFiles.length ? selectedFiles.map((file) => file.name).join(", ") : "Ningún archivo seleccionado"}</span></div><p className="text-xs text-muted-foreground">Máximo {availableSlots} archivo(s) restante(s), 10 MB cada uno. Solo PDF, JPG y PNG.</p><div className="flex items-center gap-4"><Button type="button" onClick={upload} disabled={busy || refreshing || selectedFiles.length === 0 || selectedFiles.length > availableSlots}>{busy || refreshing ? "Validando…" : "2. Subir adjuntos"}</Button>{message && <p role="status" className="text-sm">{message}</p>}</div></div>;
}
