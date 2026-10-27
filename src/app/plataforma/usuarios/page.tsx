import { ReissueAdminInvitationForm } from "@/components/dashboard/create-property-form";
import { PlatformPage } from "@/components/dashboard/platform-page";
import { Card, CardContent } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";

type PropertyRow = { property_id: string; property_name: string; city: string | null; property_status: string; unit_count: number; resident_count: number; concierge_count: number; administrator_count: number };
type UserRow = { property_id: string; property_name: string; property_status: string; user_name: string | null; email: string; user_role: string; unit_label: string | null; user_status: string; since: string; invitation_id: string | null };
type CountKey = "unit_count" | "resident_count" | "concierge_count" | "administrator_count";
const columns: [string, CountKey][] = [["Apartamentos", "unit_count"], ["Residentes", "resident_count"], ["Portería", "concierge_count"], ["Administradores", "administrator_count"]];
const roleLabels: Record<string, string> = { resident: "Residente", concierge: "Portería", administrator: "Administrador", assistant: "Auxiliar" };
const statusLabels: Record<string, string> = { active: "Activo", suspended: "Suspendido", invited: "Invitación enviada", expired: "Invitación vencida" };
const statusTones: Record<string, string> = { active: "bg-primary/12 text-primary", suspended: "bg-red-100 text-red-800", invited: "bg-secondary", expired: "bg-amber-100 text-amber-900" };

// Cifras por conjunto y, al abrir cada conjunto, sus usuarios con nombre, correo, rol y estado.
// Datos personales visibles solo para el superadmin (Ley 1581: validar con asesor legal).
export default async function PlatformUsersPage() {
  const { supabase } = await requirePlatformAdmin();
  const [{ data, error }, { data: userData, error: userError }] = await Promise.all([supabase.rpc("platform_list_properties"), supabase.rpc("platform_list_users")]);
  if (error || userError) throw new Error("No se pudieron cargar los usuarios.");
  const rows = (data ?? []) as PropertyRow[];
  const users = (userData ?? []) as UserRow[];
  const total = (key: CountKey) => rows.reduce((sum, row) => sum + row[key], 0);
  const date = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" });
  return <PlatformPage title="Usuarios" description="Usuarios de cada conjunto: activos, con invitación enviada y con invitación vencida.">
    <section className="grid gap-4 sm:grid-cols-4">{columns.map(([label, key]) => <Card key={key}><CardContent><p className="text-2xl font-semibold">{total(key)}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p></CardContent></Card>)}</section>
    <Card><CardContent className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b text-xs text-muted-foreground"><th className="py-2 pr-3 font-medium">Conjunto</th>{columns.map(([label]) => <th key={label} className="py-2 pr-3 font-medium">{label}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row.property_id} className="border-b last:border-0"><td className="py-3 pr-3"><p className="font-medium">{row.property_name}</p><p className="text-xs text-muted-foreground">{row.city ?? "Sin ciudad"}{row.property_status !== "active" ? " · Suspendido" : ""}</p></td>{columns.map(([, key]) => <td key={key} className="py-3 pr-3">{row[key]}</td>)}</tr>)}</tbody></table>
      {!rows.length && <p className="py-4 text-sm text-muted-foreground">Todavía no hay conjuntos.</p>}</CardContent></Card>
    <section className="grid gap-4"><h2 className="text-lg font-semibold">Usuarios por conjunto</h2>
      {rows.map((property) => {
        const people = users.filter((user) => user.property_id === property.property_id);
        const count = (status: string) => people.filter((user) => user.user_status === status).length;
        return <Card key={property.property_id}><CardContent><details>
          <summary className="cursor-pointer"><span className="font-semibold">{property.property_name}</span><span className="mt-2 flex flex-wrap gap-2 text-xs"><span className={`rounded-full px-3 py-1 ${statusTones.active}`}>{count("active")} activos</span><span className={`rounded-full px-3 py-1 ${statusTones.invited}`}>{count("invited")} con invitación enviada</span><span className={`rounded-full px-3 py-1 ${statusTones.expired}`}>{count("expired")} con invitación vencida</span>{count("suspended") > 0 && <span className={`rounded-full px-3 py-1 ${statusTones.suspended}`}>{count("suspended")} suspendidos</span>}</span></summary>
          <ul className="mt-4 grid gap-2">{people.map((person, index) => <li key={`${person.email}-${person.invitation_id ?? index}`} className="grid gap-2 rounded-xl border p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-start">
            <div className="min-w-0"><p className="font-medium">{person.user_name ?? "Sin nombre"} <span className="text-xs font-normal text-muted-foreground">· {roleLabels[person.user_role] ?? person.user_role}{person.unit_label ? ` · ${person.unit_label}` : ""}</span></p><p className="break-all text-muted-foreground">{person.email}</p><p className="text-xs text-muted-foreground">{person.invitation_id ? "Invitado el" : "Desde el"} {date.format(new Date(person.since))}</p></div>
            <span className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${statusTones[person.user_status] ?? "bg-secondary"}`}>{statusLabels[person.user_status] ?? person.user_status}</span>
            {person.invitation_id && (person.user_role === "administrator" || person.user_role === "assistant") && property.property_status === "active" && <div className="sm:col-span-2"><ReissueAdminInvitationForm invitationId={person.invitation_id} /></div>}
          </li>)}{!people.length && <li className="text-sm text-muted-foreground">Este conjunto no tiene usuarios ni invitaciones pendientes.</li>}</ul>
        </details></CardContent></Card>;
      })}
    </section>
  </PlatformPage>;
}
