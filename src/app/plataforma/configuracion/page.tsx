import { PlatformPage } from "@/components/dashboard/platform-page";
import { SeasonalDecorForm } from "@/components/dashboard/platform-forms";
import { Card, CardContent } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";

export default async function PlatformSettingsPage() {
  const { supabase } = await requirePlatformAdmin();
  const { data } = await supabase.rpc("get_seasonal_decor");
  const enabled = data === true;
  return <PlatformPage title="Configuración" description="Ajustes que aplican a todos los conjuntos.">
    <Card><CardContent>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Decoración de Navidad</h2><p className="mt-1 text-sm text-muted-foreground">Papá Noel, renos, copos de nieve y árboles cayendo en el fondo de todas las páginas del panel, para todos los usuarios.</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{enabled ? "Activa" : "Apagada"}</span></div>
      <div className="mt-5"><SeasonalDecorForm key={String(enabled)} enabled={enabled} /></div>
    </CardContent></Card>
  </PlatformPage>;
}
