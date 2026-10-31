"use client";

import { postLegalMessage, type CollectionNoticeState } from "@/app/juridica/actions";
import { Button } from "@/components/ui/button";
import { useFormActionState } from "@/lib/forms/use-form-action-state";

// La abogada contesta en la conversación del requerimiento (31/10/2026).
export function LegalReplyForm({ noticeId }: { noticeId: string }) {
  const [state, action, pending] = useFormActionState(postLegalMessage, undefined as CollectionNoticeState);
  return <form onSubmit={action} className="grid gap-3"><input type="hidden" name="noticeId" value={noticeId} />
    <label className="text-sm font-medium">Mensaje<textarea name="message" required minLength={2} maxLength={5000} rows={5} className="mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring" /></label>
    <div className="flex flex-wrap items-center gap-3"><Button disabled={pending}>{pending ? "Enviando…" : "Enviar"}</Button>
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}{state?.success && <p role="status" className="text-sm text-primary">{state.success}</p>}</div>
  </form>;
}
