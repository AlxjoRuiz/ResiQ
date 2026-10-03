"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { attentionCallCategories } from "@/lib/attention-calls/constants";
import { createClient } from "@/lib/supabase/server";

export type AttentionCallState = { error?: string; success?: string } | undefined;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const field = (data: FormData, name: string) => String(data.get(name) ?? "").trim();

function friendlyError(message?: string) {
  if (message?.includes("invalid_recipient")) return "Todos los destinatarios deben tener un vínculo vigente con el apartamento.";
  if (message?.includes("invalid_transition")) return "Ese cambio de estado no está permitido o falta la nota de cierre.";
  if (message?.includes("not_authorized")) return "No tienes permiso para realizar esta acción.";
  if (message?.includes("file_limit")) return "El llamado ya alcanzó el máximo de cinco evidencias.";
  return "No pudimos guardar el cambio. Revisa los datos e inténtalo nuevamente.";
}

export async function createAttentionCall(_: AttentionCallState, data: FormData): Promise<AttentionCallState> {
  const propertyId = field(data, "propertyId"), unitId = field(data, "unitId"), category = field(data, "category");
  const reason = field(data, "reason"), description = field(data, "description"), issuedOn = field(data, "issuedOn");
  const recipientIds = Array.from(new Set(data.getAll("recipientIds").map(String).filter((value) => uuidPattern.test(value))));
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(unitId) || !attentionCallCategories.some(([value]) => value === category)
    || reason.length < 4 || reason.length > 180 || description.length < 10 || description.length > 5000
    || !datePattern.test(issuedOn) || recipientIds.length < 1 || recipientIds.length > 20) return { error: "Completa los datos y selecciona al menos un destinatario válido." };
  const supabase = await createClient();
  const result = await supabase.rpc("create_attention_call", { target_property_id: propertyId, target_unit_id: unitId, target_category: category, target_reason: reason, target_description: description, target_issued_on: issuedOn, target_recipient_member_ids: recipientIds });
  if (result.error || !result.data) return { error: friendlyError(result.error?.message) };
  revalidatePath(`/panel/propiedades/${propertyId}/llamados`);
  redirect(`/panel/propiedades/${propertyId}/llamados/${result.data}?created=1`);
}

export async function changeAttentionCallStatus(_: AttentionCallState, data: FormData): Promise<AttentionCallState> {
  const propertyId = field(data, "propertyId"), attentionCallId = field(data, "attentionCallId"), status = field(data, "status"), note = field(data, "note");
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(attentionCallId) || !["in_review", "closed"].includes(status) || (status === "closed" && (note.length < 4 || note.length > 1000))) return { error: "Selecciona una transición válida y agrega la nota requerida." };
  const supabase = await createClient();
  const result = await supabase.rpc("change_attention_call_status", { target_attention_call_id: attentionCallId, target_status: status, target_note: note || null });
  if (result.error) return { error: friendlyError(result.error.message) };
  revalidatePath(`/panel/propiedades/${propertyId}/llamados/${attentionCallId}`);
  revalidatePath(`/panel/propiedades/${propertyId}/llamados`);
  return { success: status === "closed" ? "Llamado cerrado." : "Llamado enviado a revisión." };
}

export async function markAttentionCallRead(propertyId: string, attentionCallId: string) {
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(attentionCallId)) return;
  const supabase = await createClient();
  await supabase.rpc("mark_attention_call_read", { target_attention_call_id: attentionCallId });
}
