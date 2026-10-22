import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { CensusDetail } from "@/components/census/census-detail";
import { CensusImportForm } from "@/components/census/census-import-form";
import { CENSUS_MAX_ROWS } from "@/lib/census/parse";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { BuildingForm, EndMembershipForm, MemberForm, RevealInvitationLinkForm, UnitResidentInvitationForm } from "./management-forms";
import { PropertyUnitExplorer } from "./property-unit-explorer";
import { ConciergeRegistrationForm } from "./concierge-registration-form";
import { ConciergeManagementForms } from "./concierge-management-forms";
import { maskDocument } from "@/lib/concierge/identity";
import { COLOMBIA_TIME_ZONE, dateInputValue } from "@/lib/time-zone";

type Unit = { id: string; building_id: string; code: string; floor: string | null; status: string };
type Building = { id: string; name: string; code: string; active: boolean; units: Unit[] | null };
type UnitRelation = { id: string; code: string };
type UnitLink = { id: string; relationship: string; valid_to: string | null; units: UnitRelation | UnitRelation[] | null };
type Member = { id: string; user_id: string; roles: string[]; status: string; profiles: { display_name: string } | { display_name: string }[] | null; unit_memberships: UnitLink[] | null; email?: string | null };
type Occupant = { member: Member; link: UnitLink };
type CensusRecord = { id: string; unit_id: string; import_id: string; full_name: string | null; email_normalized: string | null; user_type: string | null; invitation_primary: boolean; invitation_relationship: string | null; cells: unknown };
type CensusImport = { id: string; headers: unknown };
type UnitInvitation = { unit_id: string; invitation_id: string; email: string; relationship: string; invitation_status: string; delivery_status: string | null; expires_at: string; link_issued_at: string | null };
type ConciergeAccount = { id: string; member_id: string; username: string; full_name: string; document_number: string; birth_date: string; phone_e164: string; email_normalized: string; address: string | null; photo_path: string | null; vehicles: unknown; status: string; photoUrl?: string | null };
function ageFor(birthDate: string) { const today = dateInputValue(new Date(), COLOMBIA_TIME_ZONE); return Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4)) - (today.slice(5) < birthDate.slice(5) ? 1 : 0); }

function one<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
// Tipo mostrado junto al apartamento, tomado de «Tipo de usuario» del censo.
function censusKind(userType: string | null | undefined) {
  const value = (userType ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  if (["propietario", "propietaria"].includes(value)) return "Propietario";
  if (["residente", "arrendatario", "arrendataria"].includes(value)) return "Residente";
  return null;
}
function invitationLabel(invitation: UnitInvitation) {
  if (invitation.invitation_status === "accepted") return "Invitación aceptada";
  if (invitation.invitation_status === "revoked") return "Invitación cancelada";
  if (invitation.invitation_status === "expired") return "Enlace vencido: genera uno nuevo";
  if (invitation.delivery_status === "held") return "Invitación retenida · modo de prueba, no se envió correo";
  if (invitation.delivery_status === "queued" || invitation.delivery_status === "processing") return "Invitación en cola de envío";
  if (invitation.delivery_status === "accepted") return "Correo de invitación enviado";
  if (invitation.delivery_status === "failed") return "No se pudo enviar el correo";
  return "Invitación pendiente";
}

function InvitationStatus({ invitation, propertyId }: { invitation: UnitInvitation; propertyId: string }) {
  const open = invitation.invitation_status === "pending" || invitation.invitation_status === "expired";
  return <div className="min-w-0 space-y-2 rounded-lg border p-3 text-sm">
    <p className="font-medium">{invitationLabel(invitation)}</p>
    <p className="break-all text-muted-foreground">{invitation.email} · {invitation.relationship === "owner" ? "Propietario" : "Residente"}</p>
    {open && <RevealInvitationLinkForm propertyId={propertyId} invitationId={invitation.invitation_id} />}
  </div>;
}

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
  return <Card><CardContent><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-lg font-semibold">{one(member.profiles)?.display_name ?? "Miembro"}</h4><p className="break-all text-sm text-muted-foreground">{member.email ?? "Correo no disponible"}</p><p className="mt-1 text-xs text-muted-foreground">Cuenta anterior creada por invitación; no tiene usuario permanente.</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{statusLabel(member.status)}</span></div><details className="mt-4 border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Administrar acceso</summary><MemberForm propertyId={propertyId} member={member} /></details></CardContent></Card>;
}

