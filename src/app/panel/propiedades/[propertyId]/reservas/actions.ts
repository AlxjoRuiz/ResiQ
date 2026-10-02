"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ReservationState = { error?: string; success?: string } | undefined;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const field = (data: FormData, name: string) => String(data.get(name) ?? "").trim();

function friendlyError(message?: string) {
  if (message?.includes("not_authorized")) return "No tienes permiso para realizar esta acción.";
  if (message?.includes("amenity_name_exists")) return "Ya existe una zona con ese nombre.";
  if (message?.includes("hours_required")) return "Configura al menos un día y horario.";
  if (message?.includes("overlapping_hours") || message?.includes("invalid_hours")) return "Los horarios se cruzan o no son válidos.";
  if (message?.includes("active_reservations_exist")) return "Hay reservas activas en ese periodo. Resuélvelas antes de continuar.";
  if (message?.includes("blackout_conflict")) return "Ese cierre se cruza con otro cierre existente.";
  if (message?.includes("reservation_conflict")) return "El horario acaba de ser ocupado. Selecciona otro intervalo.";
  if (message?.includes("amenity_closed")) return "La zona está cerrada durante ese intervalo.";
  if (message?.includes("outside_amenity_hours")) return "El intervalo debe quedar dentro del horario configurado para ese día.";
  if (message?.includes("invalid_slot")) return "La hora y duración deben respetar los bloques configurados para la zona.";
  if (message?.includes("amenity_unavailable")) return "La zona ya no está disponible.";
  if (message?.includes("debt_policy_unavailable")) return "La política de cartera todavía no está habilitada para reservas.";
  if (message?.includes("invalid_transition")) return "La reserva ya no admite ese cambio.";
  if (message?.includes("reason_required")) return "Escribe el motivo de la decisión.";
  return "No pudimos guardar el cambio. Revisa los datos e inténtalo nuevamente.";
}

const reservationPath = (propertyId: string) => `/panel/propiedades/${propertyId}/reservas`;
const amenityPath = (propertyId: string) => `/panel/propiedades/${propertyId}/zonas`;

export async function saveAmenity(_: ReservationState, data: FormData): Promise<ReservationState> {
  const propertyId = field(data, "propertyId"), amenityId = field(data, "amenityId"), name = field(data, "name");
  const capacity = Number(field(data, "capacity")), slotMinutes = Number(field(data, "slotMinutes"));
  const description = field(data, "description"), rules = field(data, "rules"), status = field(data, "status");
  const requiresApproval = data.get("requiresApproval") === "on";
  const hours = Array.from({ length: 7 }, (_, index) => index + 1).flatMap((weekday) => {
    if (data.get(`day_${weekday}`) !== "on") return [];
    const opensAt = field(data, `opens_${weekday}`), closesAt = field(data, `closes_${weekday}`);
    return opensAt && closesAt ? [{ weekday, opens_at: opensAt, closes_at: closesAt }] : [];
  });
  if (!uuidPattern.test(propertyId) || (amenityId && !uuidPattern.test(amenityId)) || name.length < 2 || name.length > 100 || !Number.isInteger(capacity) || capacity < 1 || capacity > 10000 || !Number.isInteger(slotMinutes) || slotMinutes < 15 || slotMinutes > 1440 || description.length > 1000 || rules.length > 3000 || !["active", "inactive"].includes(status) || hours.length === 0) return { error: "Completa la zona y al menos un horario válido." };
  const supabase = await createClient();
  const result = await supabase.rpc("save_amenity", { target_property_id: propertyId, target_amenity_id: amenityId || null, target_name: name, target_description: description, target_capacity: capacity, target_requires_approval: requiresApproval, target_rules: rules, target_slot_minutes: slotMinutes, target_status: status, target_hours: hours });
  if (result.error) return { error: friendlyError(result.error.message) };
  revalidatePath(amenityPath(propertyId)); revalidatePath(reservationPath(propertyId)); revalidatePath(`/panel/propiedades/${propertyId}/dashboard`);
  return { success: amenityId ? "Zona actualizada." : "Zona creada." };
}

