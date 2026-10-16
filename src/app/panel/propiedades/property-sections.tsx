import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { BuildingForm, EndMembershipForm, MemberForm, UnitForm, UnitMembershipForm } from "./management-forms";

type Unit = { id: string; building_id: string; code: string; floor: string | null; status: string };
type Building = { id: string; name: string; code: string; active: boolean; units: Unit[] | null };
type UnitRelation = { id: string; code: string; buildings: { id: string; name: string } | { id: string; name: string }[] | null };
type UnitLink = { id: string; relationship: string; valid_to: string | null; units: UnitRelation | UnitRelation[] | null };
type Member = { id: string; roles: string[]; status: string; profiles: { display_name: string } | { display_name: string }[] | null; unit_memberships: UnitLink[] | null };
function one<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
function statusLabel(status: string) { return status === "active" ? "Activo" : status === "suspended" ? "Suspendido" : "Revocado"; }

function MemberCard({ member, propertyId, units }: { member: Member; propertyId: string; units: { id: string; label: string }[] }) {
  const profile = one(member.profiles), isAdministrator = member.roles.includes("administrator");
  const activeLinks = (member.unit_memberships ?? []).filter((link) => !link.valid_to);
  return <Card><CardContent><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-lg font-semibold">{profile?.display_name ?? "Miembro"}</h4><p className="mt-1 text-sm text-muted-foreground">{isAdministrator ? "Administración" : member.roles.includes("concierge") ? "Portería" : "Residente"}</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{statusLabel(member.status)}</span></div>
    <p className="mt-3 text-sm text-muted-foreground">{activeLinks.length ? activeLinks.map((link) => { const unit = one(link.units); return `${one(unit?.buildings ?? null)?.name ?? "Torre"} · ${unit?.code ?? "Apartamento"}`; }).join(", ") : "Sin apartamentos vinculados actualmente"}</p>
    {isAdministrator ? <p className="mt-4 rounded-lg border p-3 text-sm text-muted-foreground">La administración no puede modificar ni revocar a otros administradores desde aquí.</p> : <details className="mt-4 border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Administrar acceso y apartamentos</summary><div className="mt-4"><MemberForm propertyId={propertyId} member={member} />{member.roles.includes("member") && member.status === "active" && <UnitMembershipForm propertyId={propertyId} memberId={member.id} units={units} />}{activeLinks.length > 0 && <div className="mt-5 space-y-2 border-t pt-4"><p className="text-sm font-medium">Vínculos vigentes</p>{activeLinks.map((link) => { const unit = one(link.units); return <div key={link.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-sm"><span>{one(unit?.buildings ?? null)?.name ?? "Torre"} · {unit?.code ?? "Apartamento"} · {link.relationship === "owner" ? "Propietario" : "Residente"}</span><EndMembershipForm propertyId={propertyId} unitMembershipId={link.id} /></div>; })}</div>}</div></details>}
  </CardContent></Card>;
}

