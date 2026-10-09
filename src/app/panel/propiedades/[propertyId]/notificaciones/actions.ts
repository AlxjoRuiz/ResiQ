"use server";

import { revalidatePath } from "next/cache";
import { requirePropertyMember } from "@/lib/auth/require-property-member";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function markNotificationRead(propertyId: string, notificationId: string) {
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(notificationId)) return;
  const { supabase, membership } = await requirePropertyMember(propertyId);
  const { error } = await supabase.from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("property_id", propertyId)
    .eq("recipient_member_id", membership.id)
    .is("read_at", null);
  if (error) throw new Error("No se pudo marcar el aviso como leído.");
  revalidatePath(`/panel/propiedades/${propertyId}/notificaciones`);
  revalidatePath(`/panel/propiedades/${propertyId}/notificaciones/${notificationId}`);
  revalidatePath(`/panel/propiedades/${propertyId}/dashboard`);
}
