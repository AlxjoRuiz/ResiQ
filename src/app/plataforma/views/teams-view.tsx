import Link from "next/link";
import { InviteLegalForm, InviteMaintenanceAdminForm, ReissueLegalInvitationForm, ReissueMaintenanceInvitationForm } from "@/components/dashboard/create-property-form";
import { LegalAssignmentForm, RemoveTestEmailForm, TestEmailForm } from "@/components/dashboard/platform-forms";
import { Card, CardContent } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { loadTestScope } from "../test-scope";

type MaintenanceRow = { staff_id: string | null; invitation_id: string | null; display_name: string | null; email: string; member_status: string; since: string };
type AssignmentRow = { property_id: string; property_name: string; property_status: string; assigned: boolean; overdue_days: number };
const statusLabels: Record<string, string> = { active: "Activo", suspended: "Suspendido", revoked: "Retirado", invited: "Invitación pendiente", expired: "Invitación vencida" };

// Equipos ResiQ (30/10/2026): el personal propio de ResiQ, que no pertenece a ningún conjunto. Desde el
// 31/10/2026 la misma vista sirve para producción y para Pruebas ResiQ (test): en pruebas muestra el
// personal con correo de prueba y los conjuntos de prueba, y lo que se invita allí queda como de prueba.
export async function TeamsView({ test = false }: { test?: boolean }) {
  const { supabase } = await requirePlatformAdmin();
  const [scope, { data, error }, { data: legalData, error: legalError }, { data: assignmentData, error: assignmentError }] = await Promise.all([
    loadTestScope(supabase), supabase.rpc("platform_list_maintenance_admins"), supabase.rpc("platform_list_legal"), supabase.rpc("platform_list_legal_assignments"),
  ]);
  if (error || legalError || assignmentError) throw new Error("No se pudieron cargar los equipos.");
  const maintenanceAdmins = ((data ?? []) as MaintenanceRow[]).filter((row) => scope.isTestEmail(row.email) === test);
  // Módulo jurídico (31/10/2026): una sola abogada, con los mismos campos que el equipo de mantenimiento.
  const legalTeam = ((legalData ?? []) as MaintenanceRow[]).filter((row) => scope.isTestEmail(row.email) === test);
  const assignments = ((assignmentData ?? []) as AssignmentRow[]).filter((row) => scope.isTestProperty(row.property_id) === test);
  const date = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" });
  return <>
    <Card><CardContent>
      <h2 className="text-lg font-semibold">Equipo de mantenimiento</h2>
      <p className="mt-1 text-sm text-muted-foreground">El admin de mantenimiento entra con el enlace a su correo y solo ve el módulo de mantenimiento. Él crea a sus trabajadores.</p>
      <ul className="mt-4 grid gap-3">{maintenanceAdmins.map((admin, index) => <li key={`${admin.email}-${index}`} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4">
        <div className="min-w-0"><p className="font-medium">{admin.display_name ?? "Sin aceptar todavía"}</p><p className="break-all text-sm text-muted-foreground">{admin.email}</p><p className="mt-1 text-xs text-muted-foreground">{admin.invitation_id ? "Invitado el" : "Desde el"} {date.format(new Date(admin.since))}</p></div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${admin.member_status === "expired" ? "bg-amber-100 text-amber-900" : "bg-secondary"}`}>{statusLabels[admin.member_status] ?? admin.member_status}</span>
        {admin.invitation_id && <ReissueMaintenanceInvitationForm invitationId={admin.invitation_id} />}
      </li>)}{!maintenanceAdmins.length && <li className="text-sm text-muted-foreground">Todavía no hay admin de mantenimiento.</li>}</ul>
      <details className="mt-4 border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Invitar admin de mantenimiento</summary><div className="mt-4"><InviteMaintenanceAdminForm test={test} /></div></details>
    </CardContent></Card>

    <Card id={test ? "juridica-prueba" : "juridica"} className="scroll-mt-6"><CardContent>
      <h2 className="text-lg font-semibold">Jurídica</h2>
      <p className="mt-1 text-sm text-muted-foreground">La abogada de cobros entra con el enlace a su correo y solo ve la cartera, en solo lectura, de los conjuntos que le asignes.</p>
      <ul className="mt-4 grid gap-3">{legalTeam.map((person, index) => <li key={`${person.email}-${index}`} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4">
        <div className="min-w-0"><p className="font-medium">{person.display_name ?? "Sin aceptar todavía"}</p><p className="break-all text-sm text-muted-foreground">{person.email}</p><p className="mt-1 text-xs text-muted-foreground">{person.invitation_id ? "Invitada el" : "Desde el"} {date.format(new Date(person.since))}</p></div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${person.member_status === "expired" ? "bg-amber-100 text-amber-900" : "bg-secondary"}`}>{statusLabels[person.member_status] ?? person.member_status}</span>
        {person.invitation_id && <ReissueLegalInvitationForm invitationId={person.invitation_id} />}
      </li>)}{!legalTeam.length && <li className="text-sm text-muted-foreground">Todavía no hay abogada.</li>}</ul>
      {!legalTeam.some((person) => person.staff_id) && <details className="mt-4 border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Invitar abogada</summary><div className="mt-4"><InviteLegalForm test={test} /></div></details>}
      <div className="mt-6 border-t pt-5">
        <h3 className="font-semibold">Conjuntos asignados</h3>
        <p className="mt-1 text-sm text-muted-foreground">Marca los conjuntos cuya cartera le llega a la abogada y el umbral de mora de cada uno (días desde el vencimiento más antiguo sin pagar). Si quitas un conjunto, deja de verlo al instante.</p>
        <ul className="mt-4 grid gap-3">{assignments.map((row) => <li key={row.property_id} className="grid gap-3 rounded-xl border p-4">
          <p className="flex flex-wrap items-center gap-2 font-medium"><Link href={`/plataforma/propiedades/${row.property_id}`} className="hover:underline">{row.property_name}</Link>{row.property_status === "suspended" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">Suspendido</span>}{row.assigned && <span className="rounded-full bg-primary/12 px-2 py-0.5 text-xs text-primary">En jurídica · {row.overdue_days} días</span>}</p>
          <LegalAssignmentForm key={`${row.assigned}-${row.overdue_days}`} propertyId={row.property_id} assigned={row.assigned} overdueDays={row.overdue_days} />
        </li>)}{!assignments.length && <li className="text-sm text-muted-foreground">Todavía no hay conjuntos.</li>}</ul>
      </div>
    </CardContent></Card>

    {test && <Card><CardContent>
      <h2 className="text-lg font-semibold">Correos de prueba</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">El personal de ResiQ con estos correos sale aquí y no en producción. Lo que invitas desde Pruebas ResiQ se agrega solo; los correos que terminan en @resiq.invalid cuentan siempre como de prueba.</p>
      <TestEmailForm />
      <ul className="mt-4 grid gap-2">{scope.emails.map((email) => <li key={email} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm"><span className="break-all">{email}</span><RemoveTestEmailForm email={email} /></li>)}
        {!scope.emails.length && <li className="text-sm text-muted-foreground">Todavía no hay correos marcados.</li>}</ul>
    </CardContent></Card>}
  </>;
}
