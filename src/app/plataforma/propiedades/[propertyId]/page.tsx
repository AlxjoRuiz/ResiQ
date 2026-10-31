import Link from "next/link";
import { notFound } from "next/navigation";
import { InviteAdministratorForm, ReissueAdminInvitationForm } from "@/components/dashboard/create-property-form";
import { PlatformPage } from "@/components/dashboard/platform-page";
import { LegalAssignmentForm, PropertyStatusForm, PropertyTestForm } from "@/components/dashboard/platform-forms";
import { Card, CardContent } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { dateInputValue } from "@/lib/time-zone";
import { propertyStatusLabel, propertyStatusTone } from "../../property-status";
import { loadTestScope } from "../../test-scope";

type PropertyRow = { property_id: string; property_name: string; city: string | null; property_status: string; unit_count: number; resident_count: number; concierge_count: number; administrator_count: number };
type AdminRow = { property_id: string; display_name: string | null; email: string; member_status: string; since: string; invitation_id: string | null; is_assistant: boolean | null };
type UserRow = { property_id: string; user_name: string | null; email: string; user_role: string; unit_label: string | null; user_status: string; since: string; invitation_id: string | null };
type AssignmentRow = { property_id: string; assigned: boolean; overdue_days: number };
type UsageRow = { property_id: string; pqrs_count: number; package_count: number; visitor_count: number; reservation_count: number };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const roleLabels: Record<string, string> = { resident: "Residente", concierge: "Portería", administrator: "Administrador", assistant: "Auxiliar" };
const statusLabels: Record<string, string> = { active: "Activo", suspended: "Suspendido", revoked: "Retirado", invited: "Invitación enviada", expired: "Invitación vencida" };
const statusTones: Record<string, string> = { active: "bg-primary/12 text-primary", suspended: "bg-red-100 text-red-800", invited: "bg-secondary", expired: "bg-amber-100 text-amber-900" };

function Figure({ value, label }: { value: number; label: string }) {
  return <Card><CardContent><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p></CardContent></Card>;
}

