import { PlatformPage } from "@/components/dashboard/platform-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { dateInputValue } from "@/lib/time-zone";

type UsageRow = { property_id: string; property_name: string; pqrs_count: number; package_count: number; visitor_count: number; reservation_count: number };
type Activity = { active_7_days: number; active_30_days: number };
type Emails = { emails_sent: number; emails_held: number; emails_failed: number; emails_pending: number };

function Metric({ value, label }: { value: number; label: string }) { return <Card><CardContent><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p></CardContent></Card>; }

// Los 12 meses más recientes (YYYY-MM), empezando por el actual en hora de Colombia.
function recentMonths() {
  const current = dateInputValue(new Date(), "America/Bogota").slice(0, 7);
  const [year, month] = current.split("-").map(Number);
  return Array.from({ length: 12 }, (_, index) => { const date = new Date(Date.UTC(year, month - 1 - index, 1)); return date.toISOString().slice(0, 7); });
}
const monthName = (value: string) => new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T12:00:00Z`));

// Solo cantidades; no muestra contenido de PQRS, paquetes ni visitas.
export default async function PlatformMetricsPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { supabase } = await requirePlatformAdmin();
  const months = recentMonths();
  const requested = (await searchParams).mes;
  const month = requested && months.includes(requested) ? requested : months[0];
  const [{ data: usageData, error: usageError }, { data: activityData, error: activityError }, { data: emailData, error: emailError }] = await Promise.all([
    supabase.rpc("platform_usage_by_month", { target_month: `${month}-01` }),
    supabase.rpc("platform_activity_metrics"),
    supabase.rpc("platform_email_metrics_by_month", { target_month: `${month}-01` }),
  ]);
  if (usageError || activityError || emailError) throw new Error("No se pudieron cargar las métricas.");
  const usage = (usageData ?? []) as UsageRow[];
  const activity = (Array.isArray(activityData) ? activityData[0] : activityData) as Activity | null;
  const emails = (Array.isArray(emailData) ? emailData[0] : emailData) as Emails | null;
  return <PlatformPage title="Métricas" description="Uso por conjunto y correos del mes elegido. Solo cantidades.">
    <form className="flex flex-wrap items-end gap-3"><label className="grid gap-1 text-sm font-medium">Mes<select name="mes" defaultValue={month} className="h-10 min-w-52 rounded-lg border bg-white px-3 text-sm capitalize">{months.map((value) => <option key={value} value={value}>{monthName(value)}</option>)}</select></label><Button type="submit" variant="outline">Ver mes</Button></form>
    <section><h2 className="mb-3 text-lg font-semibold">Cuentas activas</h2><p className="-mt-2 mb-3 text-xs text-muted-foreground">Siempre a hoy: solo se conoce la última vez que entró cada cuenta.</p><div className="grid gap-4 sm:grid-cols-2"><Metric value={activity?.active_7_days ?? 0} label="Entraron en los últimos 7 días" /><Metric value={activity?.active_30_days ?? 0} label="Entraron en los últimos 30 días" /></div></section>
    <section><h2 className="mb-3 text-lg font-semibold first-letter:uppercase">Correos de {monthName(month)}</h2><div className="grid gap-4 sm:grid-cols-4"><Metric value={emails?.emails_sent ?? 0} label="Enviados" /><Metric value={emails?.emails_held ?? 0} label="Retenidos (modo de prueba)" /><Metric value={emails?.emails_pending ?? 0} label="En cola" /><Metric value={emails?.emails_failed ?? 0} label="Fallidos" /></div></section>
    <section><h2 className="mb-3 text-lg font-semibold first-letter:uppercase">Uso por conjunto en {monthName(month)}</h2><Card><CardContent className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b text-xs text-muted-foreground"><th className="py-2 pr-3 font-medium">Conjunto</th><th className="py-2 pr-3 font-medium">PQRS</th><th className="py-2 pr-3 font-medium">Paquetes</th><th className="py-2 pr-3 font-medium">Visitas</th><th className="py-2 font-medium">Reservas</th></tr></thead>
      <tbody>{usage.map((row) => <tr key={row.property_id} className="border-b last:border-0"><td className="py-3 pr-3 font-medium">{row.property_name}</td><td className="py-3 pr-3">{row.pqrs_count}</td><td className="py-3 pr-3">{row.package_count}</td><td className="py-3 pr-3">{row.visitor_count}</td><td className="py-3">{row.reservation_count}</td></tr>)}</tbody></table>
      {!usage.length && <p className="py-4 text-sm text-muted-foreground">Todavía no hay conjuntos.</p>}</CardContent></Card></section>
  </PlatformPage>;
}
