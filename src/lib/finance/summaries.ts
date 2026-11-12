import type { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

// Cartera de todos los apartamentos visibles (13/11/2026). Primero con finance_account_summaries_json, que hace el
// cálculo una sola vez y lo devuelve en un solo valor; si esa función todavía no existe (migración sin aplicar), se
// pide como antes, de 1.000 en 1.000.
export async function loadAccountSummaries<T>(supabase: Awaited<ReturnType<typeof createClient>>, propertyId: string): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const quick = await supabase.rpc("finance_account_summaries_json", { target_property_id: propertyId });
  if (!quick.error) return { data: (Array.isArray(quick.data) ? quick.data : []) as T[], error: null };
  return fetchAllRows<T>((from, to) => supabase.rpc("list_finance_account_summaries", { target_property_id: propertyId }).range(from, to));
}
