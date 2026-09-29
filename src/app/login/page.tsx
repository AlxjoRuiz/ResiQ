import { Building2, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/panel";
  const invitationToken = next.startsWith("/invitacion?") ? new URL(next, "http://localhost").searchParams.get("token") ?? undefined : undefined;
  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <Card className="w-full max-w-md shadow-sm"><CardContent className="p-7 sm:p-9">
        <div className="mb-7 flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-primary text-white"><Building2 size={23} /></span><div><p className="font-semibold">ResiQ</p><p className="text-xs text-muted-foreground">Acceso de la comunidad</p></div></div>
        <h1 className="text-2xl font-semibold tracking-tight">Bienvenido de nuevo</h1>
        <p className="mt-2 mb-7 text-sm leading-6 text-muted-foreground">Ingresa con la cuenta asociada a tu invitación.</p>
        {params.error && <p role="alert" className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-destructive">No pudimos completar el acceso. Intenta nuevamente.</p>}
        <LoginForm next={next} invitationToken={invitationToken} />
        <p className="mt-7 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck size={15} />Acceso protegido para miembros autorizados.</p>
      </CardContent></Card>
    </main>
  );
}
