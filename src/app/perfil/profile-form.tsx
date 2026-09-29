"use client";

import { useActionState } from "react";
import { updateProfile, type AuthState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

export function ProfileForm({ displayName }: { displayName: string }) {
  const [state, action, pending] = useActionState(updateProfile, undefined as AuthState);
  return <form action={action} className="mt-6 space-y-4"><label className="block text-sm font-medium">Nombre visible<input className="mt-2 h-11 w-full rounded-lg border bg-white px-3 outline-none focus:ring-2 focus:ring-ring" name="displayName" defaultValue={displayName} minLength={2} maxLength={80} required /></label>{state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}{state?.success && <p role="status" className="text-sm text-primary">{state.success}</p>}<Button disabled={pending}>{pending ? "Guardando…" : "Guardar perfil"}</Button></form>;
}
