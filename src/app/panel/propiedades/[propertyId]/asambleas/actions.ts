"use server";

import { revalidatePath } from "next/cache";
import { assemblyTypes } from "@/lib/assemblies/constants";
import { requirePropertyMember } from "@/lib/auth/require-property-member";
import { createClient } from "@/lib/supabase/server";
import { visitTimeToIso } from "@/lib/visitors/validation";

export type AssemblyActionState = { error?: string; success?: string } | undefined;
export type CreateAssemblyResult = { error?: string; assemblyId?: string };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const field = (data: FormData, name: string) => String(data.get(name) ?? "").trim();

function friendlyError(message?: string) {
  if (message?.includes("not_authorized")) return "No tienes permiso o el plazo para esta acción ya terminó.";
  if (message?.includes("duplicate_attendee")) return "Cada persona debe aparecer una sola vez en la convocatoria.";
  if (message?.includes("invalid_attendee")) return "Uno de los convocados ya no tiene un vínculo vigente con ese apartamento.";
  if (message?.includes("invalid_publish")) return "Revisa que la fecha sea futura y que existan agenda y convocados.";
  if (message?.includes("convocation_required") || message?.includes("invalid_uploads")) return "Adjunta y valida una convocatoria antes de crear la asamblea.";
  if (message?.includes("correction_note_required")) return "Explica el motivo de la corrección de asistencia.";
  if (message?.includes("assembly_not_in_progress")) return "Podrás marcar tu llegada cuando Administración inicie la asamblea.";
  if (message?.includes("not_invited_or_inactive")) return "No tienes una convocatoria activa para marcar asistencia.";
  if (message?.includes("attendance_already_recorded")) return "La asistencia ya fue registrada. Solicita una corrección a Administración.";
  if (message?.includes("active_representation_exists")) return "Ya existe una representación activa para esa persona y apartamento.";
  if (message?.includes("evidence_required")) return "Adjunta al menos una evidencia válida antes de aprobar la representación.";
  if (message?.includes("quorum_not_reached")) return "Aún no supera el 50% de apartamentos que asistirán.";
  if (message?.includes("convocation_not_approved")) return "Aprueba la asamblea antes de iniciarla. Necesita más del 50% de apartamentos que asistirán.";
  if (message?.includes("invalid_transition") || message?.includes("invalid_review")) return "Ese cambio no está permitido en el estado actual.";
  return "No pudimos guardar el cambio. Revisa los datos e inténtalo nuevamente.";
}

export async function createAssembly(data: FormData): Promise<CreateAssemblyResult> {
  const propertyId = field(data, "propertyId"), type = field(data, "type"), title = field(data, "title"), requestId = field(data, "requestId");
  const description = field(data, "description"), location = field(data, "location"), localStartsAt = field(data, "startsAt");
  const agenda = field(data, "agenda").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => ({ title: line }));
  const audience = Array.from(new Set(data.getAll("audience").map(String))).map((value) => {
    const [member_id, unit_id] = value.split("|"); return { member_id, unit_id };
  }).filter((item) => uuidPattern.test(item.member_id) && uuidPattern.test(item.unit_id));
  let uploadIds: string[];
  try { const parsed: unknown = JSON.parse(field(data, "uploadIds")); uploadIds = Array.isArray(parsed) && parsed.every((id) => typeof id === "string" && uuidPattern.test(id)) ? parsed : []; }
  catch { uploadIds = []; }
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(requestId) || !assemblyTypes.some(([value]) => value === type) || title.length < 4 || title.length > 180
    || location.length < 3 || location.length > 240 || agenda.length < 1 || agenda.length > 100 || audience.length < 1 || audience.length > 500 || uploadIds.length < 1 || uploadIds.length > 5) {
    return { error: "Completa la fecha futura, el lugar, la agenda, al menos un convocado y la convocatoria adjunta." };
  }
  const supabase = await createClient();
  const { data: property } = await supabase.from("properties").select("timezone").eq("id", propertyId).maybeSingle();
  const startsAt = property ? visitTimeToIso(localStartsAt, property.timezone) : null;
  if (!startsAt || new Date(startsAt) <= new Date()) return { error: "Completa una fecha y hora futuras de la comunidad." };
  const result = await supabase.rpc("create_published_assembly", { target_property_id: propertyId, target_type: type, target_title: title, target_description: description || null, target_starts_at: startsAt, target_location: location, target_agenda: agenda, target_audience: audience, target_upload_ids: uploadIds, target_request_id: requestId });
  if (result.error || !result.data) return { error: friendlyError(result.error?.message) };
  revalidatePath(`/panel/propiedades/${propertyId}/asambleas`);
  return { assemblyId: String(result.data) };
}

