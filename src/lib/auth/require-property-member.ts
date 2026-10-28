import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getSessionUserId } from "@/lib/auth/session-user";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Una sola verificación por solicitud aunque el marco y la página la pidan (cache de React).
export const requirePropertyMember = cache(async (propertyId: string) => {
  if (!uuidPattern.test(propertyId)) notFound();
  const supabase = await createClient();
  const userId = await getSessionUserId();
  const user = userId ? { id: userId } : null;
  if (!user) redirect(`/login?next=${encodeURIComponent(`/panel/propiedades/${propertyId}/dashboard`)}`);

  // Membresía y conjunto en paralelo: una ida a la base de datos en vez de dos.
  const [{ data: membership }, { data: property }] = await Promise.all([
    supabase.from("property_members").select("id,roles,status").eq("property_id", propertyId).eq("user_id", user.id).eq("status", "active").maybeSingle(),
    supabase.from("properties").select("id,name,address,city,timezone,status").eq("id", propertyId).eq("status", "active").maybeSingle(),
  ]);
  if (!membership || !property) notFound();

  return { supabase, user, membership, property };
});
