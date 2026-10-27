import { PlatformPage } from "@/components/dashboard/platform-page";
import { Card, CardContent } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";

type UsageRow = { property_id: string; property_name: string; pqrs_count: number; package_count: number; visitor_count: number; reservation_count: number };
type Activity = { active_7_days: number; active_30_days: number; emails_sent: number; emails_held: number; emails_failed: number; emails_pending: number };

function Metric({ value, label }: { value: number; label: string }) { return <Card><CardContent><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p></CardContent></Card>; }

// Solo cantidades de los últimos 30 días; no muestra contenido de PQRS, paquetes ni visitas.
export default async function PlatformMetricsPage() {
  const { supabase } = await requirePlatformAdmin();
  const [{ data: usageData, error: usageError }, { data: activityData, error: activityError }] = await Promise.all([supabase.rpc("platform_usage_by_property"), supabase.rpc("platform_activity_metrics")]);
  if (usageError || activityError) throw new Error("No se pudieron cargar las métricas.");
  const usage = (usageData ?? []) as UsageRow[];
  const activity = (Array.isArray(activityData) ? activityData[0] : activityData) as Activity | null;
  return <PlatformPage title="Métricas" description="Indicadores de los últimos 30 días. Solo cantidades.">
    <section><h2 className="mb-3 text-lg font-semibold">Cuentas activas</h2><div className="grid gap-4 sm:grid-cols-2"><Metric value={activity?.active_7_days ?? 0} label="Entraron en los últimos 7 días" /><Metric value={activity?.active_30_days ?? 0} label="Entraron en los últimos 30 días" /></div></section>
    <section><h2 className="mb-3 text-lg font-semibold">Correos</h2><div className="grid gap-4 sm:grid-cols-4"><Metric value={activity?.emails_sent ?? 0} label="Enviados" /><Metric value={activity?.emails_held ?? 0} label="Retenidos (modo de prueba)" /><Metric value={activity?.emails_pending ?? 0} label="En cola" /><Metric value={activity?.emails_failed ?? 0} label="Fallidos" /></div></section>
    <section><h2 className="mb-3 text-lg font-semibold">Uso por conjunto</h2><Card><CardContent className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b text-xs text-muted-foreground"><th className="py-2 pr-3 font-medium">Conjunto</th><th className="py-2 pr-3 font-medium">PQRS</th><th className="py-2 pr-3 font-medium">Paquetes</th><th className="py-2 pr-3 font-medium">Visitas</th><th className="py-2 font-medium">Reservas</th></tr></thead>
      <tbody>{usage.map((row) => <tr key={row.property_id} className="border-b last:border-0"><td className="py-3 pr-3 font-medium">{row.property_name}</td><td className="py-3 pr-3">{row.pqrs_count}</td><td className="py-3 pr-3">{row.package_count}</td><td className="py-3 pr-3">{row.visitor_count}</td><td className="py-3">{row.reservation_count}</td></tr>)}</tbody></table>
      {!usage.length && <p className="py-4 text-sm text-muted-foreground">Todavía no hay conjuntos.</p>}</CardContent></Card></section>
  </PlatformPage>;
}
