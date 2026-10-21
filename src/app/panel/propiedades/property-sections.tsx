import { Card, CardContent } from "@/components/ui/card";
import { CensusDetail } from "@/components/census/census-detail";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { BuildingForm, EndMembershipForm, MemberForm } from "./management-forms";
import { PropertyUnitExplorer } from "./property-unit-explorer";

type Unit = { id: string; building_id: string; code: string; floor: string | null; status: string };
type Building = { id: string; name: string; code: string; active: boolean; units: Unit[] | null };
type UnitRelation = { id: string; code: string };
type UnitLink = { id: string; relationship: string; valid_to: string | null; units: UnitRelation | UnitRelation[] | null };
type Member = { id: string; user_id: string; roles: string[]; status: string; profiles: { display_name: string } | { display_name: string }[] | null; unit_memberships: UnitLink[] | null; email?: string | null };
type Occupant = { member: Member; link: UnitLink };
type CensusRecord = { id: string; unit_id: string; import_id: string; full_name: string | null; email_normalized: string | null; cells: unknown };
type CensusImport = { id: string; headers: unknown };

function one<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
function statusLabel(status: string) { return status === "active" ? "Activo" : "Inactivo"; }

function OccupantCard({ occupant, propertyId }: { occupant: Occupant; propertyId: string }) {
  const { member, link } = occupant;
  return <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="font-semibold">{one(member.profiles)?.display_name ?? "Miembro"}</p><p className="break-all text-sm text-muted-foreground">{member.email ?? "Correo no disponible"}</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{link.relationship === "owner" ? "Propietario" : "Arrendatario"}</span></div>
    <p className="mt-2 text-sm">Estado: <strong>{statusLabel(member.status)}</strong></p>
    <div className="mt-3 border-t pt-3"><p className="mb-3 text-xs text-muted-foreground">Desvincular libera este apartamento. Si era el último vínculo del residente, también se retira su acceso; para volver a asignarlo se envía una invitación.</p><EndMembershipForm propertyId={propertyId} unitMembershipId={link.id} /></div>
  </div>;
}

function ConciergeCard({ member, propertyId }: { member: Member; propertyId: string }) {
  return <Card><CardContent><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-lg font-semibold">{one(member.profiles)?.display_name ?? "Miembro"}</h4><p className="break-all text-sm text-muted-foreground">{member.email ?? "Correo no disponible"}</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{statusLabel(member.status)}</span></div><details className="mt-4 border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Administrar acceso</summary><MemberForm propertyId={propertyId} member={member} /></details></CardContent></Card>;
}

export async function PropertyManagementSections({ propertyId }: { propertyId: string }) {
  const supabase = await createClient();
  const [{ data: buildingData, error: buildingError }, { data: memberData, error: memberError }, { data: censusData, error: censusError }, { data: importData, error: importError }] = await Promise.all([
    supabase.from("buildings").select("id,name,code,active,units(id,building_id,code,floor,status)").eq("property_id", propertyId).order("name"),
    supabase.from("property_members").select("id,user_id,roles,status,profiles!property_members_user_id_fkey(display_name),unit_memberships(id,relationship,valid_to,units(id,code))").eq("property_id", propertyId).order("joined_at"),
    supabase.from("census_records").select("id,unit_id,import_id,full_name,email_normalized,cells").eq("property_id", propertyId).limit(500),
    supabase.from("census_imports").select("id,headers").eq("property_id", propertyId),
  ]);
  if (buildingError || memberError || censusError || importError) throw new Error("No se pudieron cargar las torres y sus accesos.");
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
  const headersByImport = new Map((importData as CensusImport[] ?? []).map((item) => [item.id, Array.isArray(item.headers) ? item.headers.map(String) : []]));
  const censusByUnit = new Map<string, CensusRecord[]>();
  for (const record of (censusData as CensusRecord[] ?? [])) censusByUnit.set(record.unit_id, [...(censusByUnit.get(record.unit_id) ?? []), record]);
  const explorerTowers = buildings.sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true })).map((building) => ({
    id: building.id, name: building.name, code: building.code, active: building.active,
    edit: <BuildingForm propertyId={propertyId} building={building} />,
    units: (building.units ?? []).sort((a, b) => {
      const floorOrder = a.floor && b.floor ? a.floor.localeCompare(b.floor, "es", { numeric: true }) : a.floor ? -1 : b.floor ? 1 : 0;
      return floorOrder || a.code.localeCompare(b.code, "es", { numeric: true });
    }).map((unit) => ({ id: unit.id, code: unit.code, floor: unit.floor,
      content: <>
        <p className="text-sm"><strong>Número:</strong> {unit.code} <span className="mx-2">·</span> <strong>Piso:</strong> {unit.floor || "Sin información"}</p>
        <div className="space-y-4"><h4 className="font-semibold">Información del Excel</h4>{(censusByUnit.get(unit.id) ?? []).map((record, index) => {
          const headers = headersByImport.get(record.import_id) ?? [];
          const cells = Array.isArray(record.cells) ? record.cells.map((value) => value === null ? null : String(value)) : [];
          return <div key={record.id} className="min-w-0 rounded-lg border p-3 sm:p-4"><p className="mb-4 font-medium">{record.full_name || record.email_normalized || `Residente ${index + 1}`}</p>{headers.length ? <CensusDetail headers={headers} cells={cells} /> : <p className="text-sm text-muted-foreground">No se pudieron mostrar los encabezados de esta respuesta.</p>}</div>;
        })}{!censusByUnit.get(unit.id)?.length && <p className="text-sm text-muted-foreground">Este apartamento no tiene respuestas importadas.</p>}</div>
        <div className="space-y-3 border-t pt-4"><h4 className="font-semibold">Vinculaciones y acceso a ResiQ</h4>{(occupantsByUnit.get(unit.id) ?? []).map((occupant) => <OccupantCard key={occupant.link.id} occupant={occupant} propertyId={propertyId} />)}{!occupantsByUnit.get(unit.id)?.length && <p className="text-sm text-muted-foreground">Sin residente vinculado. Un correo del Excel no concede acceso.</p>}</div>
      </>,
    })),
  }));

  return <>
    <section id="apartamentos" className="mt-10 scroll-mt-6"><h2 className="text-2xl font-semibold">Torres de la propiedad</h2><p className="mt-1 text-sm text-muted-foreground">Abre una torre y después un apartamento para consultar cada respuesta importada y sus vinculaciones, sin mezclar personas.</p>
      <div className="mt-4"><PropertyUnitExplorer towers={explorerTowers} /></div>
    </section>
    <section id="porteria" className="mt-10 scroll-mt-6"><h2 className="text-2xl font-semibold">Personal de portería</h2><p className="mt-1 text-sm text-muted-foreground">Suspende el acceso temporalmente o selecciona «Revocado — quitar acceso» cuando un portero deje de trabajar. Se conserva el historial.</p><div className="mt-4 grid gap-4">{conciergeMembers.map((member) => <ConciergeCard key={member.id} member={member} propertyId={propertyId} />)}{!conciergeMembers.length && <Card><CardContent><p className="text-sm text-muted-foreground">No hay personal de portería registrado.</p></CardContent></Card>}</div></section>
  </>;
}
