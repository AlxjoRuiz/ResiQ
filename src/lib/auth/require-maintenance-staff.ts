import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getSessionUserId } from "@/lib/auth/session-user";
import { createClient } from "@/lib/supabase/server";

export type MaintenanceRole = "admin" | "worker";

/**
 * Cuenta del equipo de mantenimiento de ResiQ (28/10/2026). Sin sesión lleva al login; sin rol activo
 * en el equipo responde 404. Con `role`, exige ese rol (admin de mantenimiento o trabajador).
 * La base de datos vuelve a validar el rol en cada función del módulo.
 */
export const requireMaintenanceStaff = cache(async (role?: MaintenanceRole) => {
  const supabase = await createClient();
  const userId = await getSessionUserId();
  if (!userId) redirect("/login?next=/mantenimiento");
  const { data: staff } = await supabase.from("maintenance_staff").select("id,role,status").eq("user_id", userId).eq("status", "active").maybeSingle();
  if (!staff || (role && staff.role !== role)) notFound();
  return { supabase, userId, staff: staff as { id: string; role: MaintenanceRole; status: string } };
});
