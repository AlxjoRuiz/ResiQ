"use server";

import { revalidatePath } from "next/cache";
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
  if (!propertyId || !name || !code) return { error: "Completa el nombre y el código de la torre." };
  const supabase = await createClient();
  const result = buildingId
    ? await supabase.rpc("update_building", { target_property_id: propertyId, target_building_id: buildingId, target_name: name, target_code: code, target_active: active })
    : await supabase.rpc("create_building", { target_property_id: propertyId, target_name: name, target_code: code });
  if (result.error) return { error: databaseError(result.error.code) };
  propertyPaths(propertyId);
  return { success: buildingId ? "Torre actualizada." : "Torre creada." };
}

export async function saveUnit(_: ManagementState, formData: FormData): Promise<ManagementState> {
  const propertyId = field(formData, "propertyId");
  const unitId = field(formData, "unitId");
  const buildingId = field(formData, "buildingId");
  const code = field(formData, "code");
  const floor = field(formData, "floor");
  const status = field(formData, "status") || "active";
  if (!propertyId || !buildingId || !code) return { error: "Completa la torre y el número del apartamento." };
  const supabase = await createClient();
  const result = unitId
    ? await supabase.rpc("update_unit", { target_property_id: propertyId, target_unit_id: unitId, target_building_id: buildingId, target_code: code, target_floor: floor, target_status: status })
    : await supabase.rpc("create_unit", { target_property_id: propertyId, target_building_id: buildingId, target_code: code, target_floor: floor });
  if (result.error) return { error: databaseError(result.error.code) };
  propertyPaths(propertyId);
  return { success: unitId ? "Apartamento actualizado." : "Apartamento creado." };
}

export async function manageMember(_: ManagementState, formData: FormData): Promise<ManagementState> {
  const propertyId = field(formData, "propertyId");
  const memberId = field(formData, "memberId");
  const status = field(formData, "status");
  const roles = formData.getAll("roles").map(String).filter((role) => role === "member" || role === "concierge");
  if (!propertyId || !memberId || !status || roles.length === 0) return { error: "Selecciona al menos un rol válido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("manage_property_member", { target_property_id: propertyId, target_member_id: memberId, target_roles: roles, target_status: status });
  if (error) return { error: databaseError(error.code) };
  propertyPaths(propertyId);
  return { success: "Acceso del miembro actualizado." };
}

export async function addUnitMembership(_: ManagementState, formData: FormData): Promise<ManagementState> {
  const propertyId = field(formData, "propertyId");
  const memberId = field(formData, "memberId");
  const unitId = field(formData, "unitId");
  const relationship = field(formData, "relationship");
  if (!propertyId || !memberId || !unitId || !["owner", "resident"].includes(relationship)) return { error: "Selecciona apartamento y relación." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_unit_membership", { target_property_id: propertyId, target_member_id: memberId, target_unit_id: unitId, target_relationship: relationship });
  if (error) return { error: databaseError(error.code) };
  propertyPaths(propertyId);
  return { success: "Apartamento vinculado al miembro." };
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
