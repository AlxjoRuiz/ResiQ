import type { SupabaseClient } from "@supabase/supabase-js";

// «suspended»: todas las comunidades de la cuenta están suspendidas; «suspended_admin», además, la
// cuenta administra alguna de ellas (recibe el aviso de pago).
export type AppAccessStatus = "authorized" | "unauthorized" | "suspended" | "suspended_admin" | "error";
type PropertyStatusRow = { property_id: string; property_status: string; roles: string[] | null };

/** A session may enter ResiQ only through an active membership in an active property, or a platform role. */
export async function getAppAccessStatus(supabase: SupabaseClient, userId: string): Promise<AppAccessStatus> {
  // Las membresías se leen con get_my_property_statuses: la política de conjunto activo oculta las
  // filas de property_members de un conjunto suspendido, y se confundía con «no invitado».
  const [platformAdmin, statuses] = await Promise.all([
    supabase.from("platform_admins").select("id").eq("user_id", userId).eq("status", "active").limit(1),
    supabase.rpc("get_my_property_statuses"),
  ]);
  if (platformAdmin.data?.length) return "authorized";
  if (platformAdmin.error || statuses.error) return "error";
  const rows = (statuses.data ?? []) as PropertyStatusRow[];
  if (rows.some((row) => row.property_status === "active")) return "authorized";
  const suspended = rows.filter((row) => row.property_status === "suspended");
  if (suspended.length) return suspended.some((row) => (row.roles ?? []).includes("administrator")) ? "suspended_admin" : "suspended";
  return "unauthorized";
}

// Código de error de /login para cada estado sin acceso.
export function accessErrorCode(status: AppAccessStatus) {
  return status === "unauthorized" ? "no_invitation" : status === "suspended" || status === "suspended_admin" ? status : "access_check";
}

export const accessErrorMessages: Record<string, string> = {
  no_invitation: "No has sido invitado o aún no has aceptado tu invitación. Si recibiste un enlace, ábrelo y acéptalo con el correo invitado.",
  suspended: "No tienes acceso a ResiQ en este momento porque tu conjunto está suspendido. Comunícate con la administración de tu conjunto.",
  suspended_admin: "Por falta de pago, tu conjunto no tiene acceso a ResiQ. Comunícate con nosotros para ponerte al día y reactivar el servicio.",
  access_check: "No pudimos verificar tu acceso. Intenta nuevamente.",
};
