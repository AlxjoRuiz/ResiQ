import { PlatformPage } from "@/components/dashboard/platform-page";
import { PropertyPlanForm } from "@/components/dashboard/platform-forms";
import { Card, CardContent } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { PLAN_ANNUAL_COP, PLAN_MONTHLY_COP, planLabels, type BillingCycle } from "@/lib/platform/plans";
import { dateInputValue } from "@/lib/time-zone";

type PropertyRow = { property_id: string; property_name: string; city: string | null; billing_cycle: BillingCycle | null; paid_until: string | null };
const cop = (value: number) => value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

// Un solo precio: mensual o anual. Sin cobro automático; «Pagado hasta» se actualiza al recibir el pago.
export default async function PlatformPlansPage() {
  const { supabase } = await requirePlatformAdmin();
  const { data, error } = await supabase.rpc("platform_list_properties");
  if (error) throw new Error("No se pudieron cargar los planes.");
  const rows = (data ?? []) as PropertyRow[];
  const today = dateInputValue(new Date(), "America/Bogota");
  const upToDate = rows.filter((row) => row.paid_until && row.paid_until >= today).length;
  return <PlatformPage title="Planes" description={`Todos los conjuntos pagan lo mismo: ${cop(PLAN_MONTHLY_COP)} al mes, o ${cop(PLAN_ANNUAL_COP)} al año (12 meses).`}>
    <section className="grid gap-4 sm:grid-cols-3">
      <Card><CardContent><p className="text-2xl font-semibold">{upToDate}</p><p className="mt-1 text-sm text-muted-foreground">Conjuntos al día</p></CardContent></Card>
      <Card><CardContent><p className="text-2xl font-semibold">{rows.length - upToDate}</p><p className="mt-1 text-sm text-muted-foreground">Vencidos o sin pago registrado</p></CardContent></Card>
      <Card><CardContent><p className="text-2xl font-semibold">{cop(rows.length * PLAN_MONTHLY_COP)}</p><p className="mt-1 text-sm text-muted-foreground">Ingreso mensual esperado</p></CardContent></Card>
    </section>
    {rows.map((row) => { const current = !!row.paid_until && row.paid_until >= today; return <Card key={row.property_id}><CardContent>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{row.property_name}</h2><p className="text-sm text-muted-foreground">{row.city ?? "Sin ciudad"} · Plan {planLabels[row.billing_cycle ?? "monthly"].toLowerCase()}{row.paid_until ? ` · pagado hasta ${row.paid_until}` : " · sin pago registrado"}</p></div><span className={`rounded-full px-3 py-1 text-xs font-medium ${current ? "bg-primary/12 text-primary" : "bg-amber-100 text-amber-900"}`}>{current ? "Al día" : row.paid_until ? "Vencido" : "Sin pago"}</span></div>
      <div className="mt-4 border-t pt-4"><PropertyPlanForm key={`${row.billing_cycle}-${row.paid_until}`} propertyId={row.property_id} cycle={row.billing_cycle ?? "monthly"} paidUntil={row.paid_until} /></div>
    </CardContent></Card>; })}
    {!rows.length && <Card><CardContent><p className="text-sm text-muted-foreground">Todavía no hay conjuntos.</p></CardContent></Card>}
  </PlatformPage>;
}
