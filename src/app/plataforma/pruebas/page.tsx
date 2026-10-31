import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ReissueLegalInvitationForm, ReissueMaintenanceInvitationForm } from "@/components/dashboard/create-property-form";
import { PlatformPage } from "@/components/dashboard/platform-page";
import { LegalAssignmentForm, RemoveTestEmailForm, TestEmailForm } from "@/components/dashboard/platform-forms";
import { Card, CardContent } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { propertyStatusLabel, propertyStatusTone } from "../property-status";
import { loadTestScope } from "../test-scope";

type PropertyRow = { property_id: string; property_name: string; city: string | null; property_status: string; unit_count: number; resident_count: number; concierge_count: number; administrator_count: number };
type StaffRow = { staff_id: string | null; invitation_id: string | null; display_name: string | null; email: string; member_status: string; since: string };
type AssignmentRow = { property_id: string; assigned: boolean; overdue_days: number };
const statusLabels: Record<string, string> = { active: "Activo", suspended: "Suspendido", revoked: "Retirado", invited: "Invitación pendiente", expired: "Invitación vencida" };

// Pruebas ResiQ (31/10/2026): todo lo de prueba en un solo lugar, separado de producción. Conjuntos de
// prueba con su administración, portería y residentes (en la ficha de cada uno) y el personal de prueba
// de mantenimiento y jurídica. Funciona igual que lo de producción.
export default async function PlatformTestsPage() {
  const { supabase } = await requirePlatformAdmin();
  const [scope, { data: propertyData, error: propertyError }, { data: maintenanceData, error: maintenanceError }, { data: legalData, error: legalError }, { data: assignmentData, error: assignmentError }] = await Promise.all([
    loadTestScope(supabase),
    supabase.rpc("platform_list_properties"),
    supabase.rpc("platform_list_maintenance_admins"),
    supabase.rpc("platform_list_legal"),
    supabase.rpc("platform_list_legal_assignments"),
  ]);
  if (propertyError || maintenanceError || legalError || assignmentError) throw new Error("No se pudo cargar Pruebas ResiQ.");
  const properties = ((propertyData ?? []) as PropertyRow[]).filter((row) => scope.isTestProperty(row.property_id));
  const assignments = new Map(((assignmentData ?? []) as AssignmentRow[]).map((row) => [row.property_id, row]));
  const staff = [
    ...((maintenanceData ?? []) as StaffRow[]).map((row) => ({ ...row, team: "Mantenimiento" as const })),
    ...((legalData ?? []) as StaffRow[]).map((row) => ({ ...row, team: "Jurídica" as const })),
  ].filter((row) => scope.isTestEmail(row.email));
  const date = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" });

  return <PlatformPage title="Pruebas ResiQ" description="Conjuntos y cuentas de prueba, separados de lo que está en producción.">
    <section aria-labelledby="conjuntos-prueba" className="grid gap-3">
      <div><h2 id="conjuntos-prueba" className="text-lg font-semibold">Conjuntos de prueba</h2><p className="mt-1 text-sm text-muted-foreground">Cada uno abre su ficha con administradores, auxiliares, portería y residentes. Para pasar uno a producción, o un conjunto de producción a pruebas, usa el botón al final de su ficha.</p></div>
      {properties.map((row) => { const legal = assignments.get(row.property_id); return <Card key={row.property_id}><CardContent className="grid gap-4">
        <Link href={`/plataforma/propiedades/${row.property_id}`} className="flex items-center justify-between gap-3 hover:underline">
          <span className="min-w-0"><span className="block text-lg font-semibold">{row.property_name}</span><span className="block text-sm text-muted-foreground">{row.city ?? "Sin ciudad"} · {row.unit_count} apartamentos · {row.resident_count} residentes · {row.concierge_count} portería · {row.administrator_count} {row.administrator_count === 1 ? "administrador" : "administradores"}</span></span>
          <span className="flex shrink-0 items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-medium ${propertyStatusTone(row.property_status)}`}>{propertyStatusLabel(row.property_status)}</span><ChevronRight size={18} aria-hidden="true" className="text-muted-foreground" /></span>
        </Link>
        {legal && <div className="border-t pt-4"><LegalAssignmentForm key={`${legal.assigned}-${legal.overdue_days}`} propertyId={row.property_id} assigned={legal.assigned} overdueDays={legal.overdue_days} /></div>}
      </CardContent></Card>; })}
      {!properties.length && <Card><CardContent><p className="text-sm text-muted-foreground">No hay conjuntos de prueba.</p></CardContent></Card>}
    </section>

    <Card><CardContent>
      <h2 className="text-lg font-semibold">Personal de prueba</h2>
      <p className="mt-1 text-sm text-muted-foreground">Admins de mantenimiento y abogadas con correo de prueba. Se invitan desde Equipos ResiQ y aparecen aquí en lugar de allá.</p>
      <ul className="mt-4 grid gap-3">{staff.map((person, index) => <li key={`${person.team}-${person.email}-${index}`} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4">
        <div className="min-w-0"><p className="flex flex-wrap items-center gap-2 font-medium">{person.display_name ?? "Sin aceptar todavía"}<span className="rounded-full bg-primary/12 px-2 py-0.5 text-xs font-medium text-primary">{person.team}</span></p><p className="break-all text-sm text-muted-foreground">{person.email}</p><p className="mt-1 text-xs text-muted-foreground">{person.invitation_id ? "Invitación del" : "Desde el"} {date.format(new Date(person.since))}</p></div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${person.member_status === "expired" ? "bg-amber-100 text-amber-900" : "bg-secondary"}`}>{statusLabels[person.member_status] ?? person.member_status}</span>
        {person.invitation_id && (person.team === "Jurídica" ? <ReissueLegalInvitationForm invitationId={person.invitation_id} /> : <ReissueMaintenanceInvitationForm invitationId={person.invitation_id} />)}
      </li>)}{!staff.length && <li className="text-sm text-muted-foreground">No hay personal de prueba.</li>}</ul>
    </CardContent></Card>

    <Card><CardContent>
      <h2 className="text-lg font-semibold">Correos de prueba</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">El personal de ResiQ con estos correos sale solo en Pruebas. Los correos que terminan en @resiq.invalid cuentan siempre como de prueba.</p>
      <TestEmailForm />
      <ul className="mt-4 grid gap-2">{scope.emails.map((email) => <li key={email} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm"><span className="break-all">{email}</span><RemoveTestEmailForm email={email} /></li>)}
        {!scope.emails.length && <li className="text-sm text-muted-foreground">Todavía no hay correos marcados.</li>}</ul>
    </CardContent></Card>
  </PlatformPage>;
}
