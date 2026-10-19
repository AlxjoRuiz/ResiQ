import { Card, CardContent } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ApartmentRelationshipForm, BuildingForm, EndMembershipForm, MemberForm, UnitForm } from "./management-forms";

type Unit = { id: string; building_id: string; code: string; floor: string | null; status: string };
type Building = { id: string; name: string; code: string; active: boolean; units: Unit[] | null };
type UnitRelation = { id: string; code: string };
type UnitLink = { id: string; relationship: string; valid_to: string | null; units: UnitRelation | UnitRelation[] | null };
type Member = { id: string; user_id: string; roles: string[]; status: string; profiles: { display_name: string } | { display_name: string }[] | null; unit_memberships: UnitLink[] | null; email?: string | null };
type Occupant = { member: Member; link: UnitLink };

function one<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
function statusLabel(status: string) { return status === "active" ? "Activo" : "Inactivo"; }

function OccupantCard({ occupant, propertyId }: { occupant: Occupant; propertyId: string }) {
  const { member, link } = occupant;
  return <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="font-semibold">{one(member.profiles)?.display_name ?? "Miembro"}</p><p className="break-all text-sm text-muted-foreground">{member.email ?? "Correo no disponible"}</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{link.relationship === "owner" ? "Propietario" : "Arrendatario"}</span></div>
    <p className="mt-2 text-sm">Acceso a la propiedad: <strong>{statusLabel(member.status)}</strong></p>
    <details className="mt-3 border-t pt-3"><summary className="cursor-pointer text-sm font-medium">Administrar acceso y relación</summary><MemberForm propertyId={propertyId} member={member} residentMode /><ApartmentRelationshipForm propertyId={propertyId} unitMembershipId={link.id} relationship={link.relationship} /><div className="mt-3 border-t pt-3"><EndMembershipForm propertyId={propertyId} unitMembershipId={link.id} /></div></details>
  </div>;
}

function ConciergeCard({ member, propertyId }: { member: Member; propertyId: string }) {
  return <Card><CardContent><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-lg font-semibold">{one(member.profiles)?.display_name ?? "Miembro"}</h4><p className="break-all text-sm text-muted-foreground">{member.email ?? "Correo no disponible"}</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{statusLabel(member.status)}</span></div><details className="mt-4 border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Administrar acceso</summary><MemberForm propertyId={propertyId} member={member} /></details></CardContent></Card>;
}

