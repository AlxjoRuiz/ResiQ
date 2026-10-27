"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useFormActionState } from "@/lib/forms/use-form-action-state";
import { inviteAdminAssistant, manageAdminAssistantInvitation, setAdminAssistantStatus, type AssistantLinkState, type ManagementState } from "./actions";

const inputClass = "mt-2 h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

function Feedback({ state }: { state: AssistantLinkState }) {
  const [copied, setCopied] = useState<string>();
  if (state?.error) return <p role="alert" className="text-sm text-destructive">{state.error}</p>;
  if (!state?.success) return null;
  const link = state.link;
  if (!link) return <p role="status" className="text-sm text-primary">{state.success}</p>;
  async function copy(value: string) { try { await navigator.clipboard.writeText(value); setCopied(value); } catch { setCopied(undefined); } }
  return <div role="status" className="grid w-full gap-3 rounded-xl border border-primary/20 bg-primary/8 p-4 text-sm">
    <p>{state.success}</p>
    <p className="break-all rounded-lg bg-white px-3 py-2 font-mono text-xs">{link}</p>
    <div className="flex flex-wrap items-center gap-3"><Button type="button" size="sm" variant="outline" onClick={() => copy(link)}>{copied === link ? "Enlace copiado" : "Copiar enlace"}</Button><p className="text-xs text-muted-foreground">Guárdalo ahora: por seguridad no se vuelve a mostrar.</p></div>
  </div>;
}

export function InviteAdminAssistantForm({ propertyId }: { propertyId: string }) {
  const [state, action, pending] = useFormActionState(inviteAdminAssistant, undefined as AssistantLinkState);
  return <form onSubmit={action} className="grid gap-3"><input type="hidden" name="propertyId" value={propertyId} />
    <label className="block text-sm font-medium">Correo del auxiliar<input className={inputClass} name="email" type="email" required maxLength={254} placeholder="auxiliar@correo.com" /></label>
    <div><Button disabled={pending}>{pending ? "Creando…" : "Invitar auxiliar"}</Button></div>
    <Feedback state={state} />
  </form>;
}

// Invitación pendiente o vencida: enlace nuevo o cancelar.
export function AdminAssistantInvitationForm({ propertyId, invitationId }: { propertyId: string; invitationId: string }) {
  const [state, action, pending] = useFormActionState(manageAdminAssistantInvitation, undefined as AssistantLinkState);
  return <form onSubmit={action} className="grid w-full gap-3"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="invitationId" value={invitationId} />
    <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" name="intent" value="reissue" disabled={pending}>Generar enlace nuevo</Button><Button size="sm" variant="ghost" name="intent" value="cancel" disabled={pending}>Cancelar invitación</Button></div>
    <Feedback state={state} />
  </form>;
}

export function AdminAssistantStatusForm({ propertyId, memberId, suspended }: { propertyId: string; memberId: string; suspended: boolean }) {
  const [state, action, pending] = useFormActionState(setAdminAssistantStatus, undefined as ManagementState);
  return <form onSubmit={action} className="flex w-full flex-wrap items-center gap-3"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="memberId" value={memberId} /><input type="hidden" name="status" value={suspended ? "active" : "suspended"} />
    <Button size="sm" variant="outline" disabled={pending}>{pending ? "Guardando…" : suspended ? "Reactivar acceso" : "Suspender acceso"}</Button>
    {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}{state?.success && <p role="status" className="text-sm text-primary">{state.success}</p>}
  </form>;
}
