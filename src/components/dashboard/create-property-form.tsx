"use client";

import { useState } from "react";
import { createPlatformProperty, inviteAdministrator, inviteLegal, inviteMaintenanceAdmin, reissueAdminInvitation, reissueLegalInvitation, reissueMaintenanceInvitation, type CreatePropertyState } from "@/app/plataforma/actions";
import { Button } from "@/components/ui/button";
import { useFormActionState } from "@/lib/forms/use-form-action-state";

const inputClass = "mt-2 h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "block text-sm font-medium";

// Enlace de invitación recién generado, con botón para copiarlo. Se muestra una sola vez.
function InvitationLinkResult({ state }: { state: CreatePropertyState }) {
  const [copied, setCopied] = useState<string>();
  if (!state?.success || !state.link) return null;
  const link = state.link;
  async function copy() { try { await navigator.clipboard.writeText(link); setCopied(link); } catch { setCopied(undefined); } }
  return <div role="status" className="grid gap-3 rounded-xl border border-primary/20 bg-primary/8 p-4 text-sm md:col-span-2">
    <p>{state.success}</p>
    <p className="break-all rounded-lg bg-white px-3 py-2 font-mono text-xs">{link}</p>
    <div className="flex flex-wrap items-center gap-3"><Button type="button" size="sm" variant="outline" onClick={copy}>{copied === link ? "Enlace copiado" : "Copiar enlace"}</Button><p className="text-xs text-muted-foreground">Guárdalo ahora: por seguridad no se vuelve a mostrar.</p></div>
  </div>;
}

// Superadmin: nuevo conjunto con su administrador inicial.
export function CreatePropertyForm() {
  const [state, action, pending] = useFormActionState(createPlatformProperty, undefined as CreatePropertyState);
  return <form onSubmit={action} className="grid gap-4 md:grid-cols-2">
    <label className={`${labelClass} md:col-span-2`}>Nombre del conjunto<input className={inputClass} name="name" required minLength={2} maxLength={120} placeholder="Conjunto Los Bosques" /></label>
    <label className={labelClass}>Dirección<input className={inputClass} name="address" maxLength={180} placeholder="Calle 123 # 45-67" /></label>
    <label className={labelClass}>Ciudad<input className={inputClass} name="city" maxLength={80} placeholder="Bogotá" /></label>
    <label className={`${labelClass} md:col-span-2`}>Correo del administrador<input className={inputClass} name="adminEmail" type="email" required maxLength={254} placeholder="admin@correo.com" /></label>
    <div className="flex flex-wrap items-center gap-3 md:col-span-2"><Button disabled={pending}>{pending ? "Creando…" : "Crear conjunto"}</Button>{state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}</div>
    <InvitationLinkResult state={state} />
  </form>;
}

// Superadmin: invitar otro administrador a un conjunto existente.
export function InviteAdministratorForm({ propertyId }: { propertyId: string }) {
  const [state, action, pending] = useFormActionState(inviteAdministrator, undefined as CreatePropertyState);
  return <form onSubmit={action} className="grid gap-3"><input type="hidden" name="propertyId" value={propertyId} />
    <label className={labelClass}>Correo del nuevo administrador<input className={inputClass} name="adminEmail" type="email" required maxLength={254} placeholder="admin@correo.com" /></label>
    <div className="flex flex-wrap items-center gap-3"><Button size="sm" disabled={pending}>{pending ? "Creando…" : "Invitar administrador"}</Button>{state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}</div>
    <InvitationLinkResult state={state} />
  </form>;
}

// Invitación pendiente o vencida: genera un enlace nuevo de 7 días (el anterior deja de servir).
export function ReissueAdminInvitationForm({ invitationId }: { invitationId: string }) {
  const [state, action, pending] = useFormActionState(reissueAdminInvitation, undefined as CreatePropertyState);
  return <form onSubmit={action} className="grid w-full gap-3"><input type="hidden" name="invitationId" value={invitationId} />
    <div className="flex flex-wrap items-center gap-3"><Button size="sm" variant="outline" disabled={pending}>{pending ? "Generando…" : "Generar enlace nuevo"}</Button>{state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}</div>
    <InvitationLinkResult state={state} />
  </form>;
}

// Equipo de mantenimiento: invitar al admin de mantenimiento y generar un enlace nuevo.
export function InviteMaintenanceAdminForm() {
  const [state, action, pending] = useFormActionState(inviteMaintenanceAdmin, undefined as CreatePropertyState);
  return <form onSubmit={action} className="grid gap-3">
    <label className={labelClass}>Correo del admin de mantenimiento<input className={inputClass} name="adminEmail" type="email" required maxLength={254} placeholder="mantenimiento@correo.com" /></label>
    <div className="flex flex-wrap items-center gap-3"><Button size="sm" disabled={pending}>{pending ? "Creando…" : "Invitar admin de mantenimiento"}</Button>{state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}</div>
    <InvitationLinkResult state={state} />
  </form>;
}

export function ReissueMaintenanceInvitationForm({ invitationId }: { invitationId: string }) {
  const [state, action, pending] = useFormActionState(reissueMaintenanceInvitation, undefined as CreatePropertyState);
  return <form onSubmit={action} className="grid w-full gap-3"><input type="hidden" name="invitationId" value={invitationId} />
    <div className="flex flex-wrap items-center gap-3"><Button size="sm" variant="outline" disabled={pending}>{pending ? "Generando…" : "Generar enlace nuevo"}</Button>{state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}</div>
    <InvitationLinkResult state={state} />
  </form>;
}

// Módulo jurídico (31/10/2026): invitar a la abogada de cobros y generar un enlace nuevo.
export function InviteLegalForm() {
  const [state, action, pending] = useFormActionState(inviteLegal, undefined as CreatePropertyState);
  return <form onSubmit={action} className="grid gap-3">
    <label className={labelClass}>Correo de la abogada<input className={inputClass} name="email" type="email" required maxLength={254} placeholder="abogada@correo.com" /></label>
    <div className="flex flex-wrap items-center gap-3"><Button size="sm" disabled={pending}>{pending ? "Creando…" : "Invitar abogada"}</Button>{state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}</div>
    <InvitationLinkResult state={state} />
  </form>;
}

export function ReissueLegalInvitationForm({ invitationId }: { invitationId: string }) {
  const [state, action, pending] = useFormActionState(reissueLegalInvitation, undefined as CreatePropertyState);
  return <form onSubmit={action} className="grid w-full gap-3"><input type="hidden" name="invitationId" value={invitationId} />
    <div className="flex flex-wrap items-center gap-3"><Button size="sm" variant="outline" disabled={pending}>{pending ? "Generando…" : "Generar enlace nuevo"}</Button>{state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}</div>
    <InvitationLinkResult state={state} />
  </form>;
}