export async function PropertyStructureSection({ propertyId }: { propertyId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("buildings").select("id,name,code,active,units(id,building_id,code,floor,status)").eq("property_id", propertyId).order("name");
  if (error) throw new Error("No se pudieron cargar las torres y apartamentos.");
  const buildings = (data ?? []) as Building[];
  const buildingOptions = buildings.map(({ id, name, active }) => ({ id, name, active }));
  return <section id="apartamentos" className="mt-10 scroll-mt-6"><h2 className="text-2xl font-semibold">Torres y apartamentos</h2><p className="mt-1 text-sm text-muted-foreground">Crea o actualiza la estructura. Los registros se desactivan para conservar su historial.</p>
    <div className="mt-4 grid gap-5"><Card><CardContent><h3 className="mb-5 text-lg font-semibold">Crear torre o bloque</h3><BuildingForm propertyId={propertyId} /></CardContent></Card><Card><CardContent><h3 className="mb-5 text-lg font-semibold">Crear apartamento</h3><UnitForm propertyId={propertyId} buildings={buildingOptions} /></CardContent></Card>
    {buildings.map((building) => <Card key={building.id}><CardContent><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold tracking-wider text-primary uppercase">{building.code}</p><h3 className="mt-1 text-xl font-semibold">{building.name}</h3></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{building.active ? "Activa" : "Inactiva"}</span></div><details className="mt-5"><summary className="cursor-pointer text-sm font-medium">Editar torre y apartamentos ({building.units?.length ?? 0})</summary><div className="mt-4"><BuildingForm propertyId={propertyId} building={building} /></div><div className="mt-6 space-y-3 border-t pt-5">{(building.units ?? []).sort((a, b) => a.code.localeCompare(b.code, "es", { numeric: true })).map((unit) => <div key={unit.id} className="rounded-xl border p-4"><UnitForm propertyId={propertyId} buildings={buildingOptions} unit={unit} /></div>)}{!building.units?.length && <p className="text-sm text-muted-foreground">Esta torre todavía no tiene apartamentos.</p>}</div></details></CardContent></Card>)}
    </div></section>;
}

export async function PropertyMembersSection({ propertyId }: { propertyId: string }) {
  const supabase = await createClient();
  const [{ data: memberData, error: memberError }, { data: unitData, error: unitError }, { data: buildingData, error: buildingError }] = await Promise.all([
    supabase.from("property_members").select("id,roles,status,profiles!property_members_user_id_fkey(display_name),unit_memberships(id,relationship,valid_to,units(id,code,buildings(id,name)))").eq("property_id", propertyId).order("joined_at"),
    supabase.from("units").select("id,code,buildings(name)").eq("property_id", propertyId).eq("status", "active").order("code"),
    supabase.from("buildings").select("id,name").eq("property_id", propertyId).order("name"),
  ]);
  if (memberError || unitError || buildingError) throw new Error("No se pudieron cargar los residentes y sus accesos.");
  const members = (memberData ?? []) as Member[];
  const conciergeMembers = members.filter((member) => member.roles.includes("concierge") && !member.roles.includes("administrator"));
  const units = (unitData ?? []).map((unit) => ({ id: unit.id, label: `${one(unit.buildings as { name: string } | { name: string }[] | null)?.name ?? "Torre"} · ${unit.code}` }));
  const buildings = buildingData ?? [];
  const byBuilding = new Map(buildings.map((building) => [building.id, [] as Member[]]));
  const withoutBuilding: Member[] = [];
  for (const member of members) {
    if (!member.roles.includes("member") || member.roles.includes("administrator") || member.roles.includes("concierge")) continue;
    const linkedBuildings = (member.unit_memberships ?? []).filter((link) => !link.valid_to).map((link) => one(one(link.units)?.buildings ?? null)?.id).filter((id): id is string => !!id);
    const firstBuilding = buildings.find((building) => linkedBuildings.includes(building.id));
    if (firstBuilding) byBuilding.get(firstBuilding.id)?.push(member);
    else if (!member.roles.includes("concierge")) withoutBuilding.push(member);
  }
  return <><section id="residentes" className="mt-10 scroll-mt-6"><h2 className="text-2xl font-semibold">Residentes y accesos</h2><p className="mt-1 text-sm text-muted-foreground">Suspender bloquea temporalmente el acceso. Revocar retira el acceso a esta propiedad y finaliza los vínculos vigentes sin borrar el historial. Los administradores están protegidos.</p><p className="mt-2 text-xs text-muted-foreground">Quien pertenece a varias torres aparece una vez bajo la primera; su tarjeta muestra todos los apartamentos vinculados.</p>
    <div className="mt-4 grid gap-4">{buildings.map((building) => { const group = byBuilding.get(building.id) ?? []; return <Card key={building.id}><CardContent><details><summary className="cursor-pointer text-lg font-semibold">{building.name} <span className="ml-2 text-sm font-normal text-muted-foreground">({group.length})</span></summary><div className="mt-5 grid gap-3">{group.map((member) => <MemberCard key={member.id} member={member} propertyId={propertyId} units={units} />)}{!group.length && <p className="text-sm text-muted-foreground">No hay residentes vinculados a esta torre.</p>}</div></details></CardContent></Card>; })}{withoutBuilding.length > 0 && <Card><CardContent><details><summary className="cursor-pointer text-lg font-semibold">Residentes pendientes de apartamento <span className="ml-2 text-sm font-normal text-muted-foreground">({withoutBuilding.length})</span></summary><div className="mt-5 grid gap-3">{withoutBuilding.map((member) => <MemberCard key={member.id} member={member} propertyId={propertyId} units={units} />)}</div></details></CardContent></Card>}{!members.length && !buildings.length && <Card><CardContent><p className="text-sm text-muted-foreground">No hay residentes ni torres registrados.</p></CardContent></Card>}</div></section>
    <section id="porteria" className="mt-10 scroll-mt-6"><h2 className="text-2xl font-semibold">Personal de portería</h2><p className="mt-1 text-sm text-muted-foreground">Suspende el acceso temporalmente o selecciona «Revocado — quitar acceso» cuando un portero deje de trabajar. El cambio afecta solo a esta propiedad y conserva los registros históricos.</p><div className="mt-4 grid gap-4">{conciergeMembers.map((member) => <MemberCard key={member.id} member={member} propertyId={propertyId} units={units} />)}{!conciergeMembers.length && <Card><CardContent><p className="text-sm text-muted-foreground">No hay personal de portería registrado.</p></CardContent></Card>}</div></section></>;
}
