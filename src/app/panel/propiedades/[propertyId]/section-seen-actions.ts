"use server";

import { createClient } from "@/lib/supabase/server";

const sections = new Set(["cartera", "pqrs", "paquetes", "visitas", "reservas", "llamados", "asambleas", "comunicados", "notificaciones"]);

// Guarda que la cuenta abrió una sección, para quitar su punto en la barra lateral.
export async function markSectionSeen(propertyId: string, section: string) {
  if (!/^[0-9a-f-]{36}$/i.test(propertyId) || !sections.has(section)) return;
  const supabase = await createClient();
  await supabase.rpc("mark_section_seen", { target_property_id: propertyId, target_section: section });
}
