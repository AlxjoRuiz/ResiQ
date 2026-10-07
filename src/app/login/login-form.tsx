"use client";

import { useActionState } from "react";
import { registerWithInvitation, signIn, signInWithGoogle, type AuthState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

const initialState: AuthState = undefined;

export function LoginForm({ next, invitationToken }: { next: string; invitationToken?: string }) {
  const [state, action, pending] = useActionState(signIn, initialState);
  const [registerState, registerAction, registerPending] = useActionState(registerWithInvitation, initialState);
  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <label className="block text-sm font-medium">Correo
          <input className="mt-2 h-11 w-full rounded-lg border bg-white px-3 outline-none focus:ring-2 focus:ring-ring" name="email" type="email" autoComplete="email" required />
        </label>
        <label className="block text-sm font-medium">Contraseña
          <input className="mt-2 h-11 w-full rounded-lg border bg-white px-3 outline-none focus:ring-2 focus:ring-ring" name="password" type="password" autoComplete="current-password" minLength={8} required />
        </label>
        {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
        <Button className="w-full" disabled={pending}>{pending ? "Ingresando…" : "Ingresar"}</Button>
      </form>
      <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" /></div>
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <Button variant="outline" className="w-full login-alternative">Continuar con Google</Button>
      </form>
      {invitationToken && <div className="border-t pt-6"><h2 className="font-semibold">Crear cuenta con invitación</h2><p className="mt-1 text-sm text-muted-foreground">Usa exactamente el correo al que llegó la invitación.</p><form action={registerAction} className="mt-4 space-y-4"><input type="hidden" name="token" value={invitationToken} /><label className="block text-sm font-medium">Nombre completo<input className="mt-2 h-11 w-full rounded-lg border bg-white px-3" name="displayName" minLength={2} maxLength={80} required /></label><label className="block text-sm font-medium">Correo invitado<input className="mt-2 h-11 w-full rounded-lg border bg-white px-3" name="email" type="email" required /></label><label className="block text-sm font-medium">Nueva contraseña<input className="mt-2 h-11 w-full rounded-lg border bg-white px-3" name="password" type="password" minLength={8} required /></label>{registerState?.error && <p role="alert" className="text-sm text-destructive">{registerState.error}</p>}{registerState?.success && <p role="status" className="text-sm text-primary">{registerState.success}</p>}<Button className="w-full login-alternative" variant="outline" disabled={registerPending}>{registerPending ? "Creando…" : "Crear cuenta"}</Button></form></div>}
    </div>
  );
}
