"use server";

import { revalidatePath } from "next/cache";
import { requireLegalStaff } from "@/lib/auth/require-legal-staff";
import { isValidDocument } from "@/lib/documents/validation";
import { createAdminClient } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Marca la visita a Novedades del conjunto: lo visto deja de salir como nuevo en la próxima visita. No
// revalida, para que la página abierta conserve resaltado lo que era nuevo.
export async function markLegalPropertySeen(propertyId: string) {
  if (!uuidPattern.test(propertyId)) return;
  const { supabase } = await requireLegalStaff();
  await supabase.rpc("legal_mark_property_seen", { target_property_id: propertyId });
}

export type CollectionNoticeState = { error?: string; success?: string } | undefined;

// Adjuntos de la abogada (05/11/2026): hasta 5 archivos PDF, JPG o PNG y 4 MB en total (el límite del envío).
// Se suben a la carpeta del conjunto antes de guardar el mensaje; si el mensaje no se guarda, se borran.
const attachmentTypes: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
type UploadedAttachment = { path: string; name: string; type: string; size: number };
async function uploadAttachments(propertyId: string, data: FormData): Promise<{ error?: string; files: UploadedAttachment[] }> {
  const files = data.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  if (!files.length) return { files: [] };
  if (files.length > 5) return { error: "Adjunta máximo 5 archivos.", files: [] };
  if (files.reduce((sum, file) => sum + file.size, 0) > 4 * 1024 * 1024) return { error: "Los adjuntos pueden sumar máximo 4 MB.", files: [] };
  const admin = createAdminClient();
  const uploaded: UploadedAttachment[] = [];
  for (const file of files) {
    const extension = attachmentTypes[file.type];
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!extension || !file.name.trim() || file.name.length > 180 || !isValidDocument(bytes, file.type, file.size)) {
      await removeAttachments(uploaded);
      return { error: "Adjunta solo archivos PDF, JPG o PNG válidos.", files: [] };
    }
    const path = `${propertyId}/legal/${crypto.randomUUID()}.${extension}`;
    const { error } = await admin.storage.from("private-documents").upload(path, bytes, { contentType: file.type, upsert: false });
    if (error) { await removeAttachments(uploaded); return { error: "No pudimos subir los adjuntos. Intenta de nuevo.", files: [] }; }
    uploaded.push({ path, name: file.name.trim(), type: file.type, size: file.size });
  }
  return { files: uploaded };
}
async function removeAttachments(files: UploadedAttachment[]) {
  if (files.length) await createAdminClient().storage.from("private-documents").remove(files.map((file) => file.path));
}
const noticeErrors: Record<string, string> = {
  recipient_not_allowed: "Elige un correo del apartamento.",
  no_debts_selected: "Elige al menos una deuda o una cuota del acuerdo.",
  agreement_debt_overlap: "Una deuda que está en el acuerdo de pago no se cobra junto con sus cuotas: quítala o quita las cuotas.",
  invalid_debts: "Alguna deuda o cuota ya no tiene saldo o fue anulada. Recarga la página.",
  invalid_message: "Escribe el asunto (3 a 150 caracteres) y el mensaje (10 a 5000).",
};

// Requerimiento de pago (31/10/2026): la base de datos valida las deudas, el destinatario y la asignación,
// guarda el envío y lo pone en la cola de correos (retenido mientras ResiQ siga en modo de prueba).
export async function sendCollectionNotice(_: CollectionNoticeState, data: FormData): Promise<CollectionNoticeState> {
  const propertyId = String(data.get("propertyId") ?? ""), unitId = String(data.get("unitId") ?? "");
  const debts = data.getAll("debt").map(String).filter((id) => uuidPattern.test(id));
  // Cuotas del acuerdo de pago vigente (09/11/2026): se cobran igual que las deudas.
  const installments = data.getAll("installment").map(String).filter((id) => uuidPattern.test(id));
  const recipient = String(data.get("recipient") ?? "").trim().toLowerCase();
  const subject = String(data.get("subject") ?? "").trim(), message = String(data.get("message") ?? "").trim();
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(unitId)) return { error: "Apartamento inválido." };
  if (!debts.length && !installments.length) return { error: noticeErrors.no_debts_selected };
  if (!recipient) return { error: noticeErrors.recipient_not_allowed };
  if (subject.length < 3 || subject.length > 150 || message.length < 10 || message.length > 5000) return { error: noticeErrors.invalid_message };
  const { supabase } = await requireLegalStaff();
  const attachments = await uploadAttachments(propertyId, data);
  if (attachments.error) return { error: attachments.error };
  const { error } = await supabase.rpc("legal_send_collection_notice", { target_property_id: propertyId, target_unit_id: unitId, target_receivable_ids: debts,
    target_recipient_email: recipient, target_subject: subject, target_message: message, target_attachments: attachments.files,
    // Solo se envía si hay cuotas: así el cobro de deudas sigue funcionando aunque falte la migración 20261109100000.
    ...(installments.length ? { target_installment_ids: installments } : {}) });
  if (error) { await removeAttachments(attachments.files); return { error: Object.entries(noticeErrors).find(([code]) => error.message.includes(code))?.[1] ?? "No pudimos registrar el requerimiento." }; }
  revalidatePath(`/juridica/${propertyId}/${unitId}`);
  return { success: `Requerimiento registrado para ${recipient}.` };
}

