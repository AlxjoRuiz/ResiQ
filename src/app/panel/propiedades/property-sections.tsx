import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CensusImportForm } from "@/components/census/census-import-form";
import { CensusUpdateForm } from "@/components/census/census-update-form";
import { CENSUS_MAX_ROWS } from "@/lib/census/parse";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { BuildingForm, MemberForm } from "./management-forms";
import { PropertyUnitExplorer } from "./property-unit-explorer";
import { ConciergeRegistrationForm } from "./concierge-registration-form";
import { ConciergeManagementForms, ConciergeStatusForm } from "./concierge-management-forms";
import { AdminAssistantManagementForms } from "./admin-assistant-management-forms";
import { AdminAssistantInvitationForm, AdminAssistantStatusForm, InviteAdminAssistantForm } from "./admin-assistant-forms";
import { maskDocument } from "@/lib/concierge/identity";
import { COLOMBIA_TIME_ZONE, dateInputValue } from "@/lib/time-zone";

type Unit = { id: string; building_id: string; code: string; floor: string | null; status: string };
type Building = { id: string; name: string; code: string; active: boolean; units: Unit[] | null };
type Member = { id: string; user_id: string; roles: string[]; status: string; profiles: { display_name: string } | { display_name: string }[] | null; email?: string | null };
type CensusKind = { unit_id: string; user_type: string | null };
type AdminAssistant = { member_id: string | null; invitation_id: string | null; display_name: string | null; email: string; assistant_status: string; since: string; full_name: string | null; document_number: string | null; birth_date: string | null; phone_e164: string | null; address: string | null; vehicles: unknown; username: string | null; record_id: string | null; first_name: string | null; first_surname: string | null };
const assistantLabels: Record<string, string> = { active: "Activo", suspended: "Suspendido", invited: "Invitación pendiente", expired: "Invitación vencida" };
type ConciergeAccount = { id: string; member_id: string; username: string; full_name: string; document_number: string; birth_date: string; phone_e164: string; email_normalized: string; address: string | null; vehicles: unknown; status: string };
function ageFor(birthDate: string) { const today = dateInputValue(new Date(), COLOMBIA_TIME_ZONE); return Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4)) - (today.slice(5) < birthDate.slice(5) ? 1 : 0); }

