"use client";

import { useActionState } from "react";
import { acceptInvitation, type AuthState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

export function InvitationForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvitation, undefined as AuthState);
  return <form action={action} className="mt-6"><input type="hidden" name="token" value={token} />{state?.error && <p role="alert" className="mb-4 text-sm text-destructive">{state.error}</p>}<Button className="w-full" disabled={pending}>{pending ? "Validando…" : "Aceptar invitación"}</Button></form>;
}
