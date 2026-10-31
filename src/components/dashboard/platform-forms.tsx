"use client";

import { useState } from "react";
import { setLegalAssignment, setPropertyStatus, setSeasonalDecor, setSeasonalTheme, type PlatformState } from "@/app/plataforma/actions";
import { Button } from "@/components/ui/button";
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

// Suspender pide confirmación centrada con el fondo desenfocado (mismo diseño que desvincular).
export function PropertyStatusForm({ propertyId, propertyName, suspended }: { propertyId: string; propertyName: string; suspended: boolean }) {
  const [state, action, pending] = useFormActionState(setPropertyStatus, undefined as PlatformState);
  const [confirming, setConfirming] = useState(false);
  const form = (label: string) => <form onSubmit={action} className="flex flex-wrap items-center gap-2"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="status" value={suspended ? "active" : "suspended"} /><Button size="sm" disabled={pending}>{pending ? "Guardando…" : label}</Button>{confirming && <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setConfirming(false)}>Cancelar</Button>}</form>;
  if (suspended) return <div className="flex flex-wrap items-center gap-3">{form("Reactivar conjunto")}<Result state={state} /></div>;
  return <div className="flex flex-wrap items-center gap-3">
    <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(true)}>Suspender conjunto</Button><Result state={state} />
    {confirming && <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Confirmar suspensión">
      <div className="w-full max-w-md space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 shadow-lg">
        <p>¿Seguro que quieres suspender «{propertyName}»? Nadie del conjunto (administración, portería ni residentes) podrá entrar a sus datos hasta que lo reactives. No se borra nada.</p>
        {form("Sí, suspender")}
      </div>
    </div>}
  </div>;
}

// Módulo jurídico (31/10/2026): asignar o quitar el conjunto a la abogada, con su umbral de mora en días.
export function LegalAssignmentForm({ propertyId, assigned, overdueDays }: { propertyId: string; assigned: boolean; overdueDays: number }) {
  const [state, action, pending] = useFormActionState(setLegalAssignment, undefined as PlatformState);
  const [checked, setChecked] = useState(assigned);
  return <form onSubmit={action} className="flex flex-wrap items-center gap-3"><input type="hidden" name="propertyId" value={propertyId} />
    <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="assigned" checked={checked} onChange={(event) => setChecked(event.target.checked)} className="size-4 accent-primary" />Asignado a jurídica</label>
    <label className="flex items-center gap-2 text-sm">Umbral de mora<input name="overdueDays" type="number" min={1} max={3650} defaultValue={overdueDays} required={checked} disabled={!checked} className="h-9 w-20 rounded-lg border bg-white px-2 text-sm disabled:opacity-50" />días</label>
    <Button size="sm" variant="outline" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</Button><Result state={state} />
  </form>;
}