export async function PropertyManagementSections({ propertyId }: { propertyId: string }) {
  const supabase = await createClient();
  const [{ data: buildingData, error: buildingError }, { data: memberData, error: memberError }] = await Promise.all([
    supabase.from("buildings").select("id,name,code,active,units(id,building_id,code,floor,status)").eq("property_id", propertyId).order("name"),
    supabase.from("property_members").select("id,user_id,roles,status,profiles!property_members_user_id_fkey(display_name),unit_memberships(id,relationship,valid_to,units(id,code))").eq("property_id", propertyId).order("joined_at"),
  ]);
  if (buildingError || memberError) throw new Error("No se pudieron cargar las torres y sus accesos.");
  const buildings = (buildingData ?? []) as Building[];
  const members = (memberData ?? []) as Member[];
  const admin = createAdminClient();
  const memberEmails = await Promise.all(members.map(async (member) => {
    const { data, error } = await admin.auth.admin.getUserById(member.user_id);
    return [member.id, error ? null : data.user?.email ?? null] as const;
  }));
  const emailByMember = new Map(memberEmails);
  for (const member of members) member.email = emailByMember.get(member.id);

  const occupantsByUnit = new Map<string, Occupant[]>();
  for (const member of members) {
    if (!member.roles.includes("member") || member.roles.includes("administrator") || member.roles.includes("concierge")) continue;
    for (const link of member.unit_memberships ?? []) {
      const unit = one(link.units);
      if (!link.valid_to && unit) occupantsByUnit.set(unit.id, [...(occupantsByUnit.get(unit.id) ?? []), { member, link }]);
    }
  }
  const conciergeMembers = members.filter((member) => member.roles.includes("concierge") && !member.roles.includes("administrator"));
  const buildingOptions = buildings.map(({ id, name, active }) => ({ id, name, active }));

  return <>
    <section id="apartamentos" className="mt-10 scroll-mt-6"><h2 className="text-2xl font-semibold">Torres y apartamentos</h2><p className="mt-1 text-sm text-muted-foreground">Consulta quién está vinculado a cada apartamento, su correo, relación y acceso. Aquí también puedes administrar la estructura.</p>
      <div className="mt-4 grid gap-5"><Card><CardContent><h3 className="mb-5 text-lg font-semibold">Crear torre o bloque</h3><BuildingForm propertyId={propertyId} /></CardContent></Card><Card><CardContent><h3 className="mb-5 text-lg font-semibold">Crear apartamento</h3><UnitForm propertyId={propertyId} buildings={buildingOptions} /></CardContent></Card>
      {buildings.map((building) => <Card key={building.id}><CardContent><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold tracking-wider text-primary uppercase">{building.code}</p><h3 className="mt-1 text-xl font-semibold">{building.name}</h3></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{building.active ? "Activa" : "Inactiva"}</span></div><details className="mt-5"><summary className="cursor-pointer text-sm font-medium">Ver apartamentos y accesos ({building.units?.length ?? 0})</summary><div className="mt-4"><BuildingForm propertyId={propertyId} building={building} /></div><details className="mt-4 border-t pt-4"><summary className="cursor-pointer text-sm">Editar estructura de apartamentos</summary><div className="mt-3 grid gap-3">{(building.units ?? []).map((unit) => <div key={unit.id} className="rounded-xl border p-3"><UnitForm propertyId={propertyId} buildings={buildingOptions} unit={unit} /></div>)}</div></details><div className="mt-6 space-y-3 border-t pt-5">{(building.units ?? []).sort((a, b) => a.code.localeCompare(b.code, "es", { numeric: true })).map((unit) => <div key={unit.id} className="min-w-0 rounded-xl border p-3 sm:p-4"><details><summary className="cursor-pointer font-semibold">Apartamento {unit.code} <span className="ml-1 text-sm font-normal text-muted-foreground">· {occupantsByUnit.get(unit.id)?.length ? `${occupantsByUnit.get(unit.id)?.length} vinculados` : "Disponible / Sin residente asignado"}</span></summary><div className="mt-4 space-y-3"><p className="text-sm"><strong>Número:</strong> {unit.code} <span className="mx-2">·</span> <strong>Piso:</strong> {unit.floor || "Sin registrar"}</p><div className="grid gap-3">{(occupantsByUnit.get(unit.id) ?? []).map((occupant) => <OccupantCard key={occupant.link.id} occupant={occupant} propertyId={propertyId} />)}{!occupantsByUnit.get(unit.id)?.length && <p className="rounded-lg bg-secondary p-3 text-sm">Disponible / Sin residente asignado</p>}</div></div></details></div>)}{!building.units?.length && <p className="text-sm text-muted-foreground">Esta torre todavía no tiene apartamentos.</p>}</div></details></CardContent></Card>)}
      </div></section>
    <section id="porteria" className="mt-10 scroll-mt-6"><h2 className="text-2xl font-semibold">Personal de portería</h2><p className="mt-1 text-sm text-muted-foreground">Suspende el acceso temporalmente o selecciona «Revocado — quitar acceso» cuando un portero deje de trabajar. Se conserva el historial.</p><div className="mt-4 grid gap-4">{conciergeMembers.map((member) => <ConciergeCard key={member.id} member={member} propertyId={propertyId} />)}{!conciergeMembers.length && <Card><CardContent><p className="text-sm text-muted-foreground">No hay personal de portería registrado.</p></CardContent></Card>}</div></section>
  </>;
}
