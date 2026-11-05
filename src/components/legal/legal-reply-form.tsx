"use client";

import { useState } from "react";
import { postLegalMessage, type CollectionNoticeState } from "@/app/juridica/actions";
import { LegalFilesField, withFiles } from "@/components/legal/legal-files-field";
import { Button } from "@/components/ui/button";
import { useFormActionState } from "@/lib/forms/use-form-action-state";

// La abogada contesta en la conversación del requerimiento (31/10/2026); desde el 05/11/2026 con adjuntos.
export function LegalReplyForm({ noticeId, propertyId }: { noticeId: string; propertyId: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [state, action, pending] = useFormActionState(async (previous: CollectionNoticeState, data: FormData) => {
    const result = await postLegalMessage(previous, withFiles(data, files));
    if (!result?.error) setFiles([]);
    return result;
  }, undefined as CollectionNoticeState);
  return <form onSubmit={action} className="grid gap-3"><input type="hidden" name="noticeId" value={noticeId} /><input type="hidden" name="propertyId" value={propertyId} />
    <label className="text-sm font-medium">Mensaje<textarea name="message" required minLength={2} maxLength={5000} rows={5} className="mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring" /></label>
    <LegalFilesField files={files} onChange={setFiles} disabled={pending} />
    <div className="flex flex-wrap items-center gap-3"><Button disabled={pending}>{pending ? "Enviando…" : "Enviar"}</Button>
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}{state?.success && <p role="status" className="text-sm text-primary">{state.success}</p>}</div>
  </form>;
}
