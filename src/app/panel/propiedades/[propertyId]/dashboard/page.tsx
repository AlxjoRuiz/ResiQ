import Link from "next/link";
import styles from "@/components/dashboard/dashboard.module.css";
import { redirect } from "next/navigation";
import { residentModules, conciergeModules, adminModules } from "@/components/dashboard/navigation";
import { Bell, Building2, House } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/dashboard/role-dashboard";
import { requirePropertyMember } from "@/lib/auth/require-property-member";

import { visitStatusLabel } from "@/lib/visitors/constants";
import { packageStatusLabel, receivedItemLabel } from "@/lib/packages/constants";
import { statusLabel } from "@/lib/pqrs/constants";

import { accountStatusLabel, formatCop } from "@/lib/finance/constants";
type FinanceSummary = { unit_id: string; building_name: string; unit_code: string; outstanding_balance: number | string; overdue_balance: number | string; account_status: string };
type View = "residente" | "porteria" | "administracion";
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
  if (view === "administracion") await supabase.rpc("refresh_reservations", { target_property_id: propertyId });
  const pendingReservations = view === "administracion"
    ? await supabase.from("reservations").select("id,hold_expires_at").eq("property_id", propertyId).eq("status", "pending").order("hold_expires_at", { ascending: true })
    : { data: [], error: null };
  const urgentReservations = (pendingReservations.data ?? []).filter((reservation) => reservation.hold_expires_at && new Date(reservation.hold_expires_at).getTime() - new Date().getTime() <= 2 * 60 * 60 * 1000).length;
  const [{ count: unitCount }, { count: memberCount }, { data: ownUnits }] = await Promise.all([
    supabase.from("units").select("id", { count: "exact", head: true }).eq("property_id", propertyId).eq("status", "active"),
    view === "administracion" ? supabase.from("property_members").select("id", { count: "exact", head: true }).eq("property_id", propertyId).eq("status", "active") : Promise.resolve({ count: null }),
    view === "residente" ? supabase.from("unit_memberships").select("relationship,units(code)").eq("property_id", propertyId).eq("member_id", membership.id).is("valid_to", null) : Promise.resolve({ data: [] }),
  ]);
  const [visitSummary, packageSummary, requestSummary, notificationSummary, financeSummary] = await Promise.all([
    supabase.from("visitors").select("id,visitor_name,status").eq("property_id", propertyId).in("status", view === "porteria" ? ["authorized", "entered"] : ["pending", "authorized", "entered"]).order("scheduled_start", { ascending: false }).limit(5),
    supabase.from("packages").select("id,kind,utility_service,recipient_name,status").eq("property_id", propertyId).order("received_at", { ascending: false }).limit(5),
    view !== "porteria" ? supabase.from("pqrs").select("id,subject,status").eq("property_id", propertyId).order("created_at", { ascending: false }).limit(5) : Promise.resolve({ data: [], error: null }),
    supabase.from("notifications").select("id,subject,body,read_at,occurred_at").eq("property_id", propertyId).eq("recipient_member_id", membership.id).order("occurred_at", { ascending: false }).limit(5),
    view !== "porteria" ? supabase.rpc("list_finance_account_summaries", { target_property_id: propertyId }) : Promise.resolve({ data: [], error: null }),
  ]);
  const summaries = [
    { title: view === "administracion" ? "Solicitudes de visita" : "Visitas", path: "visitas", error: visitSummary.error, rows: (visitSummary.data ?? []).map((item) => ({ id: item.id, title: item.visitor_name, status: visitStatusLabel(item.status) })) },
    { title: view === "residente" ? "Mis paquetes y recibos" : "Paquetes y recibos recientes", path: "paquetes", error: packageSummary.error, rows: (packageSummary.data ?? []).map((item) => ({ id: item.id, title: `${receivedItemLabel(item.kind, item.utility_service)} · ${item.recipient_name}`, status: packageStatusLabel(item.status) })) },
    ...(view !== "porteria" ? [{ title: view === "residente" ? "Estado de mis solicitudes" : "PQRS recientes", path: "pqrs", error: requestSummary.error, rows: (requestSummary.data ?? []).map((item) => ({ id: item.id, title: item.subject, status: statusLabel(item.status) })) }] : []),
  ];
  const financeAccounts = (financeSummary.data ?? []) as FinanceSummary[];
  const visibleBalance = financeAccounts.reduce((total, account) => total + Number(account.outstanding_balance), 0);
  const visibleOverdue = financeAccounts.reduce((total, account) => total + Number(account.overdue_balance), 0);
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
        {view === "administracion" && <section aria-label="Solicitudes de reserva pendientes" className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950"><h2 className="font-semibold">Reservas por responder</h2>{pendingReservations.error ? <p className="mt-2 text-sm">No pudimos consultar las reservas. Abre Reservas para revisarlas.</p> : pendingReservations.data?.length ? <p className="mt-2 text-sm">Hay {pendingReservations.data.length} {pendingReservations.data.length === 1 ? "solicitud pendiente" : "solicitudes pendientes"}.{urgentReservations > 0 ? ` ${urgentReservations} ${urgentReservations === 1 ? "vence" : "vencen"} en menos de 2 horas.` : ""}</p> : <p className="mt-2 text-sm">No hay solicitudes pendientes.</p>}<Link href={`/panel/propiedades/${propertyId}/reservas`} className="mt-3 inline-block text-sm font-semibold underline underline-offset-4">Revisar reservas →</Link></section>}
        {view === "residente" && units.length > 0 && <section className={styles.units}><h2>Tus apartamentos</h2><div>{units.map((unit, index) => { const related = Array.isArray(unit.units) ? unit.units[0] : unit.units as { code?: string } | null; return <span key={`${related?.code}-${index}`}>{related?.code ?? "Unidad"} · {unit.relationship === "owner" ? "Propietario" : "Residente"}</span>; })}</div></section>}
        <section className={styles.summaries} aria-label="Novedades y cartera">
          <article className={styles.summary}><header><h2>Novedades</h2><Bell size={18} aria-hidden="true" /></header>{notificationSummary.error ? <p role="status" className={styles.empty}>No pudimos cargar tus novedades.</p> : !notificationSummary.data?.length ? <p className={styles.empty}>No tienes novedades recientes.</p> : <ul>{notificationSummary.data.map((notice) => <li key={notice.id} className={styles.notice}><div><h3>{notice.subject}</h3><span className={styles.status}>{notice.read_at ? "Leída" : "Sin leer"}</span></div><p>{notice.body}</p><time dateTime={notice.occurred_at}>{new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: property.timezone }).format(new Date(notice.occurred_at))}</time></li>)}</ul>}</article>
          {view !== "porteria" && <article className={styles.summary}><header><h2>{view === "residente" ? "Mi cartera" : "Resumen de cartera"}</h2><Link href={`/panel/propiedades/${propertyId}/cartera`}>Ver cartera →</Link></header>{financeSummary.error ? <p role="status" className={styles.empty}>No pudimos cargar la cartera. Abre el módulo para consultarla.</p> : !financeAccounts.length ? <p className={styles.empty}>{view === "residente" ? "No tienes acceso financiero habilitado para ningún apartamento." : "No hay cuentas visibles."}</p> : <><div className={styles.balance}><div><p>Saldo pendiente visible</p><strong>{formatCop(visibleBalance)}</strong></div><div><p>Saldo vencido</p><strong>{formatCop(visibleOverdue)}</strong></div></div><ul>{financeAccounts.slice(0, 5).map((account) => <li key={account.unit_id}><Link href={`/panel/propiedades/${propertyId}/cartera/${account.unit_id}`}><span>{account.building_name} · {account.unit_code}<small className={styles.accountBalance}>{formatCop(account.outstanding_balance)}</small></span><span className={styles.status}>{accountStatusLabel(account.account_status)}</span></Link></li>)}</ul>{financeAccounts.length > 5 && <p className={styles.empty}>Mostrando 5 de {financeAccounts.length} cuentas visibles.</p>}</>}</article>}
        </section>
        <section className={styles.summaries} aria-label="Actividad reciente">{summaries.map((summary) => <article key={summary.path} className={styles.summary}><header><h2>{summary.title}</h2><Link href={`/panel/propiedades/${propertyId}/${summary.path}`}>Ver todo →</Link></header>{summary.error ? <p role="status" className={styles.empty}>No pudimos cargar este resumen. Puedes abrir el módulo para consultarlo.</p> : summary.rows.length === 0 ? <p className={styles.empty}>No hay registros visibles para tu cuenta.</p> : <ul>{summary.rows.map((row) => <li key={row.id}><Link href={`/panel/propiedades/${propertyId}/${summary.path}/${row.id}`}><span>{row.title}</span><span className={styles.status}>{row.status}</span></Link></li>)}</ul>}</article>)}</section>
      </div>
    </div>
  </main>;
}
