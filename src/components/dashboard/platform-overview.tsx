import { Building2, ChartNoAxesCombined, Settings, ShieldCheck, UsersRound } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DashboardModules, MetricCard, type DashboardModule } from "@/components/dashboard/role-dashboard";

const modules: DashboardModule[] = [
  { title: "Propiedades", description: "Crea conjuntos nuevos con la invitación de su administrador.", icon: Building2, href: "/plataforma/propiedades" },
  { title: "Administradores", description: "Consulta los administradores de cada conjunto y las invitaciones pendientes.", icon: ShieldCheck, href: "/plataforma/administradores" },
  { title: "Usuarios", description: "Cifras de cuentas activas por conjunto, sin datos personales.", icon: UsersRound, href: "/plataforma/usuarios" },
  { title: "Configuración", description: "Activa o apaga la decoración de Navidad para todos.", icon: Settings, href: "/plataforma/configuracion" },
  { title: "Métricas", description: "Uso por conjunto, cuentas activas y correos de los últimos 30 días.", icon: ChartNoAxesCombined, href: "/plataforma/metricas" },
];

export async function PlatformOverview({ supabase }: { supabase: SupabaseClient }) {
  const { data } = await supabase.rpc("get_platform_dashboard_metrics");
  const metrics = Array.isArray(data) ? data[0] : data;
  return <><section className="my-7 grid gap-4 sm:grid-cols-3"><MetricCard label="Propiedades" value={metrics?.property_count ?? 0} /><MetricCard label="Usuarios" value={metrics?.user_count ?? 0} /><MetricCard label="Administradores de propiedad" value={metrics?.administrator_count ?? 0} /></section><DashboardModules modules={modules} /></>;
}
