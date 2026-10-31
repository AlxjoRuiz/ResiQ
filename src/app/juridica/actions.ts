"use server";

import { requireLegalStaff } from "@/lib/auth/require-legal-staff";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Marca la visita a Novedades del conjunto: lo visto deja de salir como nuevo en la próxima visita. No
// revalida, para que la página abierta conserve resaltado lo que era nuevo.
export async function markLegalPropertySeen(propertyId: string) {
  if (!uuidPattern.test(propertyId)) return;
  const { supabase } = await requireLegalStaff();
  await supabase.rpc("legal_mark_property_seen", { target_property_id: propertyId });
}
