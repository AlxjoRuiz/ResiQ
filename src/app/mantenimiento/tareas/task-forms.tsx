"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFormActionState } from "@/lib/forms/use-form-action-state";
import { compressImage } from "@/lib/images/compress";
import { createTask, deleteTask, reviewTask, type TaskState } from "./actions";

const field = "mt-1 h-11 w-full rounded-lg border bg-white px-3 text-sm";

function Feedback({ state }: { state: TaskState }) {
  return <>{state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}{state?.success && <p role="status" className="text-sm text-primary">{state.success}</p>}</>;
}

// Admin: nueva tarea. El conjunto se escribe a mano; cada trabajador marcado recibe su propia copia.
export function NewTaskForm({ workers, today }: { workers: { staffId: string; name: string }[]; today: string }) {
  const [state, action, pending] = useFormActionState(createTask, undefined as TaskState);
  if (!workers.length) return <p className="text-sm text-muted-foreground">Primero registra trabajadores activos en «Trabajadores».</p>;
  return <form onSubmit={action} className="grid gap-4 sm:grid-cols-2">
    <label className="text-sm font-medium sm:col-span-2">Título<input name="title" required minLength={3} maxLength={120} className={field} /></label>
    <label className="text-sm font-medium sm:col-span-2">Descripción<textarea name="description" required minLength={3} maxLength={2000} rows={4} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" /></label>
    <label className="text-sm font-medium">Conjunto<input name="propertyName" required minLength={2} maxLength={120} placeholder="Nombre del conjunto" className={field} /></label>
    <label className="text-sm font-medium">Fecha límite<input name="dueDate" type="date" required min={today} className={field} /></label>
    <fieldset className="sm:col-span-2"><legend className="text-sm font-medium">Trabajadores</legend><p className="text-xs text-muted-foreground">Cada uno recibe su propia copia de la tarea.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">{workers.map((worker) => <label key={worker.staffId} className="flex min-h-11 items-center gap-3 rounded-lg border bg-white px-3 text-sm"><input type="checkbox" name="staffIds" value={worker.staffId} className="size-4" />{worker.name}</label>)}</div>
    </fieldset>
    <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><Button disabled={pending}>{pending ? "Asignando…" : "Asignar tarea"}</Button><Feedback state={state} /></div>
  </form>;
}

// Admin: aprobar o rechazar la entrega. Rechazar exige comentario (se valida en el servidor).
export function ReviewTaskForm({ taskId }: { taskId: string }) {
  const [state, action, pending] = useFormActionState(reviewTask, undefined as TaskState);
  return <form onSubmit={action} className="mt-4 grid gap-3 border-t pt-4"><input type="hidden" name="taskId" value={taskId} />
    <label className="text-sm font-medium">Comentario <span className="font-normal text-muted-foreground">(obligatorio si la rechazas)</span><textarea name="comment" maxLength={1000} rows={2} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" /></label>
    <div className="flex flex-wrap items-center gap-2"><Button size="sm" name="decision" value="approve" disabled={pending}>Aprobar</Button><Button size="sm" variant="outline" name="decision" value="reject" disabled={pending}>Rechazar</Button><Feedback state={state} /></div>
  </form>;
}

export function DeleteTaskForm({ taskId }: { taskId: string }) {
  const [state, action, pending] = useFormActionState(deleteTask, undefined as TaskState);
  return <form onSubmit={(event) => { if (!confirm("¿Eliminar esta tarea? Esta acción no se puede deshacer.")) { event.preventDefault(); return; } action(event); }} className="mt-3 flex flex-wrap items-center gap-3"><input type="hidden" name="taskId" value={taskId} />
    <Button size="sm" variant="ghost" className="text-destructive" disabled={pending}>Eliminar tarea</Button><Feedback state={state} />
  </form>;
}

// Trabajador: entrega con 1 a 5 fotos (cámara o galería) y una nota opcional. Las fotos se reducen en
// el celular antes de enviarlas.
export function DeliverTaskForm({ taskId, again }: { taskId: string; again: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<"reading" | "sending" | null>(null);

  async function add(list: FileList | null) {
    setError(undefined);
    const chosen = Array.from(list ?? []).slice(0, 5 - photos.length);
    if (!chosen.length) return;
    setBusy("reading");
    try {
      const reduced = await Promise.all(chosen.map((file) => compressImage(file, 1280, 0.75)));
      setPhotos((current) => [...current, ...reduced.map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, 5));
    } catch { setError("No pudimos leer una de las fotos. Tómala de nuevo."); }
    finally { setBusy(null); }
  }

  function remove(index: number) {
    setPhotos((current) => { URL.revokeObjectURL(current[index].url); return current.filter((_, position) => position !== index); });
  }

  async function send() {
    if (!photos.length) { setError("Agrega al menos una foto del trabajo terminado."); return; }
    setBusy("sending"); setError(undefined);
    const body = new FormData();
    body.set("taskId", taskId); body.set("note", note);
    photos.forEach((photo) => body.append("photos", photo.file));
    try {
      const response = await fetch("/api/maintenance/tasks", { method: "POST", body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError(result.error ?? "No pudimos entregar la tarea. Intenta de nuevo."); return; }
      photos.forEach((photo) => URL.revokeObjectURL(photo.url));
      setPhotos([]); setNote("");
      router.refresh();
    } catch { setError("Sin conexión. Revisa el internet e intenta de nuevo."); }
    finally { setBusy(null); }
  }

  return <div className="mt-4 grid gap-3 border-t pt-4">
    <p className="text-sm font-medium">{again ? "Volver a entregar" : "Entregar tarea"}</p>
    <input ref={inputRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-label="Fotos de la entrega" onChange={(event) => { void add(event.target.files); event.target.value = ""; }} />
    {photos.length > 0 && <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{photos.map((photo, index) => <div key={photo.url} className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local de la foto elegida */}
      <img src={photo.url} alt={`Foto ${index + 1}`} className="aspect-square w-full rounded-xl border object-cover" />
      <button type="button" onClick={() => remove(index)} disabled={!!busy} aria-label={`Quitar foto ${index + 1}`} className="absolute top-1 right-1 flex size-8 items-center justify-center rounded-full bg-black/60 text-white"><X size={16} aria-hidden="true" /></button>
    </div>)}</div>}
    {photos.length < 5 && <Button type="button" variant="outline" className="h-12" disabled={!!busy} onClick={() => inputRef.current?.click()}><Camera size={18} aria-hidden="true" />{busy === "reading" ? "Procesando fotos…" : photos.length ? `Agregar más fotos (${photos.length}/5)` : "Agregar fotos (mínimo 1, máximo 5)"}</Button>}
    <label className="text-sm font-medium">Nota <span className="font-normal text-muted-foreground">(opcional)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={2} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" /></label>
    <Button className="h-12" disabled={!!busy || !photos.length} onClick={send}>{busy === "sending" ? "Enviando…" : "Entregar"}</Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
