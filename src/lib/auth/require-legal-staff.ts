import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getSessionUserId } from "@/lib/auth/session-user";
import { createClient } from "@/lib/supabase/server";

/**
 * Abogada de cobros de ResiQ (módulo jurídico, 31/10/2026). Sin sesión lleva al login; sin cuenta activa en
 * el equipo jurídico responde 404. La base de datos vuelve a validar, en cada función, que el conjunto
 * consultado esté asignado.
 */
export const requireLegalStaff = cache(async () => {
  const supabase = await createClient();
  const userId = await getSessionUserId();
  if (!userId) redirect("/login?next=/juridica");
  const { data: staff } = await supabase.from("legal_staff").select("id,status").eq("user_id", userId).eq("status", "active").maybeSingle();
  if (!staff) notFound();
  return { supabase, userId, staff: staff as { id: string; status: string } };
});
