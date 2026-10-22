"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type ManagementState = { error?: string; success?: string } | undefined;

function field(formData: FormData, name: string) { return String(formData.get(name) ?? "").trim(); }
function propertyPaths(propertyId: string) {
  revalidatePath("/panel");
  revalidatePath(`/panel/propiedades/${propertyId}`);
  revalidatePath(`/panel/propiedades/${propertyId}/estructura`);
  revalidatePath(`/panel/propiedades/${propertyId}/miembros`);
}
function databaseError(code?: string) {
  return code === "23505" ? "Ya existe un registro con esos datos." : "No pudimos guardar el cambio. Revisa los datos y tus permisos.";
}

export async function updateProperty(_: ManagementState, formData: FormData): Promise<ManagementState> {
  const propertyId = field(formData, "propertyId");
  const name = field(formData, "name");
  const address = field(formData, "address");
  const city = field(formData, "city");
  const timezone = field(formData, "timezone") || "America/Bogota";
  if (!propertyId || name.length < 2) return { error: "Completa un nombre válido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_property_details", { target_property_id: propertyId, target_name: name, target_address: address, target_city: city, target_timezone: timezone });
  if (error) return { error: databaseError(error.code) };
  propertyPaths(propertyId);
  return { success: "Información de la propiedad actualizada." };
}

export async function saveBuilding(_: ManagementState, formData: FormData): Promise<ManagementState> {
  const propertyId = field(formData, "propertyId");
  const buildingId = field(formData, "buildingId");
  const name = field(formData, "name");
  const code = field(formData, "code");
  const active = field(formData, "active") !== "false";
  // Las torres solo se crean al importar el censo; aquí únicamente se editan.
  if (!propertyId || !buildingId || !name || !code) return { error: "Completa el nombre y el código de la torre." };
  const supabase = await createClient();
  const result = await supabase.rpc("update_building", { target_property_id: propertyId, target_building_id: buildingId, target_name: name, target_code: code, target_active: active });
  if (result.error) return { error: databaseError(result.error.code) };
  propertyPaths(propertyId);
  return { success: "Torre actualizada." };
}

export async function saveUnit(_: ManagementState, formData: FormData): Promise<ManagementState> {
  const propertyId = field(formData, "propertyId");
  const unitId = field(formData, "unitId");
  const buildingId = field(formData, "buildingId");
  const code = field(formData, "code");
  const floor = field(formData, "floor");
  const status = field(formData, "status") || "active";
  // Los apartamentos solo se crean al importar el censo; aquí únicamente se editan.
  if (!propertyId || !unitId || !buildingId || !code) return { error: "Completa la torre y el número del apartamento." };
  const supabase = await createClient();
  const result = await supabase.rpc("update_unit", { target_property_id: propertyId, target_unit_id: unitId, target_building_id: buildingId, target_code: code, target_floor: floor, target_status: status });
  if (result.error) return { error: databaseError(result.error.code) };
  propertyPaths(propertyId);
  return { success: "Apartamento actualizado." };
}

