import "server-only";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function requirePropertyMember(propertyId: string) {
  if (!uuidPattern.test(propertyId)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/panel/propiedades/${propertyId}/dashboard`)}`);

  const { data: membership } = await supabase.from("property_members")
    .select("id,roles,status")
    .eq("property_id", propertyId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) notFound();

  const { data: property } = await supabase.from("properties")
    .select("id,name,address,city,timezone,status")
    .eq("id", propertyId)
    .eq("status", "active")
    .maybeSingle();
  if (!property) notFound();

  return { supabase, user, membership, property };
}
