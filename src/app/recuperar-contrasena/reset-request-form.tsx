"use client";


import { requestPasswordReset, type AuthState } from "@/app/auth/actions";
import { useFormActionState } from "@/lib/forms/use-form-action-state";
import { Button } from "@/components/ui/button";

export function ResetRequestForm() {
  const [state, action, pending] = useFormActionState(requestPasswordReset, undefined as AuthState);
  return <form onSubmit={action} className="mt-6 space-y-4">
    <label className="block text-sm font-medium">Correo
      <input className="mt-2 h-11 w-full rounded-lg border bg-white px-3" name="email" type="email" autoComplete="email" maxLength={254} required />
    </label>
    {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    {state?.success && <p role="status" className="text-sm text-primary">{state.success}</p>}
    <Button className="w-full" disabled={pending}>{pending ? "Enviando…" : "Enviar enlace"}</Button>
  </form>;
}
