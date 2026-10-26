"use client";


import { setAccountPassword, type AuthState } from "@/app/auth/actions";
import { useFormActionState } from "@/lib/forms/use-form-action-state";
import { Button } from "@/components/ui/button";

export function PasswordForm() {
  const [state, action, pending] = useFormActionState(setAccountPassword, undefined as AuthState);
  return <form onSubmit={action} className="mt-4 space-y-4">
    <label className="block text-sm font-medium">Nueva contraseña
      <input className="mt-2 h-11 w-full rounded-lg border bg-white px-3" name="password" type="password" autoComplete="new-password" minLength={8} required />
    </label>
    <label className="block text-sm font-medium">Confirmar contraseña
      <input className="mt-2 h-11 w-full rounded-lg border bg-white px-3" name="confirmation" type="password" autoComplete="new-password" minLength={8} required />
    </label>
    {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    {state?.success && <p role="status" className="text-sm text-primary">{state.success}</p>}
    <Button disabled={pending}>{pending ? "Guardando…" : "Guardar contraseña"}</Button>
  </form>;
}
