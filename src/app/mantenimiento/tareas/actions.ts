"use server";

import { revalidatePath } from "next/cache";
import { requireMaintenanceStaff } from "@/lib/auth/require-maintenance-staff";
import { COLOMBIA_TIME_ZONE, dateInputValue } from "@/lib/time-zone";

export type TaskState = { error?: string; success?: string } | undefined;

const uuidPattern = /^[0-9a-f-]{36}$/i;
const text = (data: FormData, name: string) => String(data.get(name) ?? "").trim();

// Admin: crea la tarea con una copia para cada trabajador elegido.
export async function createTask(_: TaskState, data: FormData): Promise<TaskState> {
  const { supabase } = await requireMaintenanceStaff("admin");
  const title = text(data, "title"), description = text(data, "description"), propertyName = text(data, "propertyName"), dueDate = text(data, "dueDate");
  const staffIds = [...new Set(data.getAll("staffIds").map(String))];
  if (title.length < 3 || title.length > 120) return { error: "Escribe un título entre 3 y 120 caracteres." };
  if (description.length < 3 || description.length > 2000) return { error: "Escribe una descripción entre 3 y 2.000 caracteres." };
  if (propertyName.length < 2 || propertyName.length > 120) return { error: "Escribe el nombre del conjunto." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || dueDate < dateInputValue(new Date(), COLOMBIA_TIME_ZONE)) return { error: "La fecha límite debe ser hoy o una fecha futura." };
  if (!staffIds.length || staffIds.some((id) => !uuidPattern.test(id))) return { error: "Elige al menos un trabajador." };
  const { data: created, error } = await supabase.rpc("maintenance_create_task", { target_title: title, target_description: description, target_property_name: propertyName, target_due_date: dueDate, target_staff_ids: staffIds });
  if (error) return { error: error.message.includes("invalid_worker") ? "Uno de los trabajadores ya no está activo." : error.message.includes("invalid_due_date") ? "La fecha límite debe ser hoy o una fecha futura." : "No pudimos crear la tarea." };
  revalidatePath("/mantenimiento/tareas");
  return { success: created === 1 ? "Tarea asignada." : `Tarea asignada a ${created} trabajadores.` };
}

// Admin: aprueba o rechaza la última entrega. El botón pulsado trae decision=approve|reject.
export async function reviewTask(_: TaskState, data: FormData): Promise<TaskState> {
  const { supabase } = await requireMaintenanceStaff("admin");
  const taskId = text(data, "taskId"), comment = text(data, "comment"), approve = text(data, "decision") === "approve";
  if (!uuidPattern.test(taskId)) return { error: "Tarea inválida." };
  if (!approve && comment.length < 3) return { error: "Para rechazar, escribe qué falta o qué se debe corregir." };
  if (comment.length > 1000) return { error: "El comentario admite máximo 1.000 caracteres." };
  const { error } = await supabase.rpc("maintenance_review_task", { target_task_id: taskId, target_approve: approve, target_comment: comment });
  if (error) return { error: error.message.includes("not_submitted") ? "Esta tarea ya fue revisada." : "No pudimos guardar la revisión." };
  revalidatePath("/mantenimiento/tareas");
  return { success: approve ? "Tarea aprobada." : "Tarea rechazada. El trabajador puede volver a entregarla." };
}

// Admin: elimina una tarea que nunca se entregó (creada por error).
export async function deleteTask(_: TaskState, data: FormData): Promise<TaskState> {
  const { supabase } = await requireMaintenanceStaff("admin");
  const taskId = text(data, "taskId");
  if (!uuidPattern.test(taskId)) return { error: "Tarea inválida." };
  const { error } = await supabase.rpc("maintenance_delete_task", { target_task_id: taskId });
  if (error) return { error: "Solo se puede eliminar una tarea que no se ha entregado." };
  revalidatePath("/mantenimiento/tareas");
  return { success: "Tarea eliminada." };
}
