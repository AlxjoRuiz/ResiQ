import "server-only";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requirePlatformAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/plataforma");

  const { data: platformAdmin } = await supabase.from("platform_admins")
    .select("id,status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!platformAdmin) notFound();

  return { supabase, user, platformAdmin };
}