// Ficha de un conjunto (30/10/2026): reúne lo que antes estaba en Propiedades, Administradores y Usuarios.
// Datos personales visibles solo para el superadmin (Ley 1581: validar con asesor legal).
export default async function PlatformPropertyPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  if (!uuidPattern.test(propertyId)) notFound();
  const { supabase } = await requirePlatformAdmin();
  const month = dateInputValue(new Date(), "America/Bogota").slice(0, 7);
  const [scope, { data: propertyData, error: propertyError }, { data: adminData, error: adminError }, { data: userData, error: userError }, { data: usageData, error: usageError }, { data: assignmentData, error: assignmentError }] = await Promise.all([
    loadTestScope(supabase),
    supabase.rpc("platform_list_properties"),
    supabase.rpc("platform_list_administrators"),
    supabase.rpc("platform_list_users"),
    supabase.rpc("platform_usage_by_month", { target_month: `${month}-01` }),
    supabase.rpc("platform_list_legal_assignments"),
  ]);
  if (propertyError || adminError || userError || usageError || assignmentError) throw new Error("No se pudo cargar el conjunto.");
  const property = ((propertyData ?? []) as PropertyRow[]).find((row) => row.property_id === propertyId);
  if (!property) notFound();
  const admins = ((adminData ?? []) as AdminRow[]).filter((row) => row.property_id === propertyId);
  const people = ((userData ?? []) as UserRow[]).filter((row) => row.property_id === propertyId);
  const usage = ((usageData ?? []) as UsageRow[]).find((row) => row.property_id === propertyId);
  const legal = ((assignmentData ?? []) as AssignmentRow[]).find((row) => row.property_id === propertyId);
  const active = property.property_status === "active";
  const isTest = scope.isTestProperty(propertyId);
  const date = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" });
  const monthLabel = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
  const count = (status: string) => people.filter((person) => person.user_status === status).length;

  return <PlatformPage eyebrow="Conjunto" title={property.property_name} description={property.city ?? "Sin ciudad"}
    back={<Link href={isTest ? "/plataforma/pruebas" : "/plataforma/propiedades"} className="text-sm text-muted-foreground hover:text-foreground">{isTest ? "← Pruebas ResiQ" : "← Conjuntos"}</Link>}
    actions={<span className="flex flex-wrap gap-2">{isTest && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">De prueba</span>}<span className={`rounded-full px-3 py-1 text-xs font-medium ${propertyStatusTone(property.property_status)}`}>{propertyStatusLabel(property.property_status)}</span></span>}>
    <section aria-label="Cifras del conjunto" className="grid gap-4 sm:grid-cols-4">
      <Figure value={property.unit_count} label="Apartamentos" /><Figure value={property.resident_count} label="Residentes" /><Figure value={property.concierge_count} label="Portería" /><Figure value={property.administrator_count} label="Administradores" />
    </section>

    <section><h2 className="mb-3 text-lg font-semibold first-letter:uppercase">Uso en {monthLabel}</h2><div className="grid gap-4 sm:grid-cols-4">
      <Figure value={usage?.pqrs_count ?? 0} label="PQRS" /><Figure value={usage?.package_count ?? 0} label="Paquetes" /><Figure value={usage?.visitor_count ?? 0} label="Visitas" /><Figure value={usage?.reservation_count ?? 0} label="Reservas" />
    </div></section>

    <Card><CardContent>
      <h2 className="text-lg font-semibold">Administración</h2>
      <p className="mt-1 text-sm text-muted-foreground">Administradores y auxiliares del conjunto, con las invitaciones pendientes.</p>
      <ul className="mt-4 grid gap-3">{admins.map((admin, index) => <li key={`${admin.email}-${admin.invitation_id ?? index}`} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="min-w-0"><p className="flex flex-wrap items-center gap-2 font-medium">{admin.display_name ?? "Sin aceptar todavía"}{admin.is_assistant && <span className="rounded-full bg-primary/12 px-2 py-0.5 text-xs font-medium text-primary">Auxiliar</span>}</p><p className="break-all text-sm text-muted-foreground">{admin.email}</p><p className="mt-1 text-xs text-muted-foreground">{admin.invitation_id ? "Invitado el" : "Desde el"} {date.format(new Date(admin.since))}</p></div>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${statusTones[admin.member_status] ?? "bg-secondary"}`}>{statusLabels[admin.member_status] ?? admin.member_status}</span>
        {admin.invitation_id && active && <div className="sm:col-span-2"><ReissueAdminInvitationForm invitationId={admin.invitation_id} /></div>}
      </li>)}{!admins.length && <li className="text-sm text-muted-foreground">Este conjunto no tiene administradores.</li>}</ul>
      {active && <details className="mt-4 border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Invitar otro administrador</summary><div className="mt-4"><InviteAdministratorForm propertyId={property.property_id} /></div></details>}
    </CardContent></Card>

    <Card><CardContent><details>
      <summary className="cursor-pointer"><span className="text-lg font-semibold">Usuarios</span><span className="mt-2 flex flex-wrap gap-2 text-xs"><span className={`rounded-full px-3 py-1 ${statusTones.active}`}>{count("active")} activos</span><span className={`rounded-full px-3 py-1 ${statusTones.invited}`}>{count("invited")} con invitación enviada</span><span className={`rounded-full px-3 py-1 ${statusTones.expired}`}>{count("expired")} con invitación vencida</span>{count("suspended") > 0 && <span className={`rounded-full px-3 py-1 ${statusTones.suspended}`}>{count("suspended")} suspendidos</span>}</span></summary>
      <ul className="mt-4 grid gap-2">{people.map((person, index) => <li key={`${person.email}-${person.invitation_id ?? index}`} className="grid gap-2 rounded-xl border p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="min-w-0"><p className="font-medium">{person.user_name ?? "Sin nombre"} <span className="text-xs font-normal text-muted-foreground">· {roleLabels[person.user_role] ?? person.user_role}{person.unit_label ? ` · ${person.unit_label}` : ""}</span></p><p className="break-all text-muted-foreground">{person.email}</p><p className="text-xs text-muted-foreground">{person.invitation_id ? "Invitado el" : "Desde el"} {date.format(new Date(person.since))}</p></div>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${statusTones[person.user_status] ?? "bg-secondary"}`}>{statusLabels[person.user_status] ?? person.user_status}</span>
      </li>)}{!people.length && <li className="text-sm text-muted-foreground">Este conjunto no tiene usuarios ni invitaciones pendientes.</li>}</ul>
    </details></CardContent></Card>

    {legal && <Card><CardContent>
      <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">Jurídica{legal.assigned && <span className="rounded-full bg-primary/12 px-2 py-0.5 text-xs font-medium text-primary">Asignado · {legal.overdue_days} días</span>}</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">Si lo asignas, la abogada de cobros ve la cartera de este conjunto en solo lectura y quiénes superan el umbral de mora.</p>
      <LegalAssignmentForm key={`${legal.assigned}-${legal.overdue_days}`} propertyId={property.property_id} assigned={legal.assigned} overdueDays={legal.overdue_days} />
    </CardContent></Card>}

    {property.property_status !== "archived" && <Card><CardContent>
      <h2 className="text-lg font-semibold">Estado del conjunto</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">Suspender bloquea el acceso de todo el conjunto sin borrar datos; reactivar lo devuelve como estaba.</p>
      <PropertyStatusForm key={property.property_status} propertyId={property.property_id} propertyName={property.property_name} suspended={property.property_status === "suspended"} />
    </CardContent></Card>}

    <Card><CardContent>
      <h2 className="text-lg font-semibold">{isTest ? "Conjunto de prueba" : "Producción"}</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">{isTest ? "Sale solo en Pruebas ResiQ, con toda su gente, y no cuenta en Inicio, Usuarios ni Métricas." : "Si es un conjunto para pruebas, pásalo a Pruebas ResiQ para que no se mezcle con producción."} Funciona igual en ambos casos.</p>
      <PropertyTestForm key={String(isTest)} propertyId={property.property_id} isTest={isTest} />
    </CardContent></Card>
  </PlatformPage>;
}