export async function manageMember(_: ManagementState, formData: FormData): Promise<ManagementState> {
  const propertyId = field(formData, "propertyId");
  const memberId = field(formData, "memberId");
  const status = field(formData, "status");
  const roles = formData.getAll("roles").map(String).filter((role) => role === "member" || role === "concierge");
  if (!propertyId || !memberId || !status || roles.length === 0) return { error: "Selecciona al menos un rol válido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("manage_property_member", { target_property_id: propertyId, target_member_id: memberId, target_roles: roles, target_status: status });
  if (error) return { error: error.message.includes("resident_requires_invitation") ? "Para reactivar a este residente, envíale una nueva invitación a un apartamento." : databaseError(error.code) };
  propertyPaths(propertyId);
  return { success: status === "suspended" && roles.length === 1 && roles[0] === "member" ? "Residente inactivado y apartamentos liberados. Para reactivarlo, envía una nueva invitación." : "Acceso del miembro actualizado." };
}

export async function endUnitMembership(_: ManagementState, formData: FormData): Promise<ManagementState> {
  const propertyId = field(formData, "propertyId");
  const unitMembershipId = field(formData, "unitMembershipId");
  if (!propertyId || !unitMembershipId) return { error: "No encontramos el vínculo." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("end_unit_membership", { target_property_id: propertyId, target_unit_membership_id: unitMembershipId });
  if (error) return { error: databaseError(error.code) };
  propertyPaths(propertyId);
  return { success: "Vínculo finalizado. El acceso histórico operativo fue retirado." };
}

export async function queueResidentInvitation(_: ManagementState, formData: FormData): Promise<ManagementState> {
  const propertyId = field(formData, "propertyId");
  const unitId = field(formData, "unitId");
  const email = field(formData, "email").toLowerCase();
  const relationship = field(formData, "relationship");
  if (!propertyId || !unitId || !email.includes("@") || !["owner", "resident"].includes(relationship)) return { error: "Escribe un correo válido y el tipo de residente." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("queue_resident_invitation", { target_property_id: propertyId, target_unit_id: unitId, target_email: email, target_relationship: relationship });
  if (error) {
    if (error.message.includes("unit_not_empty")) return { error: "Este apartamento ya tiene un residente vinculado." };
    if (error.message.includes("not_a_resident")) return { error: "Ese correo tiene rol de administración o portería en esta propiedad." };
    return { error: "No pudimos crear la invitación. Comprueba que la torre y el apartamento sigan activos." };
  }
  propertyPaths(propertyId);
  return { success: "Invitación creada. Mientras el envío de correos esté en modo de prueba, usa «Ver enlace» para compartirla." };
}

export type InvitationLinkState = { error?: string; link?: string } | undefined;

export async function revealInvitationLink(_: InvitationLinkState, formData: FormData): Promise<InvitationLinkState> {
  const propertyId = field(formData, "propertyId");
  const invitationId = field(formData, "invitationId");
  if (!propertyId || !invitationId) return { error: "No encontramos la invitación." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reveal_invitation_link", { target_property_id: propertyId, target_invitation_id: invitationId });
  if (error) return { error: "No pudimos generar el enlace. Intenta de nuevo." };
  if (typeof data !== "string") {
    propertyPaths(propertyId);
    return { error: "Esta invitación ya no está disponible: el apartamento cambió o el correo tiene otro rol. Crea una nueva si hace falta." };
  }
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  return { link: `${origin}/invitacion?token=${encodeURIComponent(data)}` };
}

export async function updateCensusRecord(_: ManagementState, formData: FormData): Promise<ManagementState> {
  const propertyId = field(formData, "propertyId");
  const recordId = field(formData, "recordId");
  let cells: unknown;
  try { cells = JSON.parse(String(formData.get("cells") ?? "")); } catch { return { error: "No pudimos leer los cambios." }; }
  if (!propertyId || !recordId || !Array.isArray(cells) || cells.some((cell) => cell !== null && typeof cell !== "string")) return { error: "No pudimos leer los cambios." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_census_record", { target_property_id: propertyId, target_record_id: recordId, target_cells: cells });
  if (error) {
    if (error.message.includes("locked_field")) return { error: "La torre y el apartamento no se pueden cambiar." };
    if (error.message.includes("invalid_census_email")) return { error: "El correo electrónico no es válido." };
    if (error.message.includes("invalid_user_type")) return { error: "Para invitar, «Tipo de usuario» debe ser Propietario, Residente o Arrendatario." };
    if (error.message.includes("email_in_use")) return { error: "Ese correo ya está invitado en otro apartamento de esta propiedad." };
    return { error: "No pudimos guardar los cambios. Revisa los datos e intenta de nuevo." };
  }
  propertyPaths(propertyId);
  if (data === "resident_replaced") return { success: "Cambios guardados. Se desvinculó al residente anterior y se creó la invitación para el correo nuevo (retenida mientras el envío esté en modo de prueba)." };
  if (data === "invitation_replaced") return { success: "Cambios guardados. La invitación pendiente se reemplazó por una para el correo nuevo." };
  return { success: "Cambios guardados." };
}
