"use client";

import { useState } from "react";
import { setLegalAssignment, setPropertyStatus, setPropertyTest, setSeasonalDecor, setSeasonalTheme, setTestEmail, type PlatformState } from "@/app/plataforma/actions";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { useFormActionState } from "@/lib/forms/use-form-action-state";

function Result({ state }: { state: PlatformState }) { if (state?.error) return <p role="alert" className="text-sm text-destructive">{state.error}</p>; if (state?.success) return <p role="status" className="text-sm text-primary">{state.success}</p>; return null; }

export function SeasonalDecorForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useFormActionState(setSeasonalDecor, undefined as PlatformState);
  return <form onSubmit={action} className="flex flex-wrap items-center gap-3"><input type="hidden" name="enabled" value={enabled ? "false" : "true"} /><Button disabled={pending} variant={enabled ? "outline" : "default"}>{pending ? "Guardando…" : enabled ? "Apagar decoración" : "Activar decoración"}</Button><Result state={state} /></form>;
}

const themeLabels = { christmas: "🎄 Navidad", halloween: "🎃 Halloween" } as const;

export function SeasonalThemeForm({ theme }: { theme: keyof typeof themeLabels }) {
  const [state, action, pending] = useFormActionState(setSeasonalTheme, undefined as PlatformState);
  return <form onSubmit={action} className="flex flex-wrap items-center gap-2">{(Object.keys(themeLabels) as (keyof typeof themeLabels)[]).map((key) => <Button key={key} name="theme" value={key} size="sm" variant={key === theme ? "default" : "outline"} aria-pressed={key === theme} disabled={pending}>{themeLabels[key]}</Button>)}<Result state={state} /></form>;
}

// Suspender pide confirmación con el aviso rojo común en el centro de la pantalla (15/11/2026).
export function PropertyStatusForm({ propertyId, propertyName, suspended }: { propertyId: string; propertyName: string; suspended: boolean }) {
  const [state, action, pending] = useFormActionState(setPropertyStatus, undefined as PlatformState);
  return <div className="flex flex-wrap items-center gap-3">
    <form onSubmit={action} className="flex flex-wrap items-center gap-2"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="status" value={suspended ? "active" : "suspended"} />
      {suspended ? <Button size="sm" disabled={pending}>{pending ? "Guardando…" : "Reactivar conjunto"}</Button>
        : <ConfirmButton disabled={pending} title="Suspender conjunto" message={<>¿Desea suspender <strong>{propertyName}</strong>? Nadie del conjunto (administración, portería ni residentes) podrá entrar a sus datos hasta que lo reactive. No se borra ninguna información.</>} confirmLabel="Sí, suspender">{pending ? "Guardando…" : "Suspender conjunto"}</ConfirmButton>}
    </form>
    <Result state={state} />
  </div>;
}

// Módulo jurídico (31/10/2026): asignar o quitar el conjunto a la abogada.
export function LegalAssignmentForm({ propertyId, assigned }: { propertyId: string; assigned: boolean }) {
  const [state, action, pending] = useFormActionState(setLegalAssignment, undefined as PlatformState);
  const [checked, setChecked] = useState(assigned);
  return <form onSubmit={action} className="flex flex-wrap items-center gap-3"><input type="hidden" name="propertyId" value={propertyId} />
    <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="assigned" checked={checked} onChange={(event) => setChecked(event.target.checked)} className="size-4 accent-primary" />Asignado a jurídica</label>
    <Button size="sm" variant="outline" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</Button><Result state={state} />
  </form>;
}

// Pruebas ResiQ (31/10/2026): pasar un conjunto a Pruebas o devolverlo a producción.
export function PropertyTestForm({ propertyId, isTest }: { propertyId: string; isTest: boolean }) {
  const [state, action, pending] = useFormActionState(setPropertyTest, undefined as PlatformState);
  return <form onSubmit={action} className="flex flex-wrap items-center gap-3"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="isTest" value={isTest ? "false" : "true"} />
    <Button size="sm" variant="outline" disabled={pending}>{pending ? "Guardando…" : isTest ? "Pasar a producción" : "Pasar a Pruebas ResiQ"}</Button><Result state={state} />
  </form>;
}

export function TestEmailForm() {
  const [state, action, pending] = useFormActionState(setTestEmail, undefined as PlatformState);
  return <form onSubmit={action} className="flex flex-wrap items-end gap-3"><label className="grid gap-1 text-sm font-medium">Correo<input name="email" type="email" required maxLength={254} className="h-10 min-w-64 rounded-lg border bg-white px-3 text-sm" /></label>
    <Button size="sm" disabled={pending}>{pending ? "Guardando…" : "Marcar como de prueba"}</Button><Result state={state} />
  </form>;
}

export function RemoveTestEmailForm({ email }: { email: string }) {
  const [state, action, pending] = useFormActionState(setTestEmail, undefined as PlatformState);
  return <form onSubmit={action} className="flex flex-wrap items-center gap-2"><input type="hidden" name="email" value={email} /><input type="hidden" name="isTest" value="false" />
    <ConfirmButton disabled={pending} title="Quitar correo de prueba" message={<>¿Desea quitar <strong>{email}</strong> de los correos de prueba? Sus datos volverán a contarse como reales.</>} confirmLabel="Sí, quitar">{pending ? "Quitando…" : "Quitar"}</ConfirmButton><Result state={state} />
  </form>;
}
