import Link from "next/link";
import { ReissueAdminInvitationForm } from "@/components/dashboard/create-property-form";
import { PlatformPage } from "@/components/dashboard/platform-page";
import { Card, CardContent } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";

type PropertyRow = { property_id: string; property_name: string; property_status: string; unit_count: number; resident_count: number; concierge_count: number; administrator_count: number };
type UserRow = { property_id: string; property_name: string; property_status: string; user_name: string | null; email: string; user_role: string; unit_label: string | null; user_status: string; since: string; invitation_id: string | null };
type CountKey = "unit_count" | "resident_count" | "concierge_count" | "administrator_count";
const columns: [string, CountKey][] = [["Apartamentos", "unit_count"], ["Residentes", "resident_count"], ["Portería", "concierge_count"], ["Administradores", "administrator_count"]];
const roleLabels: Record<string, string> = { resident: "Residente", concierge: "Portería", administrator: "Administrador", assistant: "Auxiliar" };
const statusLabels: Record<string, string> = { active: "Activo", suspended: "Suspendido", invited: "Invitación enviada", expired: "Invitación vencida" };
const statusTones: Record<string, string> = { active: "bg-primary/12 text-primary", suspended: "bg-red-100 text-red-800", invited: "bg-secondary", expired: "bg-amber-100 text-amber-900" };
const pageSize = 50;
const field = "mt-1 block h-11 rounded-lg border bg-white px-3 text-sm";

// Usuarios de todos los conjuntos (30/10/2026): buscador por nombre o correo y filtros por conjunto, rol y
// estado, de 50 en 50. Datos personales visibles solo para el superadmin (Ley 1581: validar con asesor legal).
export default async function PlatformUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; conjunto?: string; rol?: string; estado?: string; pagina?: string }> }) {
  const { supabase } = await requirePlatformAdmin();
  const params = await searchParams;
  const [{ data, error }, { data: userData, error: userError }] = await Promise.all([supabase.rpc("platform_list_properties"), supabase.rpc("platform_list_users")]);
  if (error || userError) throw new Error("No se pudieron cargar los usuarios.");
  const properties = (data ?? []) as PropertyRow[];
  const users = (userData ?? []) as UserRow[];
  const total = (key: CountKey) => properties.reduce((sum, row) => sum + row[key], 0);

  const search = (params.q ?? "").trim().toLowerCase().slice(0, 100);
  const propertyId = properties.some((row) => row.property_id === params.conjunto) ? params.conjunto! : "";
  const role = params.rol && params.rol in roleLabels ? params.rol : "";
  const status = params.estado && params.estado in statusLabels ? params.estado : "";
  const filtered = users.filter((user) => (!propertyId || user.property_id === propertyId) && (!role || user.user_role === role) && (!status || user.user_status === status)
    && (!search || `${user.user_name ?? ""} ${user.email} ${user.unit_label ?? ""}`.toLowerCase().includes(search)));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(pages, Math.max(1, Number.parseInt(params.pagina ?? "1", 10) || 1));
  const shown = filtered.slice((page - 1) * pageSize, page * pageSize);
  const href = (target: number) => `/plataforma/usuarios?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(propertyId ? { conjunto: propertyId } : {}), ...(role ? { rol: role } : {}), ...(status ? { estado: status } : {}), pagina: String(target) })}`;
  const date = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" });

  return <PlatformPage title="Usuarios" description="Personas de todos los conjuntos: activas, con invitación enviada o vencida.">
    <section aria-label="Totales" className="grid gap-4 sm:grid-cols-4">{columns.map(([label, key]) => <Card key={key}><CardContent><p className="text-2xl font-semibold">{total(key)}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p></CardContent></Card>)}</section>
    <form className="flex flex-wrap items-end gap-3">
      <label className="text-sm font-medium">Buscar<input name="q" defaultValue={search} placeholder="Nombre, correo o apartamento" className={`${field} w-64 max-w-full`} /></label>
      <label className="text-sm font-medium">Conjunto<select name="conjunto" defaultValue={propertyId} className={field}><option value="">Todos</option>{properties.map((row) => <option key={row.property_id} value={row.property_id}>{row.property_name}</option>)}</select></label>
      <label className="text-sm font-medium">Rol<select name="rol" defaultValue={role} className={field}><option value="">Todos</option>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-sm font-medium">Estado<select name="estado" defaultValue={status} className={field}><option value="">Todos</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button className="h-11 rounded-lg border bg-white px-4 text-sm font-medium hover:bg-secondary">Ver</button>
    </form>
    <section aria-label="Lista de usuarios" className="grid gap-2">
      <p className="text-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? "persona" : "personas"}{pages > 1 ? ` · página ${page} de ${pages}` : ""}</p>
      {shown.map((person, index) => <div key={`${person.property_id}-${person.email}-${person.invitation_id ?? index}`} className="grid gap-2 rounded-xl border bg-white p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="min-w-0"><p className="font-medium">{person.user_name ?? "Sin nombre"} <span className="text-xs font-normal text-muted-foreground">· {roleLabels[person.user_role] ?? person.user_role}{person.unit_label ? ` · ${person.unit_label}` : ""}</span></p><p className="break-all text-muted-foreground">{person.email}</p><p className="text-xs text-muted-foreground"><Link href={`/plataforma/propiedades/${person.property_id}`} className="underline-offset-2 hover:underline">{person.property_name}</Link> · {person.invitation_id ? "Invitado el" : "Desde el"} {date.format(new Date(person.since))}</p></div>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${statusTones[person.user_status] ?? "bg-secondary"}`}>{statusLabels[person.user_status] ?? person.user_status}</span>
        {person.invitation_id && (person.user_role === "administrator" || person.user_role === "assistant") && person.property_status === "active" && <div className="sm:col-span-2"><ReissueAdminInvitationForm invitationId={person.invitation_id} /></div>}
      </div>)}
      {!shown.length && <Card><CardContent><p className="text-sm text-muted-foreground">No hay personas con estos filtros.</p></CardContent></Card>}
      {pages > 1 && <nav aria-label="Páginas" className="mt-2 flex items-center justify-between gap-3 text-sm">{page > 1 ? <Link href={href(page - 1)} className="rounded-lg border bg-white px-3 py-2 hover:bg-secondary">← Anterior</Link> : <span />}{page < pages && <Link href={href(page + 1)} className="rounded-lg border bg-white px-3 py-2 hover:bg-secondary">Siguiente →</Link>}</nav>}
    </section>
  </PlatformPage>;
}