export async function publishAssembly(_: AssemblyActionState, data: FormData): Promise<AssemblyActionState> {
  const propertyId = field(data, "propertyId"), assemblyId = field(data, "assemblyId");
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(assemblyId)) return { error: "Asamblea inválida." };
  const supabase = await createClient(); const result = await supabase.rpc("publish_assembly", { target_assembly_id: assemblyId });
  if (result.error) return { error: friendlyError(result.error.message) };
  revalidatePath(`/panel/propiedades/${propertyId}/asambleas`); revalidatePath(`/panel/propiedades/${propertyId}/asambleas/${assemblyId}`);
  return { success: "Convocatoria publicada y correos programados." };
}

export async function updateAssembly(_: AssemblyActionState, data: FormData): Promise<AssemblyActionState> {
  const propertyId = field(data, "propertyId"), assemblyId = field(data, "assemblyId"), title = field(data, "title"), description = field(data, "description"), location = field(data, "location"), localStartsAt = field(data, "startsAt");
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(assemblyId) || title.length < 4 || location.length < 3) return { error: "Completa los datos válidos de la asamblea." };
  const supabase = await createClient();
  const { data: property } = await supabase.from("properties").select("timezone").eq("id", propertyId).maybeSingle();
  const startsAt = property ? visitTimeToIso(localStartsAt, property.timezone) : null;
  if (!startsAt) return { error: "Completa una fecha y hora válidas de la comunidad." };
  const result = await supabase.rpc("update_assembly", { target_assembly_id: assemblyId, target_title: title, target_description: description || null, target_starts_at: startsAt, target_location: location });
  if (result.error) return { error: friendlyError(result.error.message) };
  revalidatePath(`/panel/propiedades/${propertyId}/asambleas/${assemblyId}`); revalidatePath(`/panel/propiedades/${propertyId}/asambleas`);
  return { success: "Información actualizada." };
}

export async function changeAssemblyStatus(_: AssemblyActionState, data: FormData): Promise<AssemblyActionState> {
  const propertyId = field(data, "propertyId"), assemblyId = field(data, "assemblyId"), status = field(data, "status"), reason = field(data, "reason");
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(assemblyId) || !["in_progress", "finished", "cancelled"].includes(status) || (status === "cancelled" && reason.length < 4)) return { error: "Selecciona un cambio válido y agrega el motivo requerido." };
  const supabase = await createClient(); const result = await supabase.rpc("change_assembly_status", { target_assembly_id: assemblyId, target_status: status, target_reason: reason || null });
  if (result.error) return { error: friendlyError(result.error.message) };
  revalidatePath(`/panel/propiedades/${propertyId}/asambleas/${assemblyId}`); revalidatePath(`/panel/propiedades/${propertyId}/asambleas`);
  return { success: status === "cancelled" ? "Asamblea cancelada y avisos creados." : "Estado actualizado." };
}

export async function setAssemblyRsvp(_: AssemblyActionState, data: FormData): Promise<AssemblyActionState> {
  const propertyId = field(data, "propertyId"), assemblyId = field(data, "assemblyId"), rsvp = field(data, "rsvp");
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(assemblyId) || !["yes", "no"].includes(rsvp)) return { error: "Respuesta inválida." };
  const supabase = await createClient(); const result = await supabase.rpc("set_assembly_rsvp", { target_assembly_id: assemblyId, target_rsvp: rsvp });
  if (result.error) return { error: friendlyError(result.error.message) };
  revalidatePath(`/panel/propiedades/${propertyId}/asambleas/${assemblyId}`); revalidatePath(`/panel/propiedades/${propertyId}/asambleas`); revalidatePath("/panel/asambleas"); return { success: "Respuesta guardada." };
}

