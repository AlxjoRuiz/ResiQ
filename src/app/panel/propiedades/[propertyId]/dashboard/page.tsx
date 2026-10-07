import Link from "next/link";
import styles from "@/components/dashboard/dashboard.module.css";
import { redirect } from "next/navigation";
import { Banknote, Bell, BookOpenCheck, Boxes, Building2, CalendarDays, ChartNoAxesCombined, CircleParking, DoorOpen, FileWarning, House, KeyRound, MessageSquareText, Package, UsersRound, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardModules, MetricCard, type DashboardModule } from "@/components/dashboard/role-dashboard";
import { requirePropertyMember } from "@/lib/auth/require-property-member";

import { visitStatusLabel } from "@/lib/visitors/constants";
import { packageStatusLabel } from "@/lib/packages/constants";
import { statusLabel } from "@/lib/pqrs/constants";

type View = "residente" | "porteria" | "administracion";
function residentModules(propertyId: string): DashboardModule[] { return [
  { title: "Paquetes", description: "Consulta paquetes recibidos y su estado de entrega.", icon: Package, href: `/panel/propiedades/${propertyId}/paquetes` }, { title: "Reservas", description: "Revisa zonas comunes, disponibilidad y reservas.", icon: CalendarDays, href: `/panel/propiedades/${propertyId}/reservas` }, { title: "Visitas", description: "Solicita visitas y servicios de mantenimiento.", icon: DoorOpen, href: `/panel/propiedades/${propertyId}/visitas` }, { title: "PQRS", description: "Crea solicitudes y sigue sus respuestas.", icon: MessageSquareText, href: `/panel/propiedades/${propertyId}/pqrs` }, { title: "Cartera", description: "Consulta la información financiera autorizada de tu unidad.", icon: Banknote, href: `/panel/propiedades/${propertyId}/cartera` }, { title: "Llamados", description: "Revisa llamados de atención dirigidos a ti.", icon: FileWarning, href: `/panel/propiedades/${propertyId}/llamados` }, { title: "Asambleas", description: "Consulta convocatorias y confirma asistencia.", icon: BookOpenCheck, href: `/panel/propiedades/${propertyId}/asambleas` }, { title: "Notificaciones", description: "Encuentra las novedades de tu comunidad.", icon: Bell },
]; }
function conciergeModules(propertyId: string): DashboardModule[] { return [
  { title: "Paquetes", description: "Registra recepciones y entregas.", icon: Package, href: `/panel/propiedades/${propertyId}/paquetes` }, { title: "Visitas", description: "Consulta visitantes autorizados.", icon: DoorOpen, href: `/panel/propiedades/${propertyId}/visitas` }, { title: "Mantenimiento", description: "Revisa servicios técnicos autorizados.", icon: Wrench, href: `/panel/propiedades/${propertyId}/visitas?tipo=maintenance` }, { title: "Ingresos", description: "Registra entradas con la autorización correspondiente.", icon: KeyRound, href: `/panel/propiedades/${propertyId}/visitas?estado=authorized` }, { title: "Salidas", description: "Completa el registro de salida.", icon: CircleParking, href: `/panel/propiedades/${propertyId}/visitas?estado=entered` }, { title: "Reservas", description: "Consulta reservas vigentes de zonas comunes.", icon: CalendarDays, href: `/panel/propiedades/${propertyId}/reservas` },
]; }
function adminModules(propertyId: string): DashboardModule[] { return [
  { title: "Residentes", description: "Gestiona miembros, roles y vínculos con apartamentos.", icon: UsersRound, href: `/panel/propiedades/${propertyId}/miembros` }, { title: "Propiedad", description: "Administra los datos generales de la comunidad.", icon: Building2, href: `/panel/propiedades/${propertyId}` }, { title: "Apartamentos", description: "Gestiona torres, apartamentos, pisos y estados.", icon: House, href: `/panel/propiedades/${propertyId}/estructura` }, { title: "PQRS", description: "Gestiona solicitudes, responsables y estados.", icon: MessageSquareText, href: `/panel/propiedades/${propertyId}/pqrs` }, { title: "Paquetes", description: "Consulta recepciones, avisos y entregas.", icon: Package, href: `/panel/propiedades/${propertyId}/paquetes` }, { title: "Visitas", description: "Acepta o rechaza solicitudes y consulta su historial.", icon: DoorOpen, href: `/panel/propiedades/${propertyId}/visitas` }, { title: "Reservas", description: "Administra disponibilidad y solicitudes.", icon: CalendarDays, href: `/panel/propiedades/${propertyId}/reservas` }, { title: "Cartera", description: "Consulta y actualiza obligaciones autorizadas.", icon: Banknote, href: `/panel/propiedades/${propertyId}/cartera` }, { title: "Llamados", description: "Registra y gestiona llamados de atención.", icon: FileWarning, href: `/panel/propiedades/${propertyId}/llamados` }, { title: "Asambleas", description: "Publica convocatorias y administra asistencia.", icon: BookOpenCheck, href: `/panel/propiedades/${propertyId}/asambleas` }, { title: "Zonas", description: "Configura zonas comunes y horarios.", icon: Boxes, href: `/panel/propiedades/${propertyId}/zonas` }, { title: "Reportes", description: "Consulta indicadores operativos de la propiedad.", icon: ChartNoAxesCombined },
]; }

