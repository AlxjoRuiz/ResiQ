import "server-only";

import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

// Pruebas ResiQ (31/10/2026): qué es de prueba, para mostrarlo solo en esa sección. Conjuntos marcados
// como de prueba (con toda su gente) y correos del personal de ResiQ marcados como de prueba; los
// @resiq.invalid cuentan siempre como de prueba.
export async function loadTestScope(supabase: Client) {
  const [{ data: propertyData, error: propertyError }, { data: emailData, error: emailError }] = await Promise.all([
    supabase.rpc("platform_test_property_ids"), supabase.rpc("platform_list_test_emails"),
  ]);
  if (propertyError || emailError) throw new Error("No se pudo cargar lo marcado como de prueba.");
  const propertyIds = new Set((propertyData ?? []) as string[]);
  const emails = (emailData ?? []) as string[];
  const emailSet = new Set(emails);
  return {
    emails,
    isTestProperty: (propertyId: string) => propertyIds.has(propertyId),
    isTestEmail: (email: string) => { const normalized = email.trim().toLowerCase(); return emailSet.has(normalized) || normalized.endsWith("@resiq.invalid"); },
  };
}