export async function approveAssemblyConvocation(_: AssemblyActionState, data: FormData): Promise<AssemblyActionState> {
  const propertyId = field(data, "propertyId"), assemblyId = field(data, "assemblyId");
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(assemblyId)) return { error: "Asamblea inválida." };
  const supabase = await createClient(); const result = await supabase.rpc("approve_assembly_convocation", { target_assembly_id: assemblyId });
  if (result.error) return { error: friendlyError(result.error.message) };
  revalidatePath(`/panel/propiedades/${propertyId}/asambleas/${assemblyId}`); revalidatePath(`/panel/propiedades/${propertyId}/asambleas`); return { success: "Asamblea aprobada." };
}

export async function recordAssemblyAttendance(_: AssemblyActionState, data: FormData): Promise<AssemblyActionState> {
  const propertyId = field(data, "propertyId"), assemblyId = field(data, "assemblyId"), attendeeId = field(data, "attendeeId"), value = field(data, "attended"), note = field(data, "note");
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(assemblyId) || !uuidPattern.test(attendeeId) || !["true", "false"].includes(value)) return { error: "Registro inválido." };
  const supabase = await createClient(); const result = await supabase.rpc("record_assembly_attendance", { target_attendee_id: attendeeId, target_attended: value === "true", target_note: note || null });
  if (result.error) return { error: friendlyError(result.error.message) };
  revalidatePath(`/panel/propiedades/${propertyId}/asambleas/${assemblyId}`); return { success: "Asistencia guardada." };
}

export async function selfCheckInAssembly(_: AssemblyActionState, data: FormData): Promise<AssemblyActionState> {
  const propertyId = field(data, "propertyId"), assemblyId = field(data, "assemblyId");
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(assemblyId)) return { error: "Asamblea inválida." };
  const { supabase, membership } = await requirePropertyMember(propertyId);
  if (!membership.roles.includes("member")) return { error: "Solo un convocado puede marcar su propia asistencia." };
  const { data: assembly } = await supabase.from("assemblies").select("id").eq("property_id", propertyId).eq("id", assemblyId).maybeSingle();
  if (!assembly) return { error: "No tienes acceso a esta asamblea." };
  const { error } = await supabase.rpc("self_check_in_assembly", { target_assembly_id: assemblyId });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath(`/panel/propiedades/${propertyId}/asambleas/${assemblyId}`);
  return { success: "Tu asistencia quedó registrada." };
}

export async function submitAssemblyRepresentation(_: AssemblyActionState, data: FormData): Promise<AssemblyActionState> {
  const propertyId = field(data, "propertyId"), assemblyId = field(data, "assemblyId"), unitId = field(data, "unitId"), memberId = field(data, "representativeMemberId"), externalName = field(data, "externalName");
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(assemblyId) || !uuidPattern.test(unitId) || (Boolean(memberId) === Boolean(externalName)) || (memberId && !uuidPattern.test(memberId))) return { error: "Selecciona un apartamento y exactamente un tipo de representante." };
  const supabase = await createClient(); const result = await supabase.rpc("submit_assembly_representation", { target_assembly_id: assemblyId, target_unit_id: unitId, target_representative_member_id: memberId || null, target_external_name: externalName || null });
  if (result.error || !result.data) return { error: friendlyError(result.error?.message) };
  revalidatePath(`/panel/propiedades/${propertyId}/asambleas/${assemblyId}`); return { success: `Representación creada. Adjunta la evidencia en el expediente ${result.data}.` };
}

export async function reviewAssemblyRepresentation(_: AssemblyActionState, data: FormData): Promise<AssemblyActionState> {
  const propertyId = field(data, "propertyId"), assemblyId = field(data, "assemblyId"), representationId = field(data, "representationId"), status = field(data, "status"), note = field(data, "note");
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(assemblyId) || !uuidPattern.test(representationId) || !["validated", "rejected", "revoked"].includes(status) || note.length < 4) return { error: "Selecciona una decisión y escribe una nota." };
  const supabase = await createClient(); const result = await supabase.rpc("review_assembly_representation", { target_representation_id: representationId, target_status: status, target_note: note });
  if (result.error) return { error: friendlyError(result.error.message) };
  revalidatePath(`/panel/propiedades/${propertyId}/asambleas/${assemblyId}`); return { success: "Representación revisada." };
}
