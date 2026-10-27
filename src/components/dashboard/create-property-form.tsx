"use client";

import { useState } from "react";
import { createPlatformProperty, type CreatePropertyState } from "@/app/plataforma/actions";
import { Button } from "@/components/ui/button";
import { useFormActionState } from "@/lib/forms/use-form-action-state";

const inputClass = "mt-2 h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "block text-sm font-medium";

// Superadmin: nuevo conjunto con su administrador inicial. El enlace se muestra una sola vez.
export function CreatePropertyForm() {
  const [state, action, pending] = useFormActionState(createPlatformProperty, undefined as CreatePropertyState);
  const [copied, setCopied] = useState(false);
  async function copy(link: string) { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setCopied(false); } }
  return <form onSubmit={action} className="grid gap-4 md:grid-cols-2">
    <label className={`${labelClass} md:col-span-2`}>Nombre del conjunto<input className={inputClass} name="name" required minLength={2} maxLength={120} placeholder="Conjunto Los Bosques" /></label>
    <label className={labelClass}>Dirección<input className={inputClass} name="address" maxLength={180} placeholder="Calle 123 # 45-67" /></label>
    <label className={labelClass}>Ciudad<input className={inputClass} name="city" maxLength={80} placeholder="Bogotá" /></label>
    <label className={`${labelClass} md:col-span-2`}>Correo del administrador<input className={inputClass} name="adminEmail" type="email" required maxLength={254} placeholder="admin@correo.com" /></label>
    <div className="flex flex-wrap items-center gap-3 md:col-span-2"><Button disabled={pending} onClick={() => setCopied(false)}>{pending ? "Creando…" : "Crear conjunto"}</Button>{state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}</div>
    {state?.success && state.link && <div role="status" className="grid gap-3 rounded-xl border border-primary/20 bg-primary/8 p-4 text-sm md:col-span-2">
      <p>{state.success}</p>
      <p className="break-all rounded-lg bg-white px-3 py-2 font-mono text-xs">{state.link}</p>
      <div className="flex flex-wrap items-center gap-3"><Button type="button" size="sm" variant="outline" onClick={() => copy(state.link!)}>{copied ? "Enlace copiado" : "Copiar enlace"}</Button><p className="text-xs text-muted-foreground">Guárdalo ahora: por seguridad no se vuelve a mostrar.</p></div>
    </div>}
  </form>;
}
