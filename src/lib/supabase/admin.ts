import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnvironment } from "./env";

/** Never accept this key or the actor identity from a request payload. */
export function createAdminClient() {
  const { url } = getSupabaseEnvironment();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key?.startsWith("sb_secret_")) throw new Error("Private Supabase server configuration is missing.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
