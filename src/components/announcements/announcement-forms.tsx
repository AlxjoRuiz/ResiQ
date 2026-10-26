"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAnnouncement, publishAnnouncement, saveAnnouncementDraft, type AnnouncementState } from "@/app/panel/propiedades/[propertyId]/comunicados/actions";
import { createClient } from "@/lib/supabase/client";

export type AnnouncementRecipient = { id: string; name: string; roles: string[] };
type Draft = { id: string; subject: string; body: string; recipientIds: string[] };

function RecipientsFieldset({ recipients, selected }: { recipients: AnnouncementRecipient[]; selected?: string[] }) {
  return <fieldset className="rounded-xl border p-4"><legend className="px-1 text-sm font-semibold">Destinatarios explícitos</legend><p className="mb-3 text-xs text-muted-foreground">Marca las personas que recibirán el aviso interno. Máximo 100.</p><div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">{recipients.map((recipient) => <label key={recipient.id} className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" name="recipientIds" value={recipient.id} defaultChecked={selected?.includes(recipient.id)} /><span>{recipient.name}<small className="block text-muted-foreground">{recipient.roles.join(", ")}</small></span></label>)}</div>{!recipients.length && <p className="text-sm text-muted-foreground">No hay miembros activos disponibles.</p>}</fieldset>;
}

