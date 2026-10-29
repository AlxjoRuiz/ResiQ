import Link from "next/link";
import { ArrowRight, ClipboardList, Clock3, FileWarning, LogOut, UserRound, Wrench } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import styles from "@/components/dashboard/dashboard.module.css";
import { MetricCard } from "@/components/dashboard/role-dashboard";
import { MaintenanceOverview, type MaintenanceDashboard } from "@/components/maintenance/maintenance-overview";
import { ReportCharts } from "@/components/maintenance/report-charts";
import { Button } from "@/components/ui/button";
import { requireMaintenanceStaff } from "@/lib/auth/require-maintenance-staff";
import { loadReport, readReportFilters } from "@/lib/maintenance/report";

// Inicio del módulo de mantenimiento. Admin (28/10/2026): dashboard como el del admin del conjunto,
// dentro del marco con la barra de secciones (ver layout). Trabajador: tarjetas de sus secciones.
export default async function MaintenanceHomePage() {
  const { supabase, userId, staff } = await requireMaintenanceStaff();
  if (staff.role === "admin") {
    // Gráficas del mes en curso (del 1 a hoy), las mismas del informe en PDF; si fallan, el resto se muestra igual.
    const month = readReportFilters({});
    const [{ data, error }, report] = await Promise.all([supabase.rpc("get_maintenance_dashboard"), loadReport(month).catch(() => null)]);
    const dashboard = error ? null : (data as MaintenanceDashboard);
    return <>
      <section className={styles.welcome}>
        <p className={styles.eyebrow}>Equipo de mantenimiento ResiQ</p>
        <div className={styles.welcomeMain}><span className={styles.welcomeIcon}><Wrench size={29} aria-hidden="true" /></span><div><h1>Panel de mantenimiento</h1></div></div>
      </section>
      <section aria-label="Resumen del equipo" className={styles.metrics}>
        <MetricCard label="Trabajadores activos" value={dashboard?.active_workers ?? "—"} />
        <MetricCard label="En jornada ahora" value={dashboard?.on_shift.length ?? "—"} />
        <MetricCard label="Tareas por revisar" value={dashboard?.to_review ?? "—"} />
      </section>
      {dashboard ? <MaintenanceOverview data={dashboard} /> : <p role="status" className="rounded-xl border p-4 text-sm text-muted-foreground">No pudimos cargar el resumen. Abre cada sección para revisarla.</p>}
      {report ? <div className="mb-6"><ReportCharts summaries={report.summaries} attendance={report.attendance} from={month.from} to={month.to} title={`Gráficas del mes · ${month.label}`} action={<Link href="/mantenimiento/informe" className="text-xs text-muted-foreground hover:text-foreground">Ver informe →</Link>} /></div> : <p role="status" className="my-6 rounded-xl border p-4 text-sm text-muted-foreground">No pudimos cargar las gráficas del mes. Ábrelas en el informe.</p>}
    </>;
  }

  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  const sections = [
    { title: "Mi asistencia", description: "Marca tu llegada con una foto y tu salida con un botón.", icon: Clock3, href: "/mantenimiento/asistencia" },
    { title: "Mis tareas", description: "Consulta tus tareas y entrégalas con fotos.", icon: ClipboardList, href: "/mantenimiento/tareas" },
    { title: "Mis llamados de atención", description: "Consulta tus llamados de atención.", icon: FileWarning, href: "/mantenimiento/llamados" },
  ];
  return <main className="mx-auto min-h-screen max-w-4xl px-5 py-7 sm:px-10">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-5">
      <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary text-white"><Wrench size={20} aria-hidden="true" /></span><div><p className="font-semibold">Mantenimiento ResiQ</p><p className="text-xs text-muted-foreground">Trabajador de mantenimiento</p></div></div>
      <div className="flex flex-wrap gap-2"><Button asChild variant="outline" size="sm"><Link href="/perfil"><UserRound size={15} />Perfil</Link></Button><form action={signOut}><Button variant="ghost" size="sm"><LogOut size={15} />Salir</Button></form></div>
    </header>
    <section className="py-7"><p className="text-sm text-muted-foreground">Hola,</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{profile?.display_name ?? "Equipo de mantenimiento"}</h1></section>
    <section aria-label="Secciones" className="grid gap-3 sm:grid-cols-2">
      {sections.map(({ title, description, icon: Icon, href }) => <Link key={title} href={href} className="rounded-2xl border bg-white p-5 transition-colors hover:border-primary/40 hover:bg-secondary/40">
        <div className="flex items-start justify-between gap-3"><span className="flex size-10 items-center justify-center rounded-full bg-primary/12 text-primary"><Icon size={20} aria-hidden="true" /></span><ArrowRight size={18} className="text-muted-foreground" aria-hidden="true" /></div>
        <h2 className="mt-4 font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </Link>)}
    </section>
  </main>;
}