function one<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
// Tipo mostrado junto al apartamento, tomado de «Tipo de usuario» del censo.
function censusKind(userType: string | null | undefined) {
  const value = (userType ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  if (["propietario", "propietaria"].includes(value)) return "Propietario";
  if (["residente", "arrendatario", "arrendataria"].includes(value)) return "Residente";
  return null;
}
function statusLabel(status: string) { return status === "active" ? "Activo" : "Inactivo"; }

// Marca de cada dibujo de la página en el servidor: cambia cuando se vuelve a dibujar (después de guardar
// algo) y así los apartamentos abiertos vuelven a pedir sus datos (ver LazyUnit).
function requestStamp() { return String(Date.now()); }

function ConciergeCard({ member, propertyId }: { member: Member; propertyId: string }) {
  return <Card><CardContent><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-lg font-semibold">{one(member.profiles)?.display_name ?? "Miembro"}</h4><p className="break-all text-sm text-muted-foreground">{member.email ?? "Correo no disponible"}</p><p className="mt-1 text-xs text-muted-foreground">Cuenta anterior creada por invitación; no tiene usuario permanente.</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{statusLabel(member.status)}</span></div><details className="mt-4 border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Administrar acceso</summary><MemberForm propertyId={propertyId} member={member} /></details></CardContent></Card>;
}

export async function PropertyManagementSections({ propertyId, canImport, imported }: { propertyId: string; canImport: boolean; imported: boolean }) {
  const supabase = await createClient();
  // Liviano: torres, apartamentos y el tipo de usuario del censo de cada uno (para la etiqueta). El censo
  // completo, residentes e invitación de cada apartamento se piden al abrirlo (LazyUnit, 29/10/2026).
  const [{ data: buildingData, error: buildingError }, { data: memberData, error: memberError }, { data: censusData, error: censusError }, { data: conciergeData, error: conciergeError }, { data: assistantData, error: assistantError }] = await Promise.all([
    supabase.from("buildings").select("id,name,code,active,units(id,building_id,code,floor,status)").eq("property_id", propertyId).order("name"),
    supabase.from("property_members").select("id,user_id,roles,status,profiles!property_members_user_id_fkey(display_name)").eq("property_id", propertyId).contains("roles", ["concierge"]).order("joined_at"),
    supabase.from("census_records").select("unit_id,user_type").eq("property_id", propertyId).limit(CENSUS_MAX_ROWS),
    supabase.from("concierge_accounts").select("id,member_id,username,full_name,document_number,birth_date,phone_e164,email_normalized,address,vehicles,status").eq("property_id", propertyId).neq("status", "removed").order("created_at", { ascending: false }),
    supabase.rpc("get_admin_assistants", { target_property_id: propertyId }),
  ]);
  if (buildingError || memberError || censusError || conciergeError || assistantError) throw new Error("No se pudieron cargar las torres y sus accesos.");
  const assistants = (assistantData ?? []) as AdminAssistant[];
  const buildings = (buildingData ?? []) as Building[];
  const members = (memberData ?? []) as Member[];
  const memberStatusById = new Map(members.map((member) => [member.id, member.status]));
  const conciergeAccounts = (conciergeData ?? []) as ConciergeAccount[];
  const newConciergeMemberIds = new Set(conciergeAccounts.map((account) => account.member_id));
  const conciergeMembers = members.filter((member) => member.status !== "revoked" && !member.roles.includes("administrator") && !newConciergeMemberIds.has(member.id));
  // Correo solo de la portería antigua que se muestra abajo (antes se pedía el de todos los miembros).
  const admin = conciergeMembers.length ? createAdminClient() : null;
  if (admin) await Promise.all(conciergeMembers.map(async (member) => {
    const { data, error } = await admin.auth.admin.getUserById(member.user_id);
    member.email = error ? null : data.user?.email ?? null;
  }));
  const kindByUnit = new Map<string, string | null>();
  for (const record of (censusData ?? []) as CensusKind[]) if (!kindByUnit.has(record.unit_id)) kindByUnit.set(record.unit_id, censusKind(record.user_type));
  const explorerTowers = buildings.sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true })).map((building) => ({
    id: building.id, name: building.name, code: building.code, active: building.active,
    edit: <BuildingForm propertyId={propertyId} building={building} />,
    units: (building.units ?? []).sort((a, b) => {
      const floorOrder = a.floor && b.floor ? a.floor.localeCompare(b.floor, "es", { numeric: true }) : a.floor ? -1 : b.floor ? 1 : 0;
      return floorOrder || a.code.localeCompare(b.code, "es", { numeric: true });
    }).map((unit) => ({ id: unit.id, code: unit.code, floor: unit.floor, kind: kindByUnit.get(unit.id) ?? null })),
  }));

  return <>
    <Card className="mt-6"><CardContent className="p-3 sm:p-6">
      <section aria-labelledby="importar-unidades"><div className="flex flex-wrap items-start justify-between gap-3"><h2 id="importar-unidades" className="text-xl font-semibold">{canImport ? "Importar unidades desde Excel" : "Actualizar censo desde Excel"}</h2>{!canImport && <Button asChild variant="outline" size="sm"><a href={`/api/census/export/${propertyId}`} download>Descargar censo</a></Button>}</div><p className="mb-5 mt-1 text-sm text-muted-foreground">{canImport ? "Importa un archivo Excel para crear automáticamente las torres, apartamentos y registrar su información." : "Sube el Excel con los datos actualizados del censo."}</p>{imported && <p role="status" className="mb-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">Importación completada. Se creó una invitación por apartamento, retenida en modo de prueba: no se envió ningún correo ni se concedió acceso.</p>}{canImport ? <CensusImportForm propertyId={propertyId} /> : <CensusUpdateForm propertyId={propertyId} />}</section>
      <section id="apartamentos" className="mt-8 scroll-mt-6 border-t pt-8"><h2 className="text-xl font-semibold">Torres de la propiedad</h2><p className="mt-1 text-sm text-muted-foreground">Abre una torre y después un apartamento para consultar cada respuesta importada y sus vinculaciones, sin mezclar personas.</p>
        <div className="mt-4"><PropertyUnitExplorer propertyId={propertyId} towers={explorerTowers} refreshKey={requestStamp()} /></div>
      </section>
    </CardContent></Card>
    <section id="porteria" className="mt-10 scroll-mt-6">
      <h2 className="text-2xl font-semibold">Personal de portería</h2>
      <p className="mt-1 text-sm text-muted-foreground">Cada portero tiene un usuario permanente. Su correo real sirve como identidad interna, pero puede entrar con el usuario.</p>
      <Card className="mt-4"><CardContent><details><summary className="cursor-pointer font-semibold">Nuevo portero</summary><div className="mt-5"><ConciergeRegistrationForm propertyId={propertyId} /></div></details></CardContent></Card>
      <div className="mt-4 grid gap-4">
        {conciergeAccounts.map((account) => <Card key={account.id}><CardContent>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{account.full_name}</h3><p className="text-sm text-muted-foreground">Usuario: {account.username}</p><p className="text-sm">Cédula: {maskDocument(account.document_number)} · Edad: {ageFor(account.birth_date)} · Teléfono: {account.phone_e164}</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs">{account.status === "active" && memberStatusById.get(account.member_id) === "active" ? "Activo" : "Inactivo"}</span></div>
          <details className="mt-4 border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Ver detalles</summary><div className="mt-3 space-y-1 text-sm"><p>Cédula: {account.document_number}</p><p>Fecha de nacimiento: {account.birth_date}</p><p>Correo: {account.email_normalized}</p><p>Dirección: {account.address || "Sin información"}</p><p>Vehículos: {Array.isArray(account.vehicles) ? account.vehicles.length : 0}</p>{Array.isArray(account.vehicles) && account.vehicles.map((vehicle, index) => <p key={index}>{index + 1}. {String(vehicle.type ?? "")} · {String(vehicle.brand ?? "")} · {String(vehicle.model ?? "")} · {String(vehicle.plate ?? "")}</p>)}</div></details>
          {account.status === "active" && memberStatusById.get(account.member_id) !== "revoked" && <ConciergeStatusForm key={memberStatusById.get(account.member_id)} propertyId={propertyId} accountId={account.id} suspended={memberStatusById.get(account.member_id) === "suspended"} />}
          <ConciergeManagementForms propertyId={propertyId} account={account} />
        </CardContent></Card>)}
        {conciergeMembers.map((member) => <ConciergeCard key={member.id} member={member} propertyId={propertyId} />)}
        {!conciergeMembers.length && !conciergeAccounts.length && <Card><CardContent><p className="text-sm text-muted-foreground">No hay personal de portería registrado.</p></CardContent></Card>}
      </div>
    </section>
    <section id="auxiliares" className="mt-10 scroll-mt-6">
      <h2 className="text-2xl font-semibold">Auxiliares de administración</h2>
      <p className="mt-1 text-sm text-muted-foreground">Tienen los mismos permisos de administración. Entran con su usuario permanente o con su correo.</p>
      <Card className="mt-4"><CardContent><details><summary className="cursor-pointer font-semibold">Nuevo auxiliar</summary><div className="mt-5"><InviteAdminAssistantForm propertyId={propertyId} /></div></details></CardContent></Card>
      <div className="mt-4 grid gap-4">
        {assistants.map((assistant) => <Card key={assistant.member_id ?? assistant.invitation_id}><CardContent>
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold">{assistant.full_name ?? assistant.display_name ?? "Sin aceptar todavía"}</h3><p className="break-all text-sm text-muted-foreground">{assistant.email}</p>{assistant.username && <p className="text-sm text-muted-foreground">Usuario: {assistant.username}</p>}{assistant.document_number && assistant.birth_date && <p className="text-sm">Cédula: {maskDocument(assistant.document_number)} · Edad: {ageFor(assistant.birth_date)} · Teléfono: {assistant.phone_e164}</p>}</div><span className={`rounded-full px-3 py-1 text-xs ${assistant.assistant_status === "suspended" || assistant.assistant_status === "expired" ? "bg-amber-100 text-amber-900" : "bg-secondary"}`}>{assistantLabels[assistant.assistant_status] ?? assistant.assistant_status}</span></div>
          {assistant.document_number && <details className="mt-4 border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Ver detalles</summary><div className="mt-3 space-y-1 text-sm"><p>Cédula: {assistant.document_number}</p><p>Fecha de nacimiento: {assistant.birth_date}</p><p>Correo: {assistant.email}</p><p>Dirección: {assistant.address || "Sin información"}</p><p>Vehículos: {Array.isArray(assistant.vehicles) ? assistant.vehicles.length : 0}</p>{Array.isArray(assistant.vehicles) && assistant.vehicles.map((vehicle, index) => <p key={index}>{index + 1}. {String(vehicle.type ?? "")} · {String(vehicle.brand ?? "")} · {String(vehicle.model ?? "")} · {String(vehicle.plate ?? "")}</p>)}</div></details>}
          <div className="mt-4 border-t pt-4">{assistant.invitation_id ? <AdminAssistantInvitationForm propertyId={propertyId} invitationId={assistant.invitation_id} /> : assistant.member_id && <AdminAssistantStatusForm key={assistant.assistant_status} propertyId={propertyId} memberId={assistant.member_id} suspended={assistant.assistant_status === "suspended"} />}{assistant.member_id && assistant.record_id && assistant.username && assistant.first_name && assistant.first_surname && assistant.document_number && assistant.birth_date && assistant.phone_e164 && <AdminAssistantManagementForms propertyId={propertyId} account={{ id: assistant.record_id, first_name: assistant.first_name, first_surname: assistant.first_surname, document_number: assistant.document_number, birth_date: assistant.birth_date, phone_e164: assistant.phone_e164, address: assistant.address, vehicles: assistant.vehicles, username: assistant.username, email: assistant.email }} />}</div>
        </CardContent></Card>)}
        {!assistants.length && <Card><CardContent><p className="text-sm text-muted-foreground">No hay auxiliares de administración.</p></CardContent></Card>}
      </div>
    </section>
  </>;
}
