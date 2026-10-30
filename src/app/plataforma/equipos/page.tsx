import { InviteMaintenanceAdminForm, ReissueMaintenanceInvitationForm } from "@/components/dashboard/create-property-form";
import { PlatformPage } from "@/components/dashboard/platform-page";
import { Card, CardContent } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";

type MaintenanceRow = { staff_id: string | null; invitation_id: string | null; display_name: string | null; email: string; member_status: string; since: string };
const statusLabels: Record<string, string> = { active: "Activo", suspended: "Suspendido", revoked: "Retirado", invited: "Invitación pendiente", expired: "Invitación vencida" };

// Equipos ResiQ (30/10/2026): el personal propio de ResiQ, que no pertenece a ningún conjunto. Antes el
// equipo de mantenimiento estaba dentro de «Administradores», mezclado con los administradores de conjuntos.
export default async function PlatformTeamsPage() {
  const { supabase } = await requirePlatformAdmin();
  const { data, error } = await supabase.rpc("platform_list_maintenance_admins");
  if (error) throw new Error("No se pudo cargar el equipo de mantenimiento.");
  const maintenanceAdmins = (data ?? []) as MaintenanceRow[];
  const date = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" });
  return <PlatformPage title="Equipos ResiQ" description="Tu personal, que no pertenece a ningún conjunto.">
    <Card><CardContent>
      <h2 className="text-lg font-semibold">Equipo de mantenimiento</h2>
      <p className="mt-1 text-sm text-muted-foreground">El admin de mantenimiento entra con el enlace a su correo y solo ve el módulo de mantenimiento. Él crea a sus trabajadores.</p>
      <ul className="mt-4 grid gap-3">{maintenanceAdmins.map((admin, index) => <li key={`${admin.email}-${index}`} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4">
        <div className="min-w-0"><p className="font-medium">{admin.display_name ?? "Sin aceptar todavía"}</p><p className="break-all text-sm text-muted-foreground">{admin.email}</p><p className="mt-1 text-xs text-muted-foreground">{admin.invitation_id ? "Invitado el" : "Desde el"} {date.format(new Date(admin.since))}</p></div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${admin.member_status === "expired" ? "bg-amber-100 text-amber-900" : "bg-secondary"}`}>{statusLabels[admin.member_status] ?? admin.member_status}</span>
        {admin.invitation_id && <ReissueMaintenanceInvitationForm invitationId={admin.invitation_id} />}
      </li>)}{!maintenanceAdmins.length && <li className="text-sm text-muted-foreground">Todavía no hay admin de mantenimiento.</li>}</ul>
      <details className="mt-4 border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Invitar admin de mantenimiento</summary><div className="mt-4"><InviteMaintenanceAdminForm /></div></details>
    </CardContent></Card>
  </PlatformPage>;
}
