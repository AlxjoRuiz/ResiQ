import Link from "next/link";
import { Building2, ChartNoAxesCombined, Settings, ShieldCheck, UsersRound, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardModules, MetricCard, type DashboardModule } from "@/components/dashboard/role-dashboard";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";

const modules: DashboardModule[] = [
  { title: "Propiedades", description: "Gestiona el ciclo de vida de las propiedades SaaS.", icon: Building2 }, { title: "Administradores", description: "Asigna administradores iniciales mediante procesos auditados.", icon: ShieldCheck }, { title: "Usuarios", description: "Consulta métricas globales sin acceder a datos privados operativos.", icon: UsersRound }, { title: "Configuración", description: "Administra parámetros globales de la plataforma.", icon: Settings }, { title: "Planes", description: "Prepara límites comerciales sin activar facturación automática.", icon: WalletCards }, { title: "Métricas", description: "Consulta indicadores agregados de operación.", icon: ChartNoAxesCombined },
];
export default async function PlatformPage() {
  const { supabase } = await requirePlatformAdmin();
  const { data } = await supabase.rpc("get_platform_dashboard_metrics");
  const metrics = Array.isArray(data) ? data[0] : data;
  return <main className="mx-auto min-h-screen max-w-7xl px-5 py-7 sm:px-10"><header className="flex flex-wrap items-center justify-between gap-4 border-b pb-6"><div><p className="text-xs font-semibold tracking-wider text-primary uppercase">ResiQ SaaS</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Panel de plataforma</h1><p className="mt-2 text-sm text-muted-foreground">Métricas y accesos globales sin exposición de información privada de residentes.</p></div><Button asChild variant="outline" size="sm"><Link href="/panel">Comunidades</Link></Button></header><section className="my-7 grid gap-4 sm:grid-cols-3"><MetricCard label="Propiedades" value={metrics?.property_count ?? 0} /><MetricCard label="Usuarios" value={metrics?.user_count ?? 0} /><MetricCard label="Administradores de propiedad" value={metrics?.administrator_count ?? 0} /></section><DashboardModules modules={modules} /></main>;
}