export default async function PropertyDashboardPage({ params, searchParams }: { params: Promise<{ propertyId: string }>; searchParams: Promise<{ vista?: string }> }) {
  const { propertyId } = await params;
  const { supabase, membership, property } = await requirePropertyMember(propertyId);
  const views: View[] = [];
  if (membership.roles.includes("member")) views.push("residente");
  if (membership.roles.includes("concierge")) views.push("porteria");
  if (membership.roles.includes("administrator")) views.push("administracion");
  const requested = (await searchParams).vista as View | undefined;
  const view = requested && views.includes(requested) ? requested : views.at(-1);
  if (!view) redirect("/panel");
  const [{ count: unitCount }, { count: memberCount }, { data: ownUnits }] = await Promise.all([
    supabase.from("units").select("id", { count: "exact", head: true }).eq("property_id", propertyId).eq("status", "active"),
    view === "administracion" ? supabase.from("property_members").select("id", { count: "exact", head: true }).eq("property_id", propertyId).eq("status", "active") : Promise.resolve({ count: null }),
    view === "residente" ? supabase.from("unit_memberships").select("relationship,units(code)").eq("property_id", propertyId).eq("member_id", membership.id).is("valid_to", null) : Promise.resolve({ data: [] }),
  ]);
  const [visitSummary, packageSummary, requestSummary] = await Promise.all([
    supabase.from("visitors").select("id,visitor_name,status").eq("property_id", propertyId).in("status", view === "porteria" ? ["authorized", "entered"] : ["pending", "authorized", "entered"]).order("scheduled_start", { ascending: false }).limit(5),
    supabase.from("packages").select("id,recipient_name,status").eq("property_id", propertyId).order("received_at", { ascending: false }).limit(5),
    view !== "porteria" ? supabase.from("pqrs").select("id,subject,status").eq("property_id", propertyId).order("created_at", { ascending: false }).limit(5) : Promise.resolve({ data: [], error: null }),
  ]);
  const summaries = [
    { title: view === "administracion" ? "Solicitudes de visita" : "Visitas", path: "visitas", error: visitSummary.error, rows: (visitSummary.data ?? []).map((item) => ({ id: item.id, title: item.visitor_name, status: visitStatusLabel(item.status) })) },
    { title: view === "residente" ? "Mis paquetes" : "Paquetes recientes", path: "paquetes", error: packageSummary.error, rows: (packageSummary.data ?? []).map((item) => ({ id: item.id, title: item.recipient_name, status: packageStatusLabel(item.status) })) },
    ...(view !== "porteria" ? [{ title: view === "residente" ? "Mis solicitudes" : "PQRS recientes", path: "pqrs", error: requestSummary.error, rows: (requestSummary.data ?? []).map((item) => ({ id: item.id, title: item.subject, status: statusLabel(item.status) })) }] : []),
  ];
  const units = ownUnits ?? [];
  const modules = view === "administracion" ? adminModules(propertyId) : view === "porteria" ? conciergeModules(propertyId) : residentModules(propertyId);
  const viewLabel = view === "administracion" ? "Administración" : view === "porteria" ? "Portería" : "Residente";
  return <main className={styles.canvas}>
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/panel" className={styles.brand}><Building2 size={27} aria-hidden="true" />ResiQ</Link>
        <p className={styles.sidebarLabel}>{viewLabel}</p>
        <nav aria-label={`Navegación de ${viewLabel.toLowerCase()}`} className={styles.navigation}>
          <Link href={`/panel/propiedades/${propertyId}/dashboard?vista=${view}`} aria-current="page" className={styles.activeLink}><House size={19} aria-hidden="true" />Inicio</Link>
          {modules.filter((module) => module.href).map(({ title, href, icon: Icon }) => <Link key={title} href={href!}><Icon size={19} aria-hidden="true" />{title}</Link>)}
        </nav>
        <Link href="/panel" className={styles.communityLink}>← Mis comunidades</Link>
      </aside>
      <div className={styles.content}>
        <header className={styles.topbar}>
          <div className={styles.property}><Building2 size={19} aria-hidden="true" /><span>{property.name}</span></div>
          <div className={styles.roleSwitcher} aria-label="Seleccionar perfil">{views.map((allowedView) => <Button key={allowedView} asChild size="sm" variant={allowedView === view ? "default" : "outline"}><Link href={`/panel/propiedades/${propertyId}/dashboard?vista=${allowedView}`} aria-current={allowedView === view ? "page" : undefined}>{allowedView === "administracion" ? "Administración" : allowedView === "porteria" ? "Portería" : "Residente"}</Link></Button>)}</div>
        </header>
        <section className={styles.welcome}>
          <span className={styles.welcomeIcon}><House size={29} aria-hidden="true" /></span>
          <div><p className={styles.eyebrow}>Tu comunidad, conectada</p><h1>Panel de {viewLabel.toLowerCase()}</h1><p>{[property.address, property.city].filter(Boolean).join(" · ") || property.name}</p></div>
        </section>
        <section aria-label="Resumen del perfil" className={styles.metrics}>
          <MetricCard label={view === "residente" ? "Apartamentos vinculados" : "Apartamentos activos"} value={view === "residente" ? units.length : unitCount ?? 0} />
          <MetricCard label="Perfil actual" value={viewLabel} />
          <MetricCard label={view === "administracion" ? "Miembros activos" : "Comunidad"} value={view === "administracion" ? memberCount ?? 0 : "Activa"} />
        </section>
        {view === "residente" && units.length > 0 && <section className={styles.units}><h2>Tus apartamentos</h2><div>{units.map((unit, index) => { const related = Array.isArray(unit.units) ? unit.units[0] : unit.units as { code?: string } | null; return <span key={`${related?.code}-${index}`}>{related?.code ?? "Unidad"} · {unit.relationship === "owner" ? "Propietario" : "Residente"}</span>; })}</div></section>}
        <section aria-labelledby="dashboard-functions"><div className={styles.sectionHeading}><div><p>Todo lo que necesitas, en un lugar</p><h2 id="dashboard-functions">{view === "porteria" ? "Operación de portería" : view === "administracion" ? "Gestión de la comunidad" : "Mis servicios"}</h2></div><span>{viewLabel}</span></div><DashboardModules modules={modules} /></section>
        <section className={styles.summaries} aria-label="Actividad reciente">{summaries.map((summary) => <article key={summary.path} className={styles.summary}><header><h2>{summary.title}</h2><Link href={`/panel/propiedades/${propertyId}/${summary.path}`}>Ver todo →</Link></header>{summary.error ? <p role="status" className={styles.empty}>No pudimos cargar este resumen. Puedes abrir el módulo para consultarlo.</p> : summary.rows.length === 0 ? <p className={styles.empty}>No hay registros visibles para tu cuenta.</p> : <ul>{summary.rows.map((row) => <li key={row.id}><Link href={`/panel/propiedades/${propertyId}/${summary.path}/${row.id}`}><span>{row.title}</span><span className={styles.status}>{row.status}</span></Link></li>)}</ul>}</article>)}</section>
      </div>
    </div>
  </main>;
}
