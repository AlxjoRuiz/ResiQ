import type { SupabaseClient } from "@supabase/supabase-js";

export type AppAccessStatus = "authorized" | "unauthorized" | "error";

/** A session may enter ResiQ only through an active property membership or platform role. */
export async function getAppAccessStatus(supabase: SupabaseClient, userId: string): Promise<AppAccessStatus> {
  const [membership, platformAdmin] = await Promise.all([
    supabase.from("property_members").select("id").eq("user_id", userId).eq("status", "active").limit(1),
    supabase.from("platform_admins").select("id").eq("user_id", userId).eq("status", "active").limit(1),
  ]);
  if (membership.data?.length || platformAdmin.data?.length) return "authorized";
  if (membership.error || platformAdmin.error) return "error";
  return "unauthorized";
}