export async function updateReservationPolicy(_: ReservationState, data: FormData): Promise<ReservationState> {
  const propertyId = field(data, "propertyId"), minutes = Number(field(data, "pendingHoldMinutes"));
  if (!uuidPattern.test(propertyId) || !Number.isInteger(minutes) || minutes < 60 || minutes > 2880) return { error: "La vigencia debe estar entre 60 minutos y 48 horas." };
  const supabase = await createClient(); const result = await supabase.rpc("update_reservation_policy", { target_property_id: propertyId, target_pending_hold_minutes: minutes });
  if (result.error) return { error: friendlyError(result.error.message) };
  revalidatePath(amenityPath(propertyId)); return { success: "Política actualizada." };
}

export async function createAmenityBlackout(_: ReservationState, data: FormData): Promise<ReservationState> {
  const propertyId = field(data, "propertyId"), amenityId = field(data, "amenityId"), startsAt = field(data, "startsAt"), endsAt = field(data, "endsAt"), reason = field(data, "reason");
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(amenityId) || !startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt) || reason.length < 3 || reason.length > 500) return { error: "Completa un cierre válido." };
  const supabase = await createClient(); const result = await supabase.rpc("create_amenity_blackout", { target_amenity_id: amenityId, target_starts_at: startsAt, target_ends_at: endsAt, target_reason: reason });
  if (result.error) return { error: friendlyError(result.error.message) };
  revalidatePath(amenityPath(propertyId)); revalidatePath(reservationPath(propertyId)); return { success: "Cierre programado." };
}

export async function deleteAmenityBlackout(_: ReservationState, data: FormData): Promise<ReservationState> {
  const propertyId = field(data, "propertyId"), blackoutId = field(data, "blackoutId");
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(blackoutId)) return { error: "Cierre inválido." };
  const supabase = await createClient(); const result = await supabase.rpc("delete_amenity_blackout", { target_blackout_id: blackoutId });
  if (result.error) return { error: friendlyError(result.error.message) };
  revalidatePath(amenityPath(propertyId)); revalidatePath(reservationPath(propertyId)); return { success: "Cierre eliminado." };
}

export async function createReservation(_: ReservationState, data: FormData): Promise<ReservationState> {
  const propertyId = field(data, "propertyId"), amenityId = field(data, "amenityId"), unitId = field(data, "unitId"), startsAt = field(data, "startsAt"), endsAt = field(data, "endsAt");
  const attendeeCount = Number(field(data, "attendeeCount"));
  if (![propertyId, amenityId, unitId].every((value) => uuidPattern.test(value)) || !startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt) || !Number.isInteger(attendeeCount) || attendeeCount < 1) return { error: "Completa una reserva válida." };
  const supabase = await createClient(); const result = await supabase.rpc("create_reservation", { target_property_id: propertyId, target_amenity_id: amenityId, target_unit_id: unitId, target_starts_at: startsAt, target_ends_at: endsAt, target_attendee_count: attendeeCount, target_idempotency_key: crypto.randomUUID() });
  if (result.error || !result.data) return { error: friendlyError(result.error?.message) };
  revalidatePath(reservationPath(propertyId)); redirect(`${reservationPath(propertyId)}?created=1`);
}

export async function decideReservation(_: ReservationState, data: FormData): Promise<ReservationState> {
  const propertyId = field(data, "propertyId"), reservationId = field(data, "reservationId"), decision = field(data, "decision"), reason = field(data, "reason");
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(reservationId) || !["approve", "reject"].includes(decision) || (decision === "reject" && reason.length < 3) || reason.length > 500) return { error: "Revisa la decisión y su motivo." };
  const supabase = await createClient(); const result = await supabase.rpc("decide_reservation", { target_reservation_id: reservationId, target_approve: decision === "approve", target_reason: reason });
  if (result.error) return { error: friendlyError(result.error.message) };
  revalidatePath(reservationPath(propertyId)); return { success: decision === "approve" ? "Reserva aprobada." : "Reserva rechazada." };
}

export async function cancelReservation(_: ReservationState, data: FormData): Promise<ReservationState> {
  const propertyId = field(data, "propertyId"), reservationId = field(data, "reservationId"), reason = field(data, "reason");
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(reservationId) || reason.length < 3 || reason.length > 500) return { error: "Escribe un motivo válido." };
  const supabase = await createClient(); const result = await supabase.rpc("cancel_reservation", { target_reservation_id: reservationId, target_reason: reason });
  if (result.error) return { error: friendlyError(result.error.message) };
  revalidatePath(reservationPath(propertyId)); return { success: "Reserva cancelada." };
}
