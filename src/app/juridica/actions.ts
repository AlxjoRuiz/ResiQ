"use server";

import { revalidatePath } from "next/cache";
import { requireLegalStaff } from "@/lib/auth/require-legal-staff";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Marca la visita a Novedades del conjunto: lo visto deja de salir como nuevo en la próxima visita. No
// revalida, para que la página abierta conserve resaltado lo que era nuevo.
export async function markLegalPropertySeen(propertyId: string) {
  if (!uuidPattern.test(propertyId)) return;
  const { supabase } = await requireLegalStaff();
  await supabase.rpc("legal_mark_property_seen", { target_property_id: propertyId });
}

export type CollectionNoticeState = { error?: string; success?: string } | undefined;
const noticeErrors: Record<string, string> = {
  recipient_not_allowed: "Elige un correo del apartamento.",
  no_debts_selected: "Elige al menos una deuda.",
  invalid_debts: "Alguna deuda ya no tiene saldo o fue anulada. Recarga la página.",
  invalid_message: "Escribe el asunto (3 a 150 caracteres) y el mensaje (10 a 5000).",
};

// Requerimiento de pago (31/10/2026): la base de datos valida las deudas, el destinatario y la asignación,
// guarda el envío y lo pone en la cola de correos (retenido mientras ResiQ siga en modo de prueba).
export async function sendCollectionNotice(_: CollectionNoticeState, data: FormData): Promise<CollectionNoticeState> {
  const propertyId = String(data.get("propertyId") ?? ""), unitId = String(data.get("unitId") ?? "");
  const debts = data.getAll("debt").map(String).filter((id) => uuidPattern.test(id));
  const recipient = String(data.get("recipient") ?? "").trim().toLowerCase();
  const subject = String(data.get("subject") ?? "").trim(), message = String(data.get("message") ?? "").trim();
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(unitId)) return { error: "Apartamento inválido." };
  if (!debts.length) return { error: noticeErrors.no_debts_selected };
  if (!recipient) return { error: noticeErrors.recipient_not_allowed };
  if (subject.length < 3 || subject.length > 150 || message.length < 10 || message.length > 5000) return { error: noticeErrors.invalid_message };
  const { supabase } = await requireLegalStaff();
  const { error } = await supabase.rpc("legal_send_collection_notice", { target_property_id: propertyId, target_unit_id: unitId, target_receivable_ids: debts,
    target_recipient_email: recipient, target_subject: subject, target_message: message });
  if (error) return { error: Object.entries(noticeErrors).find(([code]) => error.message.includes(code))?.[1] ?? "No pudimos registrar el requerimiento." };
  revalidatePath(`/juridica/${propertyId}/${unitId}`);
  return { success: `Requerimiento registrado para ${recipient}.` };
}

// La abogada contesta en la conversación del requerimiento: queda guardado y le llega al residente por correo.
export async function postLegalMessage(_: CollectionNoticeState, data: FormData): Promise<CollectionNoticeState> {
  const noticeId = String(data.get("noticeId") ?? ""), message = String(data.get("message") ?? "").trim();
  if (!uuidPattern.test(noticeId)) return { error: "Conversación inválida." };
  if (message.length < 2 || message.length > 5000) return { error: "Escribe un mensaje de 2 a 5000 caracteres." };
  const { supabase } = await requireLegalStaff();
  const { error } = await supabase.rpc("legal_post_message", { target_notice_id: noticeId, message_body: message });
  if (error) return { error: "No pudimos enviar el mensaje." };
  revalidatePath(`/juridica/respuestas/${noticeId}`);
  revalidatePath("/juridica/respuestas");
  return { success: "Mensaje enviado." };
}
