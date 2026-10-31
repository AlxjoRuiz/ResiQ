import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { ReissueAdminInvitationForm } from "@/components/dashboard/create-property-form";
import { Card, CardContent } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { propertyStatusLabel, propertyStatusTone } from "../property-status";
import { loadTestScope } from "../test-scope";

type PropertyRow = { property_id: string; property_name: string; city: string | null; property_status: string; unit_count: number; resident_count: number; concierge_count: number; administrator_count: number };
type UserRow = { property_id: string; property_name: string; property_status: string; user_name: string | null; email: string; user_role: string; unit_label: string | null; user_status: string; since: string; invitation_id: string | null };
type CountKey = "unit_count" | "resident_count" | "concierge_count" | "administrator_count";
export type UsersFilters = { q?: string; rol?: string; estado?: string };
const columns: [string, CountKey][] = [["Apartamentos", "unit_count"], ["Residentes", "resident_count"], ["Portería", "concierge_count"], ["Administradores", "administrator_count"]];
const roleLabels: Record<string, string> = { resident: "Residente", concierge: "Portería", administrator: "Administrador", assistant: "Auxiliar" };
const statusLabels: Record<string, string> = { active: "Activo", suspended: "Suspendido", invited: "Invitación enviada", expired: "Invitación vencida" };
const statusTones: Record<string, string> = { active: "bg-primary/12 text-primary", suspended: "bg-red-100 text-red-800", invited: "bg-secondary", expired: "bg-amber-100 text-amber-900" };
const field = "mt-1 block h-11 rounded-lg border bg-white px-3 text-sm";

export const usersFiltering = (params: UsersFilters) => Boolean((params.q ?? "").trim() || (params.rol && params.rol in roleLabels) || (params.estado && params.estado in statusLabels));

