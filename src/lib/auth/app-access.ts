import type { SupabaseClient } from "@supabase/supabase-js";

// «suspended»: todas las comunidades de la cuenta están suspendidas; «suspended_admin», además, la
// cuenta administra alguna de ellas (recibe el aviso de pago). «assistant_suspended»: la cuenta es
// un auxiliar de administración con el acceso suspendido por la administración del conjunto.
export type AppAccessStatus = "authorized" | "unauthorized" | "suspended" | "suspended_admin" | "assistant_suspended" | "concierge_suspended" | "maintenance_suspended" | "error";
type PropertyStatusRow = { property_id: string; property_status: string; roles: string[] | null };

/** A session may enter ResiQ only through an active membership in an active property, or a platform role. */
export async function getAppAccessStatus(supabase: SupabaseClient, userId: string): Promise<AppAccessStatus> {
  // Las membresías se leen con get_my_property_statuses: la política de conjunto activo oculta las
  // filas de property_members de un conjunto suspendido, y se confundía con «no invitado».
  const [platformAdmin, statuses, maintenance] = await Promise.all([
    supabase.from("platform_admins").select("id").eq("user_id", userId).eq("status", "active").limit(1),
    supabase.rpc("get_my_property_statuses"),
    // Equipo de mantenimiento de ResiQ (28/10/2026): no pertenece a ningún conjunto.
    supabase.from("maintenance_staff").select("id").eq("user_id", userId).eq("status", "active").limit(1),
  ]);
  if (platformAdmin.data?.length || maintenance?.data?.length) return "authorized";
  if (platformAdmin.error || statuses.error) return "error";
  const rows = (statuses.data ?? []) as PropertyStatusRow[];
  if (rows.some((row) => row.property_status === "active")) return "authorized";
  const suspended = rows.filter((row) => row.property_status === "suspended");
  if (suspended.length) return suspended.some((row) => (row.roles ?? []).includes("administrator")) ? "suspended_admin" : "suspended";
  const [assistant, concierge, suspendedMaintenance] = await Promise.all([
    supabase.rpc("has_suspended_assistant_access"), supabase.rpc("has_suspended_concierge_access"),
    supabase.from("maintenance_staff").select("id").eq("user_id", userId).eq("status", "suspended").limit(1),
  ]);
  if (assistant.error || concierge.error) return "error";
  if (suspendedMaintenance?.data?.length) return "maintenance_suspended";
  return assistant.data === true ? "assistant_suspended" : concierge.data === true ? "concierge_suspended" : "unauthorized";
}

// Código de error de /login para cada estado sin acceso.
export function accessErrorCode(status: AppAccessStatus) {
  return status === "unauthorized" ? "no_invitation" : status === "suspended" || status === "suspended_admin" || status === "assistant_suspended" || status === "concierge_suspended" || status === "maintenance_suspended" ? status : "access_check";
}

export const accessErrorMessages: Record<string, string> = {
  no_invitation: "No has sido invitado o aún no has aceptado tu invitación. Si recibiste un enlace, ábrelo y acéptalo con el correo invitado.",
  suspended: "No tienes acceso a ResiQ en este momento porque tu conjunto está suspendido. Comunícate con la administración de tu conjunto.",
  suspended_admin: "Por falta de pago, tu conjunto no tiene acceso a ResiQ. Comunícate con nosotros para ponerte al día y reactivar el servicio.",
  assistant_suspended: "Tu acceso como auxiliar de administración está suspendido. Comunícate con la administración de tu conjunto para reactivarlo.",
  concierge_suspended: "Tu acceso de portería está suspendido. Comunícate con la administración de tu conjunto para reactivarlo.",
  maintenance_suspended: "Tu acceso al equipo de mantenimiento está suspendido. Comunícate con el administrador de mantenimiento.",
  access_check: "No pudimos verificar tu acceso. Intenta nuevamente.",
};
