"use client";


import { acceptInvitation, type AuthState } from "@/app/auth/actions";
import { useFormActionState } from "@/lib/forms/use-form-action-state";
import { Button } from "@/components/ui/button";

export function InvitationForm({ token }: { token: string }) {
  const [state, action, pending] = useFormActionState(acceptInvitation, undefined as AuthState);
  return <form onSubmit={action} className="mt-6"><input type="hidden" name="token" value={token} />{state?.error && <p role="alert" className="mb-4 text-sm text-destructive">{state.error}</p>}<Button className="w-full" disabled={pending}>{pending ? "Validando…" : "Aceptar invitación"}</Button></form>;
}
