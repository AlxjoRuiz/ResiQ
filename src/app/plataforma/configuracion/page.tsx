import { PlatformPage } from "@/components/dashboard/platform-page";
import { SeasonalDecorForm, SeasonalThemeForm } from "@/components/dashboard/platform-forms";
import { Card, CardContent } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";

export default async function PlatformSettingsPage() {
  const { supabase } = await requirePlatformAdmin();
  const [{ data: enabledData }, { data: settings }] = await Promise.all([supabase.rpc("get_seasonal_decor"), supabase.rpc("platform_get_seasonal_settings")]);
  const enabled = enabledData === true;
  const theme = (settings as string | null) === "halloween" ? "halloween" : "christmas";
  return <PlatformPage title="Configuración" description="Ajustes que aplican a todos los conjuntos.">
    <Card><CardContent>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Decoración de temporada</h2><p className="mt-1 text-sm text-muted-foreground">Figuras en el fondo de todas las páginas, para todos los usuarios. Navidad: Papá Noel, renos, copos de nieve y árboles. Halloween: calabazas, fantasmas, telarañas, dulces y murciélagos volando.</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{enabled ? "Activa" : "Apagada"}</span></div>
      <div className="mt-5 grid gap-4"><div><p className="mb-2 text-sm font-medium">Tema</p><SeasonalThemeForm key={theme} theme={theme} /></div><SeasonalDecorForm key={String(enabled)} enabled={enabled} /></div>
    </CardContent></Card>
  </PlatformPage>;
}
