import { InviteAdministratorForm, ReissueAdminInvitationForm } from "@/components/dashboard/create-property-form";
import { PlatformPage } from "@/components/dashboard/platform-page";
import { Card, CardContent } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";

type AdminRow = { property_id: string; property_name: string; property_status: string; display_name: string | null; email: string; member_status: string; since: string; invitation_id: string | null };
type PropertyRow = { property_id: string; property_name: string; property_status: string };
const statusLabels: Record<string, string> = { active: "Activo", suspended: "Suspendido", revoked: "Retirado", invited: "Invitación pendiente", expired: "Invitación vencida" };

export default async function PlatformAdministratorsPage() {
  const { supabase } = await requirePlatformAdmin();
  const [{ data, error }, { data: propertyData, error: propertyError }] = await Promise.all([supabase.rpc("platform_list_administrators"), supabase.rpc("platform_list_properties")]);
  if (error || propertyError) throw new Error("No se pudieron cargar los administradores.");
  const rows = (data ?? []) as AdminRow[];
  // Todos los conjuntos aparecen, aunque todavía no tengan administrador.
  const groups = ((propertyData ?? []) as PropertyRow[]).map((property) => ({ ...property, admins: rows.filter((row) => row.property_id === property.property_id) }));
  const date = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" });
  return <PlatformPage title="Administradores" description="Administradores de cada conjunto e invitaciones de administración. Puedes invitar otro administrador o generar un enlace nuevo si se venció.">
    {groups.map((group) => { const active = group.property_status === "active"; return <Card key={group.property_id}><CardContent>
      <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="text-lg font-semibold">{group.property_name}</h2>{!active && <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">Conjunto suspendido</span>}</div>
      <ul className="mt-4 grid gap-3">{group.admins.map((admin, index) => <li key={`${admin.email}-${index}`} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4">
        <div className="min-w-0"><p className="font-medium">{admin.display_name ?? "Sin aceptar todavía"}</p><p className="break-all text-sm text-muted-foreground">{admin.email}</p><p className="mt-1 text-xs text-muted-foreground">{admin.invitation_id ? "Invitado el" : "Desde el"} {date.format(new Date(admin.since))}</p></div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${admin.member_status === "expired" ? "bg-amber-100 text-amber-900" : "bg-secondary"}`}>{statusLabels[admin.member_status] ?? admin.member_status}</span>
        {admin.invitation_id && active && <ReissueAdminInvitationForm invitationId={admin.invitation_id} />}
      </li>)}{!group.admins.length && <li className="text-sm text-muted-foreground">Este conjunto no tiene administradores.</li>}</ul>
      {active && <details className="mt-4 border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Invitar otro administrador</summary><div className="mt-4"><InviteAdministratorForm propertyId={group.property_id} /></div></details>}
    </CardContent></Card>; })}
    {!groups.length && <Card><CardContent><p className="text-sm text-muted-foreground">Todavía no hay conjuntos.</p></CardContent></Card>}
  </PlatformPage>;
}
