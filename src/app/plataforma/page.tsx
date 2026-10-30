import Link from "next/link";
import { Building2, ShieldCheck, UsersRound } from "lucide-react";
import { PlatformPage } from "@/components/dashboard/platform-page";
import { MetricCard } from "@/components/dashboard/role-dashboard";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";

type PropertyRow = { property_id: string; property_name: string; property_status: string; administrator_count: number };
type AdminRow = { property_id: string; property_name: string; email: string; member_status: string; invitation_id: string | null; is_assistant: boolean | null };
type MaintenanceRow = { email: string; member_status: string; invitation_id: string | null };
type Attention = { label: string; detail: string; href: string; urgent: boolean };

// Inicio del superadmin (30/10/2026): cifras clave y «Por atender» (invitaciones sin aceptar o vencidas,
// conjuntos sin administrador y conjuntos suspendidos), cada uno con enlace a donde se resuelve.
export default async function PlatformHomePage() {
  const { supabase } = await requirePlatformAdmin();
  const [{ data: metricData }, { data: propertyData, error: propertyError }, { data: adminData, error: adminError }, { data: maintenanceData, error: maintenanceError }] = await Promise.all([
    supabase.rpc("get_platform_dashboard_metrics"),
    supabase.rpc("platform_list_properties"),
    supabase.rpc("platform_list_administrators"),
    supabase.rpc("platform_list_maintenance_admins"),
  ]);
  if (propertyError || adminError || maintenanceError) throw new Error("No se pudo cargar el inicio de la plataforma.");
  const metrics = (Array.isArray(metricData) ? metricData[0] : metricData) as { property_count: number; user_count: number; administrator_count: number } | null;
  const properties = (propertyData ?? []) as PropertyRow[];
  const invitations = ((adminData ?? []) as AdminRow[]).filter((row) => row.invitation_id);
  const maintenance = (maintenanceData ?? []) as MaintenanceRow[];

  const items: Attention[] = [
    ...invitations.filter((row) => row.member_status === "expired").map((row) => ({ label: `Invitación vencida · ${row.is_assistant ? "auxiliar" : "administrador"}`, detail: `${row.property_name} · ${row.email}`, href: `/plataforma/propiedades/${row.property_id}`, urgent: true })),
    ...invitations.filter((row) => row.member_status !== "expired").map((row) => ({ label: `Invitación sin aceptar · ${row.is_assistant ? "auxiliar" : "administrador"}`, detail: `${row.property_name} · ${row.email}`, href: `/plataforma/propiedades/${row.property_id}`, urgent: false })),
    ...properties.filter((row) => row.property_status === "active" && row.administrator_count === 0).map((row) => ({ label: "Conjunto sin administrador", detail: row.property_name, href: `/plataforma/propiedades/${row.property_id}`, urgent: true })),
    ...properties.filter((row) => row.property_status === "suspended").map((row) => ({ label: "Conjunto suspendido", detail: row.property_name, href: `/plataforma/propiedades/${row.property_id}`, urgent: false })),
    ...maintenance.filter((row) => row.invitation_id).map((row) => ({ label: row.member_status === "expired" ? "Invitación vencida · mantenimiento" : "Invitación sin aceptar · mantenimiento", detail: row.email, href: "/plataforma/equipos", urgent: row.member_status === "expired" })),
  ];

  return <PlatformPage eyebrow="ResiQ SaaS" title="Panel de plataforma" description="Resumen de los conjuntos y lo que requiere tu atención.">
    <section aria-label="Cifras de la plataforma" className="grid gap-4 sm:grid-cols-3">
      <MetricCard label="Conjuntos" value={metrics?.property_count ?? properties.length} />
      <MetricCard label="Usuarios" value={metrics?.user_count ?? 0} />
      <MetricCard label="Administradores de conjunto" value={metrics?.administrator_count ?? 0} />
    </section>
    <section aria-labelledby="por-atender" className="rounded-2xl border bg-white p-5">
      <h2 id="por-atender" className="text-lg font-semibold">Por atender</h2>
      {items.length ? <ul className="mt-3 grid gap-2">{items.map((item, index) => <li key={`${item.href}-${index}`}><Link href={item.href} className="flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors hover:bg-secondary">
        <span className="min-w-0"><span className="flex items-center gap-2 font-medium">{item.urgent && <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-red-500" />}{item.label}</span><span className="block truncate text-sm text-muted-foreground">{item.detail}</span></span>
        <span aria-hidden="true" className="shrink-0 text-muted-foreground">→</span>
      </Link></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Todo al día: no hay pendientes por atender.</p>}
    </section>
    <section aria-label="Accesos rápidos" className="grid gap-3 sm:grid-cols-3">
      {[{ title: "Nuevo conjunto", text: "Crea el conjunto y la invitación de su administrador.", href: "/plataforma/propiedades#nuevo", icon: Building2 },
        { title: "Usuarios", text: "Busca personas por conjunto, rol y estado.", href: "/plataforma/usuarios", icon: UsersRound },
        { title: "Equipos ResiQ", text: "Tu personal, que no pertenece a ningún conjunto.", href: "/plataforma/equipos", icon: ShieldCheck }].map(({ title, text, href, icon: Icon }) =>
        <Link key={href} href={href} className="rounded-2xl border bg-white p-5 transition-colors hover:border-primary/40 hover:bg-secondary/40"><span className="flex size-10 items-center justify-center rounded-full bg-primary/12 text-primary"><Icon size={20} aria-hidden="true" /></span><h3 className="mt-3 font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{text}</p></Link>)}
    </section>
  </PlatformPage>;
}