// Usuarios (30/10/2026): una tarjeta por conjunto con sus cifras por estado; al tocarla se abre y muestra
// sus usuarios. El buscador y los filtros de rol y estado aplican dentro de cada tarjeta; con un filtro
// puesto, solo quedan los conjuntos con resultados y se abren solos. Desde el 31/10/2026 la misma vista
// sirve para producción y para Pruebas ResiQ (test); basePath es la página donde se filtra.
// Datos personales visibles solo para el superadmin (Ley 1581: validar con asesor legal).
export async function UsersView({ params, test = false, basePath }: { params: UsersFilters; test?: boolean; basePath: string }) {
  const { supabase } = await requirePlatformAdmin();
  const [scope, { data, error }, { data: userData, error: userError }] = await Promise.all([loadTestScope(supabase), supabase.rpc("platform_list_properties"), supabase.rpc("platform_list_users")]);
  if (error || userError) throw new Error("No se pudieron cargar los usuarios.");
  const properties = ((data ?? []) as PropertyRow[]).filter((row) => scope.isTestProperty(row.property_id) === test);
  const users = (userData ?? []) as UserRow[];
  const total = (key: CountKey) => properties.reduce((sum, row) => sum + row[key], 0);

  const search = (params.q ?? "").trim().toLowerCase().slice(0, 100);
  const role = params.rol && params.rol in roleLabels ? params.rol : "";
  const status = params.estado && params.estado in statusLabels ? params.estado : "";
  const filtering = Boolean(search || role || status);
  const matches = (user: UserRow) => (!role || user.user_role === role) && (!status || user.user_status === status)
    && (!search || `${user.user_name ?? ""} ${user.email} ${user.unit_label ?? ""}`.toLowerCase().includes(search));
  const groups = properties.map((property) => {
    const people = users.filter((user) => user.property_id === property.property_id);
    return { property, people, shown: people.filter(matches) };
  }).filter((group) => !filtering || group.shown.length > 0);
  const date = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" });

  return <>
    <section aria-label="Totales" className="grid gap-4 sm:grid-cols-4">{columns.map(([label, key]) => <Card key={key}><CardContent><p className="text-2xl font-semibold">{total(key)}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p></CardContent></Card>)}</section>
    <form action={basePath} className="flex flex-wrap items-end gap-3">
      <label className="text-sm font-medium">Buscar<input name="q" defaultValue={search} placeholder="Nombre, correo o apartamento" className={`${field} w-64 max-w-full`} /></label>
      <label className="text-sm font-medium">Rol<select name="rol" defaultValue={role} className={field}><option value="">Todos</option>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-sm font-medium">Estado<select name="estado" defaultValue={status} className={field}><option value="">Todos</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button className="h-11 rounded-lg border bg-white px-4 text-sm font-medium hover:bg-secondary">Ver</button>
      {filtering && <Link href={basePath} className="flex h-11 items-center text-sm text-muted-foreground hover:text-foreground">Quitar filtros</Link>}
    </form>
    <section aria-label="Usuarios por conjunto" className="grid gap-3">
      {groups.map(({ property, people, shown }) => {
        const count = (state: string) => people.filter((user) => user.user_status === state).length;
        return <details key={property.property_id} open={filtering} className="group rounded-2xl border bg-white">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-5 marker:hidden">
            <span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><span className="text-lg font-semibold">{property.property_name}</span><span className={`rounded-full px-3 py-1 text-xs font-medium ${propertyStatusTone(property.property_status)}`}>{propertyStatusLabel(property.property_status)}</span></span>
              <span className="mt-1 block text-sm text-muted-foreground">{property.city ?? "Sin ciudad"} · {people.length} {people.length === 1 ? "persona" : "personas"}{filtering ? ` · ${shown.length} con estos filtros` : ""}</span>
              <span className="mt-3 flex flex-wrap gap-2 text-xs"><span className={`rounded-full px-3 py-1 ${statusTones.active}`}>{count("active")} activos</span><span className={`rounded-full px-3 py-1 ${statusTones.invited}`}>{count("invited")} con invitación enviada</span><span className={`rounded-full px-3 py-1 ${statusTones.expired}`}>{count("expired")} con invitación vencida</span>{count("suspended") > 0 && <span className={`rounded-full px-3 py-1 ${statusTones.suspended}`}>{count("suspended")} suspendidos</span>}</span></span>
            <ChevronDown size={20} aria-hidden="true" className="mt-1 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t p-5">
            <ul className="grid gap-2">{shown.map((person, index) => <li key={`${person.email}-${person.invitation_id ?? index}`} className="grid gap-2 rounded-xl border p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-start">
              <div className="min-w-0"><p className="font-medium">{person.user_name ?? "Sin nombre"} <span className="text-xs font-normal text-muted-foreground">· {roleLabels[person.user_role] ?? person.user_role}{person.unit_label ? ` · ${person.unit_label}` : ""}</span></p><p className="break-all text-muted-foreground">{person.email}</p><p className="text-xs text-muted-foreground">{person.invitation_id ? "Invitado el" : "Desde el"} {date.format(new Date(person.since))}</p></div>
              <span className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${statusTones[person.user_status] ?? "bg-secondary"}`}>{statusLabels[person.user_status] ?? person.user_status}</span>
              {person.invitation_id && (person.user_role === "administrator" || person.user_role === "assistant") && property.property_status === "active" && <div className="sm:col-span-2"><ReissueAdminInvitationForm invitationId={person.invitation_id} /></div>}
            </li>)}{!shown.length && <li className="text-sm text-muted-foreground">Este conjunto no tiene usuarios ni invitaciones pendientes.</li>}</ul>
            <Link href={`/plataforma/propiedades/${property.property_id}`} className="mt-4 inline-block text-sm text-primary hover:underline">Ver la ficha del conjunto →</Link>
          </div>
        </details>;
      })}
      {!groups.length && <Card><CardContent><p className="text-sm text-muted-foreground">{filtering ? "No hay personas con estos filtros." : test ? "No hay conjuntos de prueba." : "Todavía no hay conjuntos."}</p></CardContent></Card>}
    </section>
  </>;
}
