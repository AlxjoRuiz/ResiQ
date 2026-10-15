import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { ResetRequestForm } from "./reset-request-form";

export default async function RequestPasswordResetPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (process.env.PASSWORD_RECOVERY_ENABLED !== "true") notFound();
  const params = await searchParams;
  return <main className="grid min-h-screen place-items-center px-6 py-10"><Card className="w-full max-w-md"><CardContent className="p-8">
    <h1 className="text-2xl font-semibold">Recuperar contraseña</h1>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">Escribe el correo de tu cuenta. Si está registrada, recibirás un enlace para crear una nueva contraseña.</p>
    {params.error === "link" && <p role="alert" className="mt-3 text-sm text-destructive">El enlace venció o no es válido. Solicita uno nuevo.</p>}
    <ResetRequestForm />
    <Link href="/login" className="mt-5 inline-block text-sm text-primary underline">Volver a iniciar sesión</Link>
  </CardContent></Card></main>;
}
