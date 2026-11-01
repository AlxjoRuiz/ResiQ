"use server";

import { createClient } from "@/lib/supabase/server";

const sections = new Set(["cartera", "pqrs", "paquetes", "visitas", "reservas", "llamados", "asambleas", "comunicados", "notificaciones"]);

// Guarda que la cuenta abrió una sección, para quitar su punto en la barra lateral.
export async function markSectionSeen(propertyId: string, section: string) {
  if (!/^[0-9a-f-]{36}$/i.test(propertyId) || !sections.has(section)) return;
  const supabase = await createClient();
  await supabase.rpc("mark_section_seen", { target_property_id: propertyId, target_section: section });
}

// Secciones con algo nuevo o pendiente (01/11/2026): la barra las vuelve a pedir al cambiar de sección o al
// volver a la pestaña, para que el punto rojo (p. ej. comprobantes sin registrar) no espere a recargar.
export async function getUnseenSections(propertyId: string): Promise<string[] | null> {
  if (!/^[0-9a-f-]{36}$/i.test(propertyId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_unseen_sections", { target_property_id: propertyId });
  return error || !Array.isArray(data) ? null : data.map(String);
}