const staged = (body: Record<string, unknown>) => fetch("/api/announcements/staged-documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// Nuevo comunicado: se publica al crearlo. Adjuntos opcionales con el mismo diseño de Asambleas.
export function CreateAnnouncementForm({ propertyId }: { propertyId: string }) {
  const router = useRouter(), documentsRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(crypto.randomUUID());
  const [documents, setDocuments] = useState<File[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string>();
  function addDocuments(files: File[]) {
    const existing = new Set(documents.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
    const additions = files.filter((file) => {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    });
    if (documents.length + additions.length > 5) return setError("Puedes adjuntar máximo cinco archivos.");
    setDocuments((current) => [...current, ...additions]);
    setError(undefined);
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (documents.some((file) => !["application/pdf", "image/jpeg", "image/png"].includes(file.type) || !file.name.trim() || file.name.length > 180 || file.size < 1 || file.size > 10 * 1024 * 1024)) return setError("Los adjuntos deben ser PDF, JPG o PNG de máximo 10 MB cada uno.");
    const data = new FormData(event.currentTarget), stagedIds: string[] = [];
    data.set("requestId", requestId.current);
    setBusy(true); setError(undefined);
    try {
      const supabase = createClient();
      for (const file of documents) {
        const preparedResponse = await staged({ action: "prepare", propertyId, name: file.name, mimeType: file.type, size: file.size });
        const prepared = await preparedResponse.json() as { id?: string; path?: string; token?: string; error?: string };
        if (!preparedResponse.ok || !prepared.id || !prepared.path || !prepared.token) throw new Error(prepared.error ?? "No se pudo preparar el adjunto.");
        stagedIds.push(prepared.id);
        const { error: uploadError } = await supabase.storage.from("private-documents").uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
        if (uploadError) throw new Error("No se pudo subir el adjunto.");
        const completedResponse = await staged({ action: "finalize", propertyId, id: prepared.id });
        const completed = await completedResponse.json() as { error?: string };
        if (!completedResponse.ok) throw new Error(completed.error ?? "No se pudo validar el adjunto.");
      }
      data.set("uploadIds", JSON.stringify(stagedIds));
      const result = await createAnnouncement(data);
      if (!result.announcementId) throw new Error(result.error ?? "No se pudo publicar el comunicado.");
      await Promise.allSettled(stagedIds.map((id) => staged({ action: "discard", propertyId, id })));
      router.push(`/panel/propiedades/${propertyId}/comunicados/${result.announcementId}?published=1`);
      router.refresh();
    } catch (cause) {
      await Promise.allSettled(stagedIds.map((id) => staged({ action: "discard", propertyId, id })));
      setError(cause instanceof Error ? cause.message : "No se pudo publicar el comunicado.");
    } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="grid gap-5"><input type="hidden" name="propertyId" value={propertyId} />
    <label className="grid gap-2 text-sm font-medium">Asunto<input name="subject" required minLength={5} maxLength={160} disabled={busy} className="h-11 rounded-lg border bg-background px-3" /></label>
    <label className="grid gap-2 text-sm font-medium">Mensaje<textarea name="body" required minLength={10} maxLength={4000} rows={8} disabled={busy} className="rounded-lg border bg-background px-3 py-2" /></label>
    <section className="grid gap-4"><div><h2 className="text-sm font-semibold">Adjuntos</h2><p className="mt-1 text-xs text-muted-foreground">Opcional. Hasta cinco archivos privados; solo las cuentas de la comunidad podrán descargarlos.</p></div><div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed bg-background p-3 sm:p-4"><input ref={documentsRef} type="file" accept="application/pdf,image/jpeg,image/png" multiple className="sr-only" tabIndex={-1} aria-label="Adjuntos del comunicado" onChange={(event) => { addDocuments(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ""; }} /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{documents.length ? `${documents.length} de 5 archivos seleccionados` : "Documentos del comunicado"}</p><p className="text-xs text-muted-foreground">PDF, JPG o PNG · máximo 10 MB por archivo</p></div><Button type="button" size="sm" variant="outline" disabled={busy || documents.length >= 5} onClick={() => documentsRef.current?.click()}>{documents.length ? "Agregar más archivos" : "Agregar archivo"}</Button></div>{documents.length > 0 && <ol className="grid gap-2 text-sm" aria-label="Adjuntos seleccionados">{documents.map((file, index) => <li key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border px-3 py-2"><span className="min-w-0 break-words"><span className="font-medium">Adjunto {index + 1}:</span> {file.name}</span><Button type="button" size="icon" variant="ghost" disabled={busy} aria-label={`Quitar ${file.name}`} title={`Quitar ${file.name}`} onClick={() => { setDocuments((current) => current.filter((_, position) => position !== index)); setError(undefined); }}><Trash2 className="size-4" aria-hidden="true" /></Button></li>)}</ol>}</section>
    <div className="rounded-xl border bg-secondary p-4 text-sm">Al publicarlo, todas las cuentas activas de la comunidad (residentes, portería y administración) recibirán un aviso interno. Revisa los datos antes de continuar.</div>
    <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={busy}>{busy ? "Validando y publicando…" : "Publicar comunicado"}</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>
  </form>;
}

export function AnnouncementDraftForm({ propertyId, recipients, draft }: { propertyId: string; recipients: AnnouncementRecipient[]; draft?: Draft }) {
  const [state, action, pending] = useActionState(saveAnnouncementDraft, undefined as AnnouncementState);
  return <form action={action} className="grid gap-5"><input type="hidden" name="propertyId" value={propertyId} />{draft && <input type="hidden" name="announcementId" value={draft.id} />}
    <label className="grid gap-2 text-sm font-medium">Asunto<input name="subject" defaultValue={draft?.subject} required minLength={5} maxLength={160} className="h-11 rounded-lg border bg-background px-3" /></label>
    <label className="grid gap-2 text-sm font-medium">Mensaje<textarea name="body" defaultValue={draft?.body} required minLength={10} maxLength={4000} rows={8} className="rounded-lg border bg-background px-3 py-2" /></label>
    <RecipientsFieldset recipients={recipients} selected={draft?.recipientIds} />
    <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={pending || !recipients.length}>{pending ? "Guardando…" : "Guardar borrador"}</Button>{state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}</div>
  </form>;
}

export function PublishAnnouncementForm({ propertyId, announcementId }: { propertyId: string; announcementId: string }) {
  const [state, action, pending] = useActionState(publishAnnouncement, undefined as AnnouncementState);
  return <form action={action}><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="announcementId" value={announcementId} /><Button type="submit" disabled={pending}>{pending ? "Publicando…" : "Publicar comunicado"}</Button>{state?.error && <p role="alert" className="mt-2 text-sm text-destructive">{state.error}</p>}</form>;
}
