import Link from "next/link";
import { CreatePropertyForm } from "@/components/dashboard/create-property-form";
import { Card, CardContent } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";

// Superadmin: propiedades de la plataforma. Por ahora, crear un conjunto con su administrador.
export default async function PlatformPropertiesPage() {
  await requirePlatformAdmin();
  return <main className="mx-auto min-h-screen max-w-4xl px-5 py-7 sm:px-10">
    <Link href="/plataforma" className="text-sm text-muted-foreground hover:text-foreground">← Volver a la plataforma</Link>
    <header className="mt-5 border-b pb-6"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Plataforma</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Propiedades</h1></header>
    <Card className="mt-7"><CardContent><h2 className="text-xl font-semibold">Nuevo conjunto</h2><p className="mt-1 mb-5 text-sm text-muted-foreground">Crea el conjunto y la invitación de su administrador. El administrador entra con el enlace usando ese correo y después importa el censo.</p><CreatePropertyForm /></CardContent></Card>
  </main>;
}
