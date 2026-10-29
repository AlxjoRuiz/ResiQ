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
