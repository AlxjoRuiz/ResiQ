"use server";

import { revalidatePath } from "next/cache";
import { requireMaintenanceStaff } from "@/lib/auth/require-maintenance-staff";
import { isValidDocument } from "@/lib/documents/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { COLOMBIA_TIME_ZONE, dateInputValue } from "@/lib/time-zone";

export type WarningState = { error?: string; success?: string } | undefined;

// Documentos de los llamados (13/11/2026): PDF, JPG o PNG, hasta 5 y 4 MB en total por envío, en la carpeta privada
// maintenance/warnings/<llamado>/. Se suben después de guardar el llamado; si no se pueden registrar, se borran.
const attachmentTypes: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
type Uploaded = { path: string; name: string; type: string; size: number };
async function attachFiles(supabase: Awaited<ReturnType<typeof requireMaintenanceStaff>>["supabase"], warningId: string, data: FormData): Promise<string | null> {
  const files = data.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  if (!files.length) return null;
  if (files.length > 5) return "Adjunta máximo 5 documentos por vez.";
  if (files.reduce((sum, file) => sum + file.size, 0) > 4 * 1024 * 1024) return "Los documentos pueden sumar máximo 4 MB.";
  const storage = createAdminClient().storage.from("private-documents");
  const uploaded: Uploaded[] = [];
  const cleanup = async () => { if (uploaded.length) await storage.remove(uploaded.map((file) => file.path)); };
  for (const file of files) {
    const extension = attachmentTypes[file.type];
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!extension || !file.name.trim() || file.name.length > 180 || !isValidDocument(bytes, file.type, file.size)) { await cleanup(); return "Adjunta solo documentos PDF, JPG o PNG válidos."; }
    const path = `maintenance/warnings/${warningId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await storage.upload(path, bytes, { contentType: file.type, upsert: false });
    if (error) { await cleanup(); return "No pudimos subir los documentos. Intenta de nuevo."; }
    uploaded.push({ path, name: file.name.trim(), type: file.type, size: file.size });
  }
  const { error } = await supabase.rpc("maintenance_add_warning_attachments", { target_warning_id: warningId, target_attachments: uploaded });
  if (error) { await cleanup(); return error.message.includes("too_many_attachments") ? "Un llamado puede tener máximo 10 documentos." : "No pudimos guardar los documentos."; }
  return null;
}

// Admin de mantenimiento: registra un llamado de atención (fecha, motivo y descripción).
export async function createWarning(_: WarningState, data: FormData): Promise<WarningState> {
  const { supabase } = await requireMaintenanceStaff("admin");
  const staffId = String(data.get("staffId") ?? ""), date = String(data.get("date") ?? "");
  const reason = String(data.get("reason") ?? "").trim(), description = String(data.get("description") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(staffId)) return { error: "Elige el trabajador." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > dateInputValue(new Date(), COLOMBIA_TIME_ZONE)) return { error: "La fecha no puede ser futura." };
  if (reason.length < 3 || reason.length > 120) return { error: "Escribe el motivo (entre 3 y 120 caracteres)." };
  if (description.length < 3 || description.length > 2000) return { error: "Escribe la descripción (entre 3 y 2.000 caracteres)." };
  const { data: created, error } = await supabase.rpc("maintenance_create_warning", { target_staff_id: staffId, target_date: date, target_reason: reason, target_description: description });
  if (error) return { error: error.message.includes("invalid_worker") ? "Ese trabajador ya no está en el equipo." : "No pudimos registrar el llamado de atención." };
  const fileError = await attachFiles(supabase, String(created), data);
  revalidatePath("/mantenimiento/llamados");
  if (fileError) return { error: `Se registró el llamado, pero no los documentos: ${fileError} Puedes agregarlos con «Editar».` };
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
  const fileError = await attachFiles(supabase, warningId, data);
  revalidatePath("/mantenimiento/llamados");
  if (fileError) return { error: `Se guardaron los cambios, pero no los documentos nuevos: ${fileError}` };
  return { success: "Llamado actualizado." };
}

export async function deleteWarning(_: WarningState, data: FormData): Promise<WarningState> {
  const { supabase } = await requireMaintenanceStaff("admin");
  const warningId = String(data.get("warningId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(warningId)) return { error: "Llamado no válido." };
  const { data: paths, error } = await supabase.rpc("maintenance_delete_warning", { target_warning_id: warningId });
  if (error) return { error: error.message.includes("warning_not_found") ? "Ese llamado ya no existe." : "No pudimos borrar el llamado." };
  if (Array.isArray(paths) && paths.length) await createAdminClient().storage.from("private-documents").remove(paths.map(String));
  revalidatePath("/mantenimiento/llamados");
  return { success: "Llamado borrado." };
}

// Quitar un documento de un llamado (admin).
export async function removeWarningAttachment(_: WarningState, data: FormData): Promise<WarningState> {
  const { supabase } = await requireMaintenanceStaff("admin");
  const attachmentId = String(data.get("attachmentId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(attachmentId)) return { error: "Documento no válido." };
  const { data: path, error } = await supabase.rpc("maintenance_remove_warning_attachment", { target_attachment_id: attachmentId });
  if (error) return { error: "No pudimos quitar el documento." };
  if (path) await createAdminClient().storage.from("private-documents").remove([String(path)]);
  revalidatePath("/mantenimiento/llamados");
  return { success: "Documento quitado." };
}
