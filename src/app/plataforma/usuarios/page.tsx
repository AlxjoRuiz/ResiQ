import { ReissueAdminInvitationForm } from "@/components/dashboard/create-property-form";
import { PlatformPage } from "@/components/dashboard/platform-page";
import { Card, CardContent } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";

type PropertyRow = { property_id: string; property_name: string; city: string | null; property_status: string; unit_count: number; resident_count: number; concierge_count: number; administrator_count: number };
type InvitationRow = { property_id: string; property_name: string; property_status: string; email: string; member_status: string; since: string; invitation_id: string | null; is_assistant: boolean | null };
type CountKey = "unit_count" | "resident_count" | "concierge_count" | "administrator_count";
const columns: [string, CountKey][] = [["Apartamentos", "unit_count"], ["Residentes", "resident_count"], ["Portería", "concierge_count"], ["Administradores", "administrator_count"]];

// Solo cantidades por conjunto: sin nombres ni correos de residentes.
export default async function PlatformUsersPage() {
  const { supabase } = await requirePlatformAdmin();
  const [{ data, error }, { data: adminData, error: adminError }] = await Promise.all([supabase.rpc("platform_list_properties"), supabase.rpc("platform_list_administrators")]);
  if (error || adminError) throw new Error("No se pudieron cargar las cifras.");
  // Invitaciones de administración pendientes o vencidas (no incluye las de residentes).
  const invitations = ((adminData ?? []) as InvitationRow[]).filter((row) => row.invitation_id);
  const date = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" });
  const rows = (data ?? []) as PropertyRow[];
  const total = (key: CountKey) => rows.reduce((sum, row) => sum + row[key], 0);
  return <PlatformPage title="Usuarios" description="Cuentas activas por conjunto. Solo cifras, sin datos personales de los residentes.">
    <section className="grid gap-4 sm:grid-cols-4">{columns.map(([label, key]) => <Card key={key}><CardContent><p className="text-2xl font-semibold">{total(key)}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p></CardContent></Card>)}</section>
    <Card><CardContent className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b text-xs text-muted-foreground"><th className="py-2 pr-3 font-medium">Conjunto</th>{columns.map(([label]) => <th key={label} className="py-2 pr-3 font-medium">{label}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row.property_id} className="border-b last:border-0"><td className="py-3 pr-3"><p className="font-medium">{row.property_name}</p><p className="text-xs text-muted-foreground">{row.city ?? "Sin ciudad"}{row.property_status !== "active" ? " · Suspendido" : ""}</p></td>{columns.map(([, key]) => <td key={key} className="py-3 pr-3">{row[key]}</td>)}</tr>)}</tbody></table>
      {!rows.length && <p className="py-4 text-sm text-muted-foreground">Todavía no hay conjuntos.</p>}</CardContent></Card>
    <section><h2 className="text-lg font-semibold">Invitaciones de administración</h2><p className="mt-1 text-sm text-muted-foreground">Administradores y auxiliares invitados que todavía no han aceptado. Si el enlace venció, genera uno nuevo.</p>
      <div className="mt-4 grid gap-3">{invitations.map((invitation) => <Card key={invitation.invitation_id}><CardContent>
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="flex flex-wrap items-center gap-2 font-medium break-all">{invitation.email}{invitation.is_assistant && <span className="rounded-full bg-primary/12 px-2 py-0.5 text-xs font-medium text-primary">Auxiliar</span>}</p><p className="text-sm text-muted-foreground">{invitation.property_name} · invitado el {date.format(new Date(invitation.since))}</p></div><span className={`rounded-full px-3 py-1 text-xs font-medium ${invitation.member_status === "expired" ? "bg-amber-100 text-amber-900" : "bg-secondary"}`}>{invitation.member_status === "expired" ? "Invitación vencida" : "Invitación pendiente"}</span></div>
        {invitation.property_status === "active" && invitation.invitation_id && <div className="mt-4 border-t pt-4"><ReissueAdminInvitationForm invitationId={invitation.invitation_id} /></div>}
      </CardContent></Card>)}
      {!invitations.length && <Card><CardContent><p className="text-sm text-muted-foreground">No hay invitaciones de administración pendientes.</p></CardContent></Card>}</div>
    </section>
  </PlatformPage>;
}