// La abogada contesta en la conversación del requerimiento: queda guardado y le llega al residente por correo.
export async function postLegalMessage(_: CollectionNoticeState, data: FormData): Promise<CollectionNoticeState> {
  const noticeId = String(data.get("noticeId") ?? ""), propertyId = String(data.get("propertyId") ?? ""), message = String(data.get("message") ?? "").trim();
  if (!uuidPattern.test(noticeId) || !uuidPattern.test(propertyId)) return { error: "Conversación inválida." };
  if (message.length < 2 || message.length > 5000) return { error: "Escribe un mensaje de 2 a 5000 caracteres." };
  const { supabase } = await requireLegalStaff();
  const attachments = await uploadAttachments(propertyId, data);
  if (attachments.error) return { error: attachments.error };
  const { error } = await supabase.rpc("legal_post_message", { target_notice_id: noticeId, message_body: message, target_attachments: attachments.files });
  if (error) { await removeAttachments(attachments.files); return { error: "No pudimos enviar el mensaje." }; }
  revalidatePath(`/juridica/respuestas/${noticeId}`);
  revalidatePath("/juridica", "layout");
  return { success: "Mensaje enviado." };
}

// Expediente prejurídico (03/11/2026): la base de datos valida permisos, estados, fechas y valores.
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const caseErrors: Record<string, string> = {
  case_closed: "El expediente está cerrado.",
  closed_reason_required: "Escribe el motivo del cierre (3 a 500 caracteres).",
  invalid_status: "Estado no válido.",
  invalid_action: "Elige el tipo de gestión y escribe un resumen (2 a 2000 caracteres).",
  invalid_date: "La fecha de la gestión no puede ser futura.",
  invalid_commitment: "Escribe el valor y la fecha del compromiso.",
};
const caseError = (message: string, fallback: string) => Object.entries(caseErrors).find(([code]) => message.includes(code))?.[1] ?? fallback;
const refreshUnit = (data: FormData) => {
  const propertyId = String(data.get("propertyId") ?? ""), unitId = String(data.get("unitId") ?? "");
  if (uuidPattern.test(propertyId) && uuidPattern.test(unitId)) { revalidatePath(`/juridica/${propertyId}/${unitId}`); revalidatePath(`/juridica/${propertyId}`); }
};

export async function openLegalCase(_: CollectionNoticeState, data: FormData): Promise<CollectionNoticeState> {
  const propertyId = String(data.get("propertyId") ?? ""), unitId = String(data.get("unitId") ?? "");
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(unitId)) return { error: "Apartamento inválido." };
  const { supabase } = await requireLegalStaff();
  const { error } = await supabase.rpc("legal_open_case", { target_property_id: propertyId, target_unit_id: unitId });
  if (error) return { error: "No pudimos abrir el expediente." };
  refreshUnit(data);
  return { success: "Expediente abierto." };
}

export async function updateLegalCase(_: CollectionNoticeState, data: FormData): Promise<CollectionNoticeState> {
  const caseId = String(data.get("caseId") ?? ""), status = String(data.get("status") ?? ""), followUp = String(data.get("nextFollowUp") ?? "").trim();
  if (!uuidPattern.test(caseId)) return { error: "Expediente inválido." };
  if (followUp && !dayPattern.test(followUp)) return { error: "Fecha de seguimiento inválida." };
  const { supabase } = await requireLegalStaff();
  const { error } = await supabase.rpc("legal_update_case", { target_case_id: caseId, target_status: status, target_next_follow_up: followUp || null, target_closed_reason: String(data.get("closedReason") ?? "") });
  if (error) return { error: caseError(error.message, "No pudimos guardar el expediente.") };
  refreshUnit(data);
  return { success: status === "closed" ? "Expediente cerrado." : "Expediente actualizado." };
}

export async function addLegalCaseAction(_: CollectionNoticeState, data: FormData): Promise<CollectionNoticeState> {
  const caseId = String(data.get("caseId") ?? ""), occurred = String(data.get("occurredOn") ?? "");
  if (!uuidPattern.test(caseId)) return { error: "Expediente inválido." };
  if (!dayPattern.test(occurred)) return { error: "Elige la fecha de la gestión." };
  const { supabase } = await requireLegalStaff();
  const { error } = await supabase.rpc("legal_add_case_action", { target_case_id: caseId, target_kind: String(data.get("kind") ?? ""), target_occurred_on: occurred, target_summary: String(data.get("summary") ?? "") });
  if (error) return { error: caseError(error.message, "No pudimos registrar la gestión.") };
  refreshUnit(data);
  return { success: "Gestión registrada." };
}

export async function addLegalCommitment(_: CollectionNoticeState, data: FormData): Promise<CollectionNoticeState> {
  const caseId = String(data.get("caseId") ?? ""), due = String(data.get("dueOn") ?? ""), amount = Number(data.get("amount"));
  if (!uuidPattern.test(caseId)) return { error: "Expediente inválido." };
  if (!(amount > 0) || !dayPattern.test(due)) return { error: caseErrors.invalid_commitment };
  const { supabase } = await requireLegalStaff();
  const { error } = await supabase.rpc("legal_add_commitment", { target_case_id: caseId, target_amount: amount, target_due_on: due, target_note: String(data.get("note") ?? "") });
  if (error) return { error: caseError(error.message, "No pudimos registrar el compromiso.") };
  refreshUnit(data);
  return { success: "Compromiso registrado." };
}

export async function setLegalCommitmentStatus(_: CollectionNoticeState, data: FormData): Promise<CollectionNoticeState> {
  const commitmentId = String(data.get("commitmentId") ?? ""), status = String(data.get("status") ?? "");
  if (!uuidPattern.test(commitmentId) || !["met", "broken"].includes(status)) return { error: "Compromiso inválido." };
  const { supabase } = await requireLegalStaff();
  const { error } = await supabase.rpc("legal_set_commitment_status", { target_commitment_id: commitmentId, target_status: status });
  if (error) return { error: caseError(error.message, "No pudimos actualizar el compromiso.") };
  refreshUnit(data);
  return { success: status === "met" ? "Compromiso cumplido." : "Compromiso incumplido." };
}