export async function PropertyManagementSections({ propertyId, canImport, imported }: { propertyId: string; canImport: boolean; imported: boolean }) {
  const supabase = await createClient();
  const [{ data: buildingData, error: buildingError }, { data: memberData, error: memberError }, { data: censusData, error: censusError }, { data: importData, error: importError }, { data: conciergeData, error: conciergeError }] = await Promise.all([
    supabase.from("buildings").select("id,name,code,active,units(id,building_id,code,floor,status)").eq("property_id", propertyId).order("name"),
    supabase.from("property_members").select("id,user_id,roles,status,profiles!property_members_user_id_fkey(display_name),unit_memberships(id,relationship,valid_to,units(id,code))").eq("property_id", propertyId).order("joined_at"),
    supabase.from("census_records").select("id,unit_id,import_id,full_name,email_normalized,user_type,invitation_primary,invitation_relationship,cells").eq("property_id", propertyId).limit(CENSUS_MAX_ROWS),
    supabase.from("census_imports").select("id,headers").eq("property_id", propertyId),
    supabase.from("concierge_accounts").select("id,member_id,username,full_name,document_number,birth_date,phone_e164,email_normalized,address,photo_path,vehicles,status").eq("property_id", propertyId).neq("status", "removed").order("created_at", { ascending: false }),
  ]);
  if (buildingError || memberError || censusError || importError || conciergeError) throw new Error("No se pudieron cargar las torres y sus accesos.");
  const { data: invitationData, error: invitationError } = await supabase.rpc("get_unit_invitations", { target_property_id: propertyId });
  if (invitationError) throw new Error("No se pudieron cargar las invitaciones.");
  const invitationByUnit = new Map(((invitationData ?? []) as UnitInvitation[]).map((invitation) => [invitation.unit_id, invitation]));
  const buildings = (buildingData ?? []) as Building[];
  const members = (memberData ?? []) as Member[];
  const memberStatusById = new Map(members.map((member) => [member.id, member.status]));
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
  const conciergeAccounts = (conciergeData ?? []) as ConciergeAccount[];
  await Promise.all(conciergeAccounts.map(async (account) => { if (account.photo_path) { const { data } = await admin.storage.from("private-documents").createSignedUrl(account.photo_path, 60); account.photoUrl = data?.signedUrl ?? null; } }));
  const newConciergeMemberIds = new Set(conciergeAccounts.map((account) => account.member_id));
  const conciergeMembers = members.filter((member) => member.roles.includes("concierge") && member.status !== "revoked" && !member.roles.includes("administrator") && !newConciergeMemberIds.has(member.id));
  const headersByImport = new Map((importData as CensusImport[] ?? []).map((item) => [item.id, Array.isArray(item.headers) ? item.headers.map(String) : []]));
  const censusByUnit = new Map<string, CensusRecord[]>();
  for (const record of (censusData as CensusRecord[] ?? [])) censusByUnit.set(record.unit_id, [...(censusByUnit.get(record.unit_id) ?? []), record]);
  const explorerTowers = buildings.sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true })).map((building) => ({
    id: building.id, name: building.name, code: building.code, active: building.active,
    edit: <BuildingForm propertyId={propertyId} building={building} />,
    units: (building.units ?? []).sort((a, b) => {
      const floorOrder = a.floor && b.floor ? a.floor.localeCompare(b.floor, "es", { numeric: true }) : a.floor ? -1 : b.floor ? 1 : 0;
      return floorOrder || a.code.localeCompare(b.code, "es", { numeric: true });
    }).map((unit) => ({ id: unit.id, code: unit.code, floor: unit.floor, kind: censusKind(censusByUnit.get(unit.id)?.[0]?.user_type),
      content: <>
        <p className="text-sm"><strong>Número:</strong> {unit.code} <span className="mx-2">·</span> <strong>Piso:</strong> {unit.floor || "Sin información"}</p>
        <div className="space-y-4"><h4 className="font-semibold">Información del Excel</h4>{(censusByUnit.get(unit.id) ?? []).map((record, index) => {
          const headers = headersByImport.get(record.import_id) ?? [];
          const cells = Array.isArray(record.cells) ? record.cells.map((value) => value === null ? null : String(value)) : [];
          return <div key={record.id} className="min-w-0 rounded-lg border p-3 sm:p-4"><p className="mb-4 font-medium">{record.full_name || record.email_normalized || `Residente ${index + 1}`}{record.invitation_primary && <span className="ml-2 rounded-full bg-secondary px-2 py-1 text-xs">Principal para futura invitación · {record.invitation_relationship === "owner" ? "Propietario" : "Arrendatario"}</span>}</p>{headers.length ? <CensusDetail headers={headers} cells={cells} /> : <p className="text-sm text-muted-foreground">No se pudieron mostrar los encabezados de esta respuesta.</p>}</div>;
        })}{!censusByUnit.get(unit.id)?.length && <p className="text-sm text-muted-foreground">Este apartamento no tiene respuestas importadas.</p>}</div>
        <div className="space-y-3 border-t pt-4"><h4 className="font-semibold">Vinculaciones y acceso a ResiQ</h4>{(occupantsByUnit.get(unit.id) ?? []).map((occupant) => <OccupantCard key={occupant.link.id} occupant={occupant} propertyId={propertyId} />)}{!occupantsByUnit.get(unit.id)?.length && <><p className="text-sm text-muted-foreground">Sin residente vinculado. Un correo del Excel no concede acceso hasta aceptar la invitación.</p>{invitationByUnit.get(unit.id) && <InvitationStatus invitation={invitationByUnit.get(unit.id)!} propertyId={propertyId} />}{building.active && unit.status === "active" && <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">Agregar residente</summary><p className="mt-2 text-xs text-muted-foreground">Si ya hay una invitación pendiente, la nueva la reemplaza.</p><div className="mt-3"><UnitResidentInvitationForm propertyId={propertyId} unitId={unit.id} /></div></details>}</>}</div>
      </>,
    })),
  }));

  return <>
    <Card className="mt-6"><CardContent>
      <section aria-labelledby="importar-unidades"><h2 id="importar-unidades" className="text-xl font-semibold">Importar unidades desde Excel</h2><p className="mb-5 mt-1 text-sm text-muted-foreground">Importa un archivo Excel para crear automáticamente las torres, apartamentos y registrar su información.</p>{imported && <p role="status" className="mb-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">Importación completada. Se creó una invitación por apartamento, retenida en modo de prueba: no se envió ningún correo ni se concedió acceso.</p>}{canImport ? <CensusImportForm propertyId={propertyId} /> : <p className="rounded-lg bg-secondary p-3 text-sm">Esta propiedad ya tiene torres. Para evitar cruces, esta primera versión no permite importar otro archivo sobre la estructura existente.</p>}</section>
      <section id="apartamentos" className="mt-8 scroll-mt-6 border-t pt-8"><h2 className="text-xl font-semibold">Torres de la propiedad</h2><p className="mt-1 text-sm text-muted-foreground">Abre una torre y después un apartamento para consultar cada respuesta importada y sus vinculaciones, sin mezclar personas.</p>
        <div className="mt-4"><PropertyUnitExplorer towers={explorerTowers} /></div>
      </section>
    </CardContent></Card>
    <section id="porteria" className="mt-10 scroll-mt-6">
      <h2 className="text-2xl font-semibold">Personal de portería</h2>
      <p className="mt-1 text-sm text-muted-foreground">Cada portero tiene un usuario permanente. Su correo real sirve como identidad interna, pero puede entrar con el usuario.</p>
      <Card className="mt-4"><CardContent><details><summary className="cursor-pointer font-semibold">Nuevo portero</summary><div className="mt-5"><ConciergeRegistrationForm propertyId={propertyId} /></div></details></CardContent></Card>
      <div className="mt-4 grid gap-4">
        {conciergeAccounts.map((account) => <Card key={account.id}><CardContent>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{account.full_name}</h3><p className="text-sm text-muted-foreground">Usuario: {account.username}</p><p className="text-sm">Cédula: {maskDocument(account.document_number)} · Edad: {ageFor(account.birth_date)} · Teléfono: {account.phone_e164}</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs">{account.status === "active" && memberStatusById.get(account.member_id) === "active" ? "Activo" : "Inactivo"}</span></div>
          <details className="mt-4 border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Ver detalles</summary><div className="mt-3 space-y-1 text-sm">{account.photoUrl && <Image unoptimized src={account.photoUrl} alt={`Fotografía de ${account.full_name}`} width={96} height={96} className="h-24 w-24 rounded-lg object-cover" />}<p>Cédula: {account.document_number}</p><p>Fecha de nacimiento: {account.birth_date}</p><p>Correo: {account.email_normalized}</p><p>Dirección: {account.address || "Sin información"}</p><p>Vehículos: {Array.isArray(account.vehicles) ? account.vehicles.length : 0}</p>{Array.isArray(account.vehicles) && account.vehicles.map((vehicle, index) => <p key={index}>{index + 1}. {String(vehicle.type ?? "")} · {String(vehicle.brand ?? "")} · {String(vehicle.model ?? "")} · {String(vehicle.plate ?? "")}</p>)}</div></details>
          <ConciergeManagementForms propertyId={propertyId} account={account} />
        </CardContent></Card>)}
        {conciergeMembers.map((member) => <ConciergeCard key={member.id} member={member} propertyId={propertyId} />)}
        {!conciergeMembers.length && !conciergeAccounts.length && <Card><CardContent><p className="text-sm text-muted-foreground">No hay personal de portería registrado.</p></CardContent></Card>}
      </div>
    </section>
  </>;
}
