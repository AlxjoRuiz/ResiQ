"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { publishAnnouncement, saveAnnouncementDraft, type AnnouncementState } from "@/app/panel/propiedades/[propertyId]/comunicados/actions";

export type AnnouncementRecipient = { id: string; name: string; roles: string[] };
type Draft = { id: string; subject: string; body: string; recipientIds: string[] };

export function AnnouncementDraftForm({ propertyId, recipients, draft }: { propertyId: string; recipients: AnnouncementRecipient[]; draft?: Draft }) {
  const [state, action, pending] = useActionState(saveAnnouncementDraft, undefined as AnnouncementState);
  return <form action={action} className="grid gap-5"><input type="hidden" name="propertyId" value={propertyId} />{draft && <input type="hidden" name="announcementId" value={draft.id} />}
    <label className="grid gap-2 text-sm font-medium">Asunto<input name="subject" defaultValue={draft?.subject} required minLength={5} maxLength={160} className="h-11 rounded-lg border bg-background px-3" /></label>
    <label className="grid gap-2 text-sm font-medium">Mensaje<textarea name="body" defaultValue={draft?.body} required minLength={10} maxLength={4000} rows={8} className="rounded-lg border bg-background px-3 py-2" /></label>
    <fieldset className="rounded-xl border p-4"><legend className="px-1 text-sm font-semibold">Destinatarios explícitos</legend><p className="mb-3 text-xs text-muted-foreground">Marca las personas que recibirán el aviso interno. Máximo 100.</p><div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">{recipients.map((recipient) => <label key={recipient.id} className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" name="recipientIds" value={recipient.id} defaultChecked={draft?.recipientIds.includes(recipient.id)} /><span>{recipient.name}<small className="block text-muted-foreground">{recipient.roles.join(", ")}</small></span></label>)}</div>{!recipients.length && <p className="text-sm text-muted-foreground">No hay miembros activos disponibles.</p>}</fieldset>
    <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={pending || !recipients.length}>{pending ? "Guardando…" : "Guardar borrador"}</Button>{state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}</div>
  </form>;
}

export function PublishAnnouncementForm({ propertyId, announcementId }: { propertyId: string; announcementId: string }) {
  const [state, action, pending] = useActionState(publishAnnouncement, undefined as AnnouncementState);
  return <form action={action}><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="announcementId" value={announcementId} /><Button type="submit" disabled={pending}>{pending ? "Publicando…" : "Publicar comunicado"}</Button>{state?.error && <p role="alert" className="mt-2 text-sm text-destructive">{state.error}</p>}</form>;
}
