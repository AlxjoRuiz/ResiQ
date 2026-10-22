import { Building2, ChartNoAxesCombined, Settings, ShieldCheck, UsersRound, WalletCards } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DashboardModules, MetricCard, type DashboardModule } from "@/components/dashboard/role-dashboard";

const modules: DashboardModule[] = [
  { title: "Propiedades", description: "Gestiona el ciclo de vida de las propiedades SaaS.", icon: Building2 }, { title: "Administradores", description: "Asigna administradores iniciales mediante procesos auditados.", icon: ShieldCheck }, { title: "Usuarios", description: "Consulta métricas globales sin acceder a datos privados operativos.", icon: UsersRound }, { title: "Configuración", description: "Administra parámetros globales de la plataforma.", icon: Settings }, { title: "Planes", description: "Prepara límites comerciales sin activar facturación automática.", icon: WalletCards }, { title: "Métricas", description: "Consulta indicadores agregados de operación.", icon: ChartNoAxesCombined },
];

export async function PlatformOverview({ supabase }: { supabase: SupabaseClient }) {
  const { data } = await supabase.rpc("get_platform_dashboard_metrics");
  const metrics = Array.isArray(data) ? data[0] : data;
  return <><section className="my-7 grid gap-4 sm:grid-cols-3"><MetricCard label="Propiedades" value={metrics?.property_count ?? 0} /><MetricCard label="Usuarios" value={metrics?.user_count ?? 0} /><MetricCard label="Administradores de propiedad" value={metrics?.administrator_count ?? 0} /></section><DashboardModules modules={modules} /></>;
}
