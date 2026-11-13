"use server";

import { revalidatePath } from "next/cache";
import { requireMaintenanceStaff } from "@/lib/auth/require-maintenance-staff";
import { COLOMBIA_TIME_ZONE, dateInputValue } from "@/lib/time-zone";

export type WarningState = { error?: string; success?: string } | undefined;

// Admin de mantenimiento: registra un llamado de atención (fecha, motivo y descripción).
export async function createWarning(_: WarningState, data: FormData): Promise<WarningState> {
  const { supabase } = await requireMaintenanceStaff("admin");
  const staffId = String(data.get("staffId") ?? ""), date = String(data.get("date") ?? "");
  const reason = String(data.get("reason") ?? "").trim(), description = String(data.get("description") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(staffId)) return { error: "Elige el trabajador." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > dateInputValue(new Date(), COLOMBIA_TIME_ZONE)) return { error: "La fecha no puede ser futura." };
  if (reason.length < 3 || reason.length > 120) return { error: "Escribe el motivo (entre 3 y 120 caracteres)." };
  if (description.length < 3 || description.length > 2000) return { error: "Escribe la descripción (entre 3 y 2.000 caracteres)." };
  const { error } = await supabase.rpc("maintenance_create_warning", { target_staff_id: staffId, target_date: date, target_reason: reason, target_description: description });
  if (error) return { error: error.message.includes("invalid_worker") ? "Ese trabajador ya no está en el equipo." : "No pudimos registrar el llamado de atención." };
  revalidatePath("/mantenimiento/llamados");
  return { success: "Llamado de atención registrado." };
}

// Editar y borrar un llamado (13/11/2026, pedido de Alejandro). Solo el admin; la base valida que sea de su lado.
export async function updateWarning(_: WarningState, data: FormData): Promise<WarningState> {
  const { supabase } = await requireMaintenanceStaff("admin");
  const warningId = String(data.get("warningId") ?? ""), date = String(data.get("date") ?? "");
  const reason = String(data.get("reason") ?? "").trim(), description = String(data.get("description") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(warningId)) return { error: "Llamado no válido." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > dateInputValue(new Date(), COLOMBIA_TIME_ZONE)) return { error: "La fecha no puede ser futura." };
  if (reason.length < 3 || reason.length > 120) return { error: "Escribe el motivo (entre 3 y 120 caracteres)." };
  if (description.length < 3 || description.length > 2000) return { error: "Escribe la descripción (entre 3 y 2.000 caracteres)." };
  const { error } = await supabase.rpc("maintenance_update_warning", { target_warning_id: warningId, target_date: date, target_reason: reason, target_description: description });
  if (error) return { error: error.message.includes("warning_not_found") ? "Ese llamado ya no existe." : "No pudimos guardar los cambios." };
  revalidatePath("/mantenimiento/llamados");
  return { success: "Llamado actualizado." };
}

export async function deleteWarning(_: WarningState, data: FormData): Promise<WarningState> {
  const { supabase } = await requireMaintenanceStaff("admin");
  const warningId = String(data.get("warningId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(warningId)) return { error: "Llamado no válido." };
  const { error } = await supabase.rpc("maintenance_delete_warning", { target_warning_id: warningId });
  if (error) return { error: error.message.includes("warning_not_found") ? "Ese llamado ya no existe." : "No pudimos borrar el llamado." };
  revalidatePath("/mantenimiento/llamados");
  return { success: "Llamado borrado." };
}
