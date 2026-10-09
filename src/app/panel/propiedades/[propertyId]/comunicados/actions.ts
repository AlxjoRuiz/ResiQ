"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePropertyAdmin } from "@/lib/auth/require-property-admin";

export type AnnouncementState = { error?: string } | undefined;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const field = (data: FormData, name: string) => String(data.get(name) ?? "").trim();

function friendlyError(message?: string) {
  if (message?.includes("not_authorized")) return "No tienes permiso para gestionar comunicados.";
  if (message?.includes("invalid_recipients")) return "Revisa los destinatarios: deben estar activos en esta comunidad.";
  if (message?.includes("invalid_transition")) return "Este comunicado ya fue publicado y no puede editarse.";
  return "No pudimos guardar el comunicado. Revisa los datos e inténtalo de nuevo.";
}

export async function saveAnnouncementDraft(_: AnnouncementState, data: FormData): Promise<AnnouncementState> {
  const propertyId = field(data, "propertyId");
  const announcementId = field(data, "announcementId");
  const subject = field(data, "subject");
  const body = field(data, "body");
  const recipients = data.getAll("recipientIds").map((value) => String(value));
  if (!uuidPattern.test(propertyId) || (announcementId && !uuidPattern.test(announcementId)) ||
      subject.length < 5 || subject.length > 160 || body.length < 10 || body.length > 4000 ||
      recipients.length < 1 || recipients.length > 100 || new Set(recipients).size !== recipients.length ||
      recipients.some((id) => !uuidPattern.test(id))) return { error: "Completa el asunto, el mensaje y entre 1 y 100 destinatarios válidos." };
  const { supabase } = await requirePropertyAdmin(propertyId);
  const { data: savedId, error } = await supabase.rpc("save_announcement_draft", {
    target_property_id: propertyId,
    target_announcement_id: announcementId || null,
    target_subject: subject,
    target_body: body,
    target_recipient_ids: recipients,
  });
  if (error || !savedId) return { error: friendlyError(error?.message) };
  revalidatePath(`/panel/propiedades/${propertyId}/comunicados`);
  redirect(`/panel/propiedades/${propertyId}/comunicados/${savedId}`);
}

export async function publishAnnouncement(_: AnnouncementState, data: FormData): Promise<AnnouncementState> {
  const propertyId = field(data, "propertyId");
  const announcementId = field(data, "announcementId");
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(announcementId)) return { error: "Comunicado inválido." };
  const { supabase } = await requirePropertyAdmin(propertyId);
  const { error } = await supabase.rpc("publish_announcement", { target_announcement_id: announcementId });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath(`/panel/propiedades/${propertyId}/comunicados`);
  revalidatePath(`/panel/propiedades/${propertyId}/comunicados/${announcementId}`);
  revalidatePath(`/panel/propiedades/${propertyId}/notificaciones`);
  redirect(`/panel/propiedades/${propertyId}/comunicados/${announcementId}?published=1`);
}
