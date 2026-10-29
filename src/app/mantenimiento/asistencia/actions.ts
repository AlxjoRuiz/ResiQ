"use server";

import { revalidatePath } from "next/cache";
import { requireMaintenanceStaff } from "@/lib/auth/require-maintenance-staff";
import { visitTimeToIso } from "@/lib/visitors/validation";

export type AttendanceState = { error?: string; success?: string } | undefined;

// Admin de mantenimiento: registra a mano la salida olvidada. La hora se escribe en hora de Bogotá.
export async function closeAttendance(_: AttendanceState, data: FormData): Promise<AttendanceState> {
  const { supabase } = await requireMaintenanceStaff("admin");
  const attendanceId = String(data.get("attendanceId") ?? ""), reason = String(data.get("reason") ?? "").trim();
  const checkOutAt = visitTimeToIso(String(data.get("checkOutAt") ?? ""), "America/Bogota");
  if (!/^[0-9a-f-]{36}$/i.test(attendanceId)) return { error: "Jornada inválida." };
  if (!checkOutAt) return { error: "Indica la hora de salida." };
  if (reason.length < 3 || reason.length > 300) return { error: "Escribe el motivo (entre 3 y 300 caracteres)." };
  const { error } = await supabase.rpc("maintenance_close_attendance", { target_attendance_id: attendanceId, target_check_out_at: checkOutAt, target_reason: reason });
  if (error) return { error: error.message.includes("invalid_time") ? "La hora de salida debe ser después de la llegada y no puede ser futura." : error.message.includes("not_open") ? "Esa jornada ya tiene salida." : "No pudimos registrar la salida." };
  revalidatePath("/mantenimiento/asistencia");
  return { success: "Salida registrada a mano." };
}
