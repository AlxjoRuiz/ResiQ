import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Cuenta de la sesión, verificada una sola vez por solicitud (28/10/2026, prueba de carga). getClaims
 * valida la firma del token con las llaves públicas de Supabase, guardadas en memoria, sin llamar al
 * servidor de Auth en cada visita (si el proyecto usa llaves simétricas, Supabase consulta el servidor).
 */
export const getSessionUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return !error && typeof sub === "string" ? sub : null;
});
