"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { changeAssemblyStatus, createAssembly, publishAssembly, recordAssemblyAttendance, reviewAssemblyRepresentation, setAssemblyRsvp, submitAssemblyRepresentation, updateAssembly, type AssemblyActionState } from "@/app/panel/propiedades/[propertyId]/asambleas/actions";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { assemblyTypes } from "@/lib/assemblies/constants";
import { createClient } from "@/lib/supabase/client";
import { dateTimeInputValue } from "@/lib/time-zone";

export type AssemblyDirectoryRow = { unit_id: string; unit_code: string; building_name: string; member_id: string; display_name: string };
const inputClass = "mt-2 h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const areaClass = "mt-2 min-h-28 w-full rounded-lg border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "block text-sm font-medium";
function Result({ state }: { state: AssemblyActionState }) { if (state?.error) return <p role="alert" className="text-sm text-destructive">{state.error}</p>; if (state?.success) return <p role="status" className="text-sm text-primary">{state.success}</p>; return null; }

export function CreateAssemblyForm({ propertyId, directory, timeZone }: { propertyId: string; directory: AssemblyDirectoryRow[]; timeZone: string }) {
  const router = useRouter(), documentsRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(crypto.randomUUID());
  const [documents, setDocuments] = useState<File[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string>();
  const grouped = useMemo(() => Array.from(new Map(directory.map((row) => [row.unit_id, { unitId: row.unit_id, label: `${row.building_name} · ${row.unit_code}`, members: directory.filter((item) => item.unit_id === row.unit_id) }])).values()), [directory]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (documents.length < 1 || documents.length > 5) return setError("Selecciona entre uno y cinco archivos. El primero será la convocatoria.");
    const files = documents.map((file, index) => ({ file, kind: index === 0 ? "convocation" : "support" }));
    if (files.some(({ file }) => !["application/pdf", "image/jpeg", "image/png"].includes(file.type) || !file.name.trim() || file.name.length > 180 || file.size < 1 || file.size > 10 * 1024 * 1024)) return setError("Los documentos deben ser PDF, JPG o PNG de máximo 10 MB cada uno.");
    const data = new FormData(event.currentTarget), stagedIds: string[] = [];
    data.set("requestId", requestId.current);
    setBusy(true); setError(undefined);
    try {
      const supabase = createClient();
      for (const { file, kind } of files) {
        const preparedResponse = await fetch("/api/assemblies/staged-documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "prepare", propertyId, kind, name: file.name, mimeType: file.type, size: file.size }) });
        const prepared = await preparedResponse.json() as { id?: string; path?: string; token?: string; error?: string };
        if (!preparedResponse.ok || !prepared.id || !prepared.path || !prepared.token) throw new Error(prepared.error ?? "No se pudo preparar el documento.");
        stagedIds.push(prepared.id);
        const { error: uploadError } = await supabase.storage.from("private-documents").uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
        if (uploadError) throw new Error("No se pudo subir el documento.");
        const completedResponse = await fetch("/api/assemblies/staged-documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "finalize", propertyId, id: prepared.id }) });
        const completed = await completedResponse.json() as { error?: string };
        if (!completedResponse.ok) throw new Error(completed.error ?? "No se pudo validar el documento.");
      }
      data.set("uploadIds", JSON.stringify(stagedIds));
      const result = await createAssembly(data);
      if (!result.assemblyId) throw new Error(result.error ?? "No se pudo crear la asamblea.");
      await Promise.allSettled(stagedIds.map((id) => fetch("/api/assemblies/staged-documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "discard", propertyId, id }) })));
      router.push(`/panel/propiedades/${propertyId}/asambleas/${result.assemblyId}?created=1`);
      router.refresh();
    } catch (cause) {
      await Promise.allSettled(stagedIds.map((id) => fetch("/api/assemblies/staged-documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "discard", propertyId, id }) })));
      setError(cause instanceof Error ? cause.message : "No se pudo crear la asamblea.");
    } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="grid gap-6"><input type="hidden" name="propertyId" value={propertyId} />
    <div><h2 className="text-lg font-semibold">1. Datos de la asamblea</h2><p className="mt-1 text-xs text-muted-foreground">Estos datos aparecerán en la convocatoria de los residentes.</p></div>
    <div className="grid gap-5 sm:grid-cols-2"><label className={labelClass}>Tipo<select className={inputClass} name="type" defaultValue="ordinary">{assemblyTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className={labelClass}>Fecha y hora de la comunidad<input className={`${inputClass} min-w-0 max-w-72`} type="datetime-local" name="startsAt" required /><span className="mt-1 block text-xs text-muted-foreground">{timeZone}</span></label></div>
    <label className={labelClass}>Título<input className={inputClass} name="title" minLength={4} maxLength={180} required placeholder="Asamblea general ordinaria" /></label>
    <label className={labelClass}>Lugar o enlace<input className={inputClass} name="location" minLength={3} maxLength={240} required placeholder="Salón comunal" /></label>
    <label className={labelClass}>Descripción<textarea className={areaClass} name="description" maxLength={5000} placeholder="Información adicional para los convocados." /></label>
    <label className={labelClass}><span className="text-lg font-semibold">2. Orden del día</span><textarea className={areaClass} name="agenda" required placeholder={"Escribe un punto por línea\nVerificación de asistentes\nInforme de administración\nProposiciones"} /><span className="mt-2 block text-xs text-muted-foreground">Cada línea se guardará como un punto ordenado.</span></label>
    <fieldset className="min-w-0 rounded-xl border p-4"><legend className="px-2 text-lg font-semibold">3. Convocados</legend><p className="mb-3 text-xs text-muted-foreground">Selecciona expresamente a cada residente y su apartamento.</p><div className="grid max-h-80 gap-4 overflow-y-auto">{grouped.map((unit) => <div key={unit.unitId}><p className="text-sm font-semibold">{unit.label}</p><div className="mt-2 grid gap-2">{unit.members.map((member) => <label key={member.member_id} className="flex items-center gap-3 text-sm"><input type="checkbox" name="audience" value={`${member.member_id}|${member.unit_id}`} className="size-4 accent-primary" />{member.display_name}</label>)}</div></div>)}</div>{!grouped.length && <p className="text-sm text-muted-foreground">No hay miembros con apartamentos vigentes.</p>}</fieldset>
    <section className="grid gap-4"><div><h2 className="text-lg font-semibold">4. Documentos privados</h2><p className="mt-1 text-xs text-muted-foreground">Selecciona de uno a cinco archivos. El primero será la convocatoria obligatoria; los demás serán soportes opcionales.</p></div><FilePicker inputRef={documentsRef} files={documents} onFilesChange={(files) => { setDocuments(files); setError(undefined); }} title="Elige los documentos" hint="PDF, JPG o PNG · máximo 10 MB por archivo" multiple disabled={busy}/>{documents.length > 0 && <ol className="grid gap-1 text-sm" aria-label="Orden de los documentos seleccionados">{documents.map((file, index) => <li key={`${file.name}-${index}`} className="min-w-0 break-words"><span className="font-medium">{index === 0 ? "Convocatoria" : `Soporte ${index}`}:</span> {file.name}</li>)}</ol>}</section>
    <div className="rounded-xl border bg-secondary p-4 text-sm">Al crearla, la asamblea quedará publicada y cada convocado recibirá un aviso interno. Revisa los datos antes de continuar.</div>
    <div className="flex flex-wrap items-center gap-4"><Button disabled={busy || !grouped.length}>{busy ? "Validando y publicando…" : "Crear y publicar asamblea"}</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>
  </form>;
}

function SimpleAction({ action, propertyId, assemblyId, children, hidden }: { action: (state: AssemblyActionState, data: FormData) => Promise<AssemblyActionState>; propertyId: string; assemblyId: string; children: React.ReactNode; hidden?: Record<string, string> }) {
  const [state, formAction, pending] = useActionState(action, undefined as AssemblyActionState);
  return <form action={formAction} className="grid gap-3"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="assemblyId" value={assemblyId} />{Object.entries(hidden ?? {}).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}<Button variant="outline" disabled={pending}>{pending ? "Guardando…" : children}</Button><Result state={state} /></form>;
}

export function PublishAssemblyForm(props: { propertyId: string; assemblyId: string }) { return <SimpleAction action={publishAssembly} {...props}>Publicar convocatoria</SimpleAction>; }
export function RsvpForm({ propertyId, assemblyId }: { propertyId: string; assemblyId: string }) { const [state, action, pending] = useActionState(setAssemblyRsvp, undefined as AssemblyActionState); return <form action={action} className="flex flex-wrap items-center gap-3"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="assemblyId" value={assemblyId} /><Button name="rsvp" value="yes" disabled={pending}>Asistiré</Button><Button name="rsvp" value="no" variant="outline" disabled={pending}>No asistiré</Button><Result state={state} /></form>; }

export function UpdateAssemblyForm({ propertyId, assembly, timeZone }: { propertyId: string; assembly: { id: string; title: string; description: string | null; starts_at: string; location: string }; timeZone: string }) {
  const [state, action, pending] = useActionState(updateAssembly, undefined as AssemblyActionState);
  return <form action={action} className="grid gap-4"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="assemblyId" value={assembly.id} /><label className={labelClass}>Título<input className={inputClass} name="title" defaultValue={assembly.title} required /></label><div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Fecha y hora<input className={inputClass} type="datetime-local" name="startsAt" defaultValue={dateTimeInputValue(new Date(assembly.starts_at), timeZone)} required /></label><label className={labelClass}>Lugar<input className={inputClass} name="location" defaultValue={assembly.location} required /></label></div><label className={labelClass}>Descripción<textarea className={areaClass} name="description" defaultValue={assembly.description ?? ""} /></label><div className="flex items-center gap-4"><Button variant="outline" disabled={pending}>{pending ? "Actualizando…" : "Guardar cambios"}</Button><Result state={state} /></div></form>;
}

export function AssemblyStatusForm({ propertyId, assemblyId, status }: { propertyId: string; assemblyId: string; status: string }) {
  const [state, action, pending] = useActionState(changeAssemblyStatus, undefined as AssemblyActionState); const [target, setTarget] = useState(status === "scheduled" ? "in_progress" : "finished");
  if (!new Set(["scheduled", "in_progress"]).has(status)) return null;
  return <form action={action} className="grid gap-4"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="assemblyId" value={assemblyId} /><label className={labelClass}>Acción<select className={inputClass} name="status" value={target} onChange={(event) => setTarget(event.target.value)}>{status === "scheduled" && <><option value="in_progress">Iniciar asamblea</option><option value="cancelled">Cancelar asamblea</option></>}{status === "in_progress" && <option value="finished">Finalizar asamblea</option>}</select></label>{target === "cancelled" && <label className={labelClass}>Motivo<textarea className={areaClass} name="reason" minLength={4} required /></label>}<div className="flex items-center gap-4"><Button variant="outline" disabled={pending}>{pending ? "Actualizando…" : "Aplicar cambio"}</Button><Result state={state} /></div></form>;
}

export function AttendanceForm({ propertyId, assemblyId, attendeeId, current }: { propertyId: string; assemblyId: string; attendeeId: string; current: string }) {
  const [state, action, pending] = useActionState(recordAssemblyAttendance, undefined as AssemblyActionState); const correction = current !== "pending";
  return <form action={action} className="grid gap-2 sm:grid-cols-[auto_1fr_auto]"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="assemblyId" value={assemblyId} /><input type="hidden" name="attendeeId" value={attendeeId} /><select className="h-9 rounded-lg border bg-white px-2 text-sm" name="attended" defaultValue={current === "present" ? "true" : "false"}><option value="true">Presente</option><option value="false">Ausente</option></select><input className="h-9 rounded-lg border bg-white px-2 text-sm" name="note" minLength={correction ? 4 : undefined} required={correction} placeholder={correction ? "Motivo de la corrección" : "Nota opcional"} /><Button size="sm" variant="outline" disabled={pending}>Guardar</Button><div className="sm:col-span-3"><Result state={state} /></div></form>;
}

export function RepresentationForm({ propertyId, assemblyId, units, members }: { propertyId: string; assemblyId: string; units: { id: string; label: string }[]; members: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(submitAssemblyRepresentation, undefined as AssemblyActionState); const [mode, setMode] = useState("member");
  return <form action={action} className="grid gap-4"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="assemblyId" value={assemblyId} /><label className={labelClass}>Apartamento<select className={inputClass} name="unitId" required><option value="">Selecciona</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label><label className={labelClass}>Tipo de representante<select className={inputClass} value={mode} onChange={(event) => setMode(event.target.value)}><option value="member">Miembro de la propiedad</option><option value="external">Persona externa</option></select></label>{mode === "member" ? <label className={labelClass}>Representante<select className={inputClass} name="representativeMemberId" required><option value="">Selecciona</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label> : <label className={labelClass}>Nombre completo<input className={inputClass} name="externalName" minLength={3} maxLength={120} required /></label>}<p className="text-xs text-muted-foreground">Después de guardar, adjunta el poder en PDF, JPG o PNG. La administración debe validarlo.</p><div className="flex items-center gap-4"><Button variant="outline" disabled={pending}>{pending ? "Creando…" : "Registrar representación"}</Button><Result state={state} /></div></form>;
}

export function RepresentationReviewForm({ propertyId, assemblyId, representationId, status }: { propertyId: string; assemblyId: string; representationId: string; status: string }) {
  const [state, action, pending] = useActionState(reviewAssemblyRepresentation, undefined as AssemblyActionState); const options = status === "submitted" ? [["validated", "Validar"], ["rejected", "Rechazar"]] : [["revoked", "Revocar"]];
  return <form action={action} className="grid gap-2"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="assemblyId" value={assemblyId} /><input type="hidden" name="representationId" value={representationId} /><select className="h-9 rounded-lg border bg-white px-2 text-sm" name="status">{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input className="h-9 rounded-lg border bg-white px-2 text-sm" name="note" minLength={4} required placeholder="Nota obligatoria" /><Button size="sm" variant="outline" disabled={pending}>Guardar decisión</Button><Result state={state} /></form>;
}

type PreparedUpload = { documentId: string; path: string; token: string };
export function AssemblyDocumentUpload({ assemblyId, representationId, kind, availableSlots = 5 }: { assemblyId: string; representationId?: string; kind: "convocation" | "support" | "minutes" | "representation_evidence"; availableSlots?: number }) {
  const router = useRouter(), inputRef = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(false), [message, setMessage] = useState<string>(); const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  async function upload() { const files = selectedFiles; if (!files.length || files.length > availableSlots) return setMessage(`Selecciona entre 1 y ${availableSlots} archivo(s).`); setBusy(true); setMessage(undefined); try { for (const file of files) { const response = await fetch("/api/assemblies/attachments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "prepare", assemblyId, representationId, kind, name: file.name, mimeType: file.type, size: file.size }) }); const prepared = await response.json() as PreparedUpload & { error?: string }; if (!response.ok) throw new Error(prepared.error ?? "No se pudo preparar el archivo."); const supabase = createClient(); const { error } = await supabase.storage.from("private-documents").uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type }); if (error) throw new Error("No se pudo subir el archivo."); const completedResponse = await fetch("/api/assemblies/attachments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "finalize", documentId: prepared.documentId }) }); const completed = await completedResponse.json() as { error?: string }; if (!completedResponse.ok) throw new Error(completed.error ?? "El archivo no superó la validación."); } if (inputRef.current) inputRef.current.value = ""; setSelectedFiles([]); setMessage("Documento cargado y validado."); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo cargar el archivo."); } finally { setBusy(false); } }
  if (availableSlots < 1) return <p className="text-sm text-muted-foreground">Se alcanzó el máximo de cinco archivos.</p>;
  return <div className="grid gap-3"><FilePicker inputRef={inputRef} files={selectedFiles} onFilesChange={(files) => { setSelectedFiles(files); setMessage(undefined); }} title="Elige los documentos" hint={`Hasta ${availableSlots} archivos PDF, JPG o PNG · 10 MB cada uno`} multiple disabled={busy} /><div className="flex items-center gap-3"><Button type="button" size="sm" variant="outline" onClick={upload} disabled={busy || selectedFiles.length === 0 || selectedFiles.length > availableSlots}>{busy ? "Validando…" : "Subir documentos"}</Button>{message && <p role="status" className="text-sm">{message}</p>}</div></div>;
}
