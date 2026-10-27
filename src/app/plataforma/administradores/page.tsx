import { PlatformPage } from "@/components/dashboard/platform-page";
import { Card, CardContent } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";

type AdminRow = { property_id: string; property_name: string; display_name: string | null; email: string; member_status: string; since: string };
const statusLabels: Record<string, string> = { active: "Activo", suspended: "Suspendido", revoked: "Retirado", invited: "Invitación pendiente" };

export default async function PlatformAdministratorsPage() {
  const { supabase } = await requirePlatformAdmin();
  const { data, error } = await supabase.rpc("platform_list_administrators");
  if (error) throw new Error("No se pudieron cargar los administradores.");
  const rows = (data ?? []) as AdminRow[];
  const byProperty = new Map<string, { name: string; admins: AdminRow[] }>();
  for (const row of rows) byProperty.set(row.property_id, { name: row.property_name, admins: [...(byProperty.get(row.property_id)?.admins ?? []), row] });
  const date = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" });
  return <PlatformPage title="Administradores" description="Administradores de cada conjunto y las invitaciones de administración pendientes.">
    {[...byProperty.entries()].map(([id, group]) => <Card key={id}><CardContent>
      <h2 className="text-lg font-semibold">{group.name}</h2>
      <ul className="mt-4 grid gap-3">{group.admins.map((admin, index) => <li key={`${admin.email}-${index}`} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4">
        <div className="min-w-0"><p className="font-medium">{admin.display_name ?? "Sin aceptar todavía"}</p><p className="break-all text-sm text-muted-foreground">{admin.email}</p><p className="mt-1 text-xs text-muted-foreground">{admin.member_status === "invited" ? "Invitado el" : "Desde el"} {date.format(new Date(admin.since))}</p></div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{statusLabels[admin.member_status] ?? admin.member_status}</span>
      </li>)}</ul>
    </CardContent></Card>)}
    {!byProperty.size && <Card><CardContent><p className="text-sm text-muted-foreground">Todavía no hay administradores.</p></CardContent></Card>}
  </PlatformPage>;
}
