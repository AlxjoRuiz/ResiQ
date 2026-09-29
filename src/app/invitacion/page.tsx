import { Card, CardContent } from "@/components/ui/card";
import { InvitationForm } from "./invitation-form";

export default async function InvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  return <main className="grid min-h-screen place-items-center px-6"><Card className="w-full max-w-md"><CardContent className="p-8"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Invitación ResiQ</p><h1 className="mt-3 text-2xl font-semibold">Únete a tu comunidad</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Al aceptar, tu cuenta se vinculará únicamente con la propiedad y el apartamento definidos por la administración.</p><InvitationForm token={token} /></CardContent></Card></main>;
}
