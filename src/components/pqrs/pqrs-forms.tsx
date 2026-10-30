"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useFormActionState } from "@/lib/forms/use-form-action-state";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
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
  const [state, action, pending] = useFormActionState(createPqrs, undefined as PqrsState);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const handledCreation = useRef(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string>();

  useEffect(() => {
    if (!state?.createdId || handledCreation.current) return;
    handledCreation.current = true;
    const detailUrl = `/panel/propiedades/${propertyId}/pqrs/${state.createdId}`;
    if (!selectedFiles.length) { router.replace(`${detailUrl}?created=1`); return; }
    void uploadPqrsFiles(state.createdId, selectedFiles)
      .then(() => router.replace(`${detailUrl}?created=1`))
      .catch((error: unknown) => setFileError(`La PQRS se creó, pero no se pudo adjuntar el archivo: ${error instanceof Error ? error.message : "Error desconocido."} Abre la solicitud para intentarlo de nuevo.`));
  }, [propertyId, router, selectedFiles, state?.createdId]);

  return <form className="grid gap-5" onSubmit={(event) => {
    if (selectedFiles.length > 5 || selectedFiles.some((file) => !["application/pdf", "image/jpeg", "image/png"].includes(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024 || file.name.length > 180)) {
      event.preventDefault();
      setFileError("Selecciona hasta 5 archivos PDF, JPG o PNG de máximo 10 MB cada uno.");
      return;
    }
    action(event);
  }}>
    <input type="hidden" name="propertyId" value={propertyId} />
    <label className={labelClass}>Apartamento<select className={inputClass} name="unitId" defaultValue="" required><option value="" disabled>Selecciona</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label>
    <label className={labelClass}>Tipo de solicitud<select className={inputClass} name="requestType" defaultValue="" required><option value="" disabled>Selecciona el tipo</option>{pqrsRequestTypes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label className={labelClass}>Categoría del tema<select className={inputClass} name="category" defaultValue="" required><option value="" disabled>Selecciona el tema</option>{pqrsCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className={labelClass}>Asunto<input className={inputClass} name="subject" required minLength={4} maxLength={140} placeholder="Describe brevemente tu solicitud" /></label>
    <label className={labelClass}>Descripción<textarea className={areaClass} name="description" required minLength={10} maxLength={5000} placeholder="Incluye la información necesaria para atender tu solicitud." /></label>
    <div className="grid gap-2"><p className="text-sm font-medium">Adjuntos opcionales</p><FilePicker inputRef={inputRef} files={selectedFiles} onFilesChange={(files) => { setSelectedFiles(files); setFileError(undefined); }} title="Adjuntos" hint="Hasta 5 archivos PDF, JPG o PNG · 10 MB cada uno" multiple maxFiles={5} disabled={pending || Boolean(state?.createdId)} /><p className="text-xs text-muted-foreground">Se subirán al crear la PQRS.</p></div>
    <div className="flex flex-wrap items-center gap-4"><Button disabled={pending || Boolean(state?.createdId)}>{pending ? "Creando…" : state?.createdId ? selectedFiles.length ? "Subiendo adjuntos…" : "Abriendo PQRS…" : "Crear PQRS"}</Button><Result state={state} />{fileError && <p role="alert" className="text-sm text-destructive">{fileError}</p>}{state?.createdId && fileError && <a href={`/panel/propiedades/${propertyId}/pqrs/${state.createdId}?retryUpload=1`} className="text-sm font-medium text-primary underline">Abrir PQRS creada</a>}</div>
  </form>;
}

// Respuesta en la conversación con adjuntos opcionales: se envía el mensaje y luego se suben
// sus archivos (hasta 5 por mensaje), con la misma carga validada de la solicitud inicial.
export function PqrsMessageForm({ propertyId, pqrsId }: { propertyId: string; pqrsId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null), inputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<"idle" | "sending" | "uploading">("idle");
  const [state, setState] = useState<PqrsState>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status !== "idle") return;
    if (selectedFiles.length > 5 || selectedFiles.some((file) => !["application/pdf", "image/jpeg", "image/png"].includes(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024 || file.name.length > 180)) return setState({ error: "Selecciona hasta 5 archivos PDF, JPG o PNG de máximo 10 MB cada uno." });
    setStatus("sending"); setState(undefined);
    const result = await addPqrsMessage(undefined, new FormData(event.currentTarget));
    if (!result?.messageId) { setState(result); setStatus("idle"); return; }
    formRef.current?.reset();
    if (selectedFiles.length) {
      setStatus("uploading");
      try { await uploadPqrsFiles(pqrsId, selectedFiles, result.messageId); setState(result); }
      catch (error) { setState({ error: `La respuesta se envió, pero no se pudo adjuntar el archivo: ${error instanceof Error ? error.message : "Error desconocido."}` }); }
      setSelectedFiles([]); if (inputRef.current) inputRef.current.value = "";
    } else setState(result);
    setStatus("idle");
    router.refresh();
  }

  const busy = status !== "idle";
  return <form ref={formRef} onSubmit={submit} className="grid gap-3">
    <input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="pqrsId" value={pqrsId} />
    <label className={labelClass}>Nueva respuesta<textarea className={areaClass} name="body" required maxLength={5000} placeholder="Escribe tu respuesta" disabled={busy} /></label>
    <FilePicker inputRef={inputRef} files={selectedFiles} onFilesChange={(files) => { setSelectedFiles(files); setState(undefined); }} title="Adjuntos" hint="Opcional · hasta 5 archivos PDF, JPG o PNG · 10 MB cada uno" multiple maxFiles={5} disabled={busy} />
    <div className="flex flex-wrap items-center gap-4"><Button disabled={busy}>{status === "sending" ? "Enviando…" : status === "uploading" ? "Subiendo adjuntos…" : "Enviar respuesta"}</Button><Result state={state} /></div>
  </form>;
}

export function PqrsStatusForm({ propertyId, pqrsId, currentStatus }: { propertyId: string; pqrsId: string; currentStatus: string }) {
  const [state, action, pending] = useFormActionState(changePqrsStatus, undefined as PqrsState);
  return <form onSubmit={action} className="flex flex-wrap items-end gap-3">
    <input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="pqrsId" value={pqrsId} />
    <label className={labelClass}>Estado<select className={`${inputClass} min-w-44`} name="status" defaultValue={currentStatus}>{pqrsStatuses.slice(1).map(([value, label]) => <option key={value} value={value} disabled={value === currentStatus}>{label}</option>)}</select></label>
    <Button variant="outline" disabled={pending}>{pending ? "Actualizando…" : "Actualizar estado"}</Button><Result state={state} />
  </form>;
}

type PreparedUpload = { documentId: string; path: string; token: string };

async function uploadPqrsFiles(pqrsId: string, files: File[], messageId?: string) {
  for (const file of files) {
    const preparedResponse = await fetch("/api/pqrs/attachments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "prepare", pqrsId, messageId, name: file.name, mimeType: file.type, size: file.size }) });
    const prepared = await preparedResponse.json() as PreparedUpload & { error?: string };
    if (!preparedResponse.ok) throw new Error(prepared.error ?? "No se pudo preparar el archivo.");
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage.from("private-documents").uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
    if (uploadError) throw new Error("No se pudo subir el archivo.");
    const completedResponse = await fetch("/api/pqrs/attachments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "finalize", documentId: prepared.documentId }) });
    const completed = await completedResponse.json() as { error?: string };
    if (!completedResponse.ok) throw new Error(completed.error ?? "El archivo no superó la validación.");
  }
}

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
      await uploadPqrsFiles(pqrsId, files);
      if (inputRef.current) inputRef.current.value = "";
      setMessage("Adjunto cargado y validado.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo cargar el archivo."); }
    finally { if (inputRef.current) inputRef.current.value = ""; setSelectedFiles([]); startRefresh(() => router.refresh()); setBusy(false); }
  }

  if (availableSlots < 1) return <div className="grid gap-3"><p className="text-sm text-muted-foreground">Ya alcanzaste el máximo de 5 adjuntos. Los archivos pendientes o rechazados mantienen su cupo hasta que se complete su limpieza.</p>{message && <p role="status" className="text-sm">{message}</p>}</div>;
  return <div className="grid gap-3"><p className="text-sm font-medium">Adjuntar archivos</p><FilePicker inputRef={inputRef} files={selectedFiles} onFilesChange={(files) => { setSelectedFiles(files); setMessage(undefined); }} title="Adjuntos" hint={`Hasta ${availableSlots} archivos PDF, JPG o PNG · 10 MB cada uno`} multiple maxFiles={availableSlots} disabled={busy || refreshing} /><div className="flex items-center gap-4"><Button type="button" onClick={upload} disabled={busy || refreshing || selectedFiles.length === 0 || selectedFiles.length > availableSlots}>{busy || refreshing ? "Validando…" : "Subir adjuntos"}</Button>{message && <p role="status" className="text-sm">{message}</p>}</div></div>;
}
