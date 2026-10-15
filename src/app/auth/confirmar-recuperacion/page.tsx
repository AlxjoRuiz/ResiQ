import Link from "next/link";
import { notFound } from "next/navigation";
import { confirmPasswordRecovery } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function ConfirmRecoveryPage({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
  if (process.env.PASSWORD_RECOVERY_ENABLED !== "true") notFound();
  const { token_hash: tokenHash } = await searchParams;
  if (!tokenHash) return <main className="grid min-h-screen place-items-center px-6"><Card className="w-full max-w-md"><CardContent className="p-8"><h1 className="text-xl font-semibold">Enlace no válido</h1><p className="mt-3 text-sm">Solicita un nuevo enlace de recuperación.</p><Link className="mt-5 inline-block text-sm text-primary underline" href="/recuperar-contrasena">Solicitar enlace</Link></CardContent></Card></main>;
  return <main className="grid min-h-screen place-items-center px-6"><Card className="w-full max-w-md"><CardContent className="p-8">
    <h1 className="text-2xl font-semibold">Confirmar recuperación</h1>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">Pulsa continuar para abrir el formulario donde crearás una nueva contraseña.</p>
    <form action={confirmPasswordRecovery} className="mt-6"><input type="hidden" name="token_hash" value={tokenHash} /><Button className="w-full">Continuar</Button></form>
  </CardContent></Card></main>;
}
