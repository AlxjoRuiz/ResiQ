"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";

export type CreatePropertyState = { error?: string; success?: string; link?: string } | undefined;
const field = (data: FormData, name: string) => String(data.get(name) ?? "").trim();

// Superadmin: crea el conjunto y devuelve el enlace de invitación de su administrador inicial.
export async function createPlatformProperty(_: CreatePropertyState, data: FormData): Promise<CreatePropertyState> {
  const name = field(data, "name"), address = field(data, "address"), city = field(data, "city"), email = field(data, "adminEmail").toLowerCase();
  if (name.length < 2 || name.length > 120) return { error: "Escribe el nombre del conjunto (entre 2 y 120 caracteres)." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Escribe un correo válido para el administrador." };
  const { supabase } = await requirePlatformAdmin();
  const { data: result, error } = await supabase.rpc("platform_create_property", { target_name: name, target_address: address, target_city: city, target_admin_email: email });
  if (error) {
    if (error.message.includes("not_authorized")) return { error: "Solo el superadmin puede crear conjuntos." };
    if (error.message.includes("invalid_email")) return { error: "Escribe un correo válido para el administrador." };
    return { error: "No pudimos crear el conjunto. Revisa los datos e inténtalo nuevamente." };
  }
  const token = (result as { token?: string } | null)?.token;
  if (!token) return { error: "El conjunto se creó, pero no pudimos generar el enlace." };
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  revalidatePath("/plataforma", "layout");
  revalidatePath("/panel");
  return { success: `Conjunto «${name}» creado. Comparte este enlace con el administrador; debe entrar con ${email}. Vence en 7 días.`, link: `${origin}/invitacion?token=${encodeURIComponent(token)}` };
}

export type PlatformState = { error?: string; success?: string } | undefined;

// Configuración: prende o apaga la decoración de Navidad para todos.
export async function setSeasonalDecor(_: PlatformState, data: FormData): Promise<PlatformState> {
  const enabled = field(data, "enabled") === "true";
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc("platform_set_seasonal_decor", { target_enabled: enabled });
  if (error) return { error: "No pudimos guardar el cambio." };
  revalidatePath("/", "layout");
  return { success: enabled ? "Decoración activada para todos." : "Decoración apagada para todos." };
}

// Configuración: tema de la decoración (Navidad o Halloween).
export async function setSeasonalTheme(_: PlatformState, data: FormData): Promise<PlatformState> {
  const theme = field(data, "theme");
  if (!["christmas", "halloween"].includes(theme)) return { error: "Tema inválido." };
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc("platform_set_seasonal_theme", { target_theme: theme });
  if (error) return { error: "No pudimos guardar el tema." };
  revalidatePath("/", "layout");
  return { success: theme === "halloween" ? "Tema de Halloween elegido." : "Tema de Navidad elegido." };
}

// Administradores: invitar otro admin a un conjunto o generar de nuevo un enlace de invitación.
export async function inviteAdministrator(_: CreatePropertyState, data: FormData): Promise<CreatePropertyState> {
  const propertyId = field(data, "propertyId"), email = field(data, "adminEmail").toLowerCase();
  if (!/^[0-9a-f-]{36}$/i.test(propertyId)) return { error: "Conjunto inválido." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Escribe un correo válido." };
  const { supabase } = await requirePlatformAdmin();
  const { data: token, error } = await supabase.rpc("platform_invite_administrator", { target_property_id: propertyId, target_email: email });
  if (error || typeof token !== "string") {
    if (error?.message.includes("already_member")) return { error: "Ese correo ya tiene acceso a este conjunto." };
    if (error?.message.includes("property_inactive")) return { error: "Reactiva el conjunto antes de invitar administradores." };
    return { error: "No pudimos crear la invitación." };
  }
  revalidatePath("/plataforma", "layout");
  return { success: `Invitación creada. Comparte el enlace; debe entrar con ${email}. Vence en 7 días.`, link: await invitationLink(token) };
}

export async function reissueAdminInvitation(_: CreatePropertyState, data: FormData): Promise<CreatePropertyState> {
  const invitationId = field(data, "invitationId");
  if (!/^[0-9a-f-]{36}$/i.test(invitationId)) return { error: "Invitación inválida." };
  const { supabase } = await requirePlatformAdmin();
  const { data: token, error } = await supabase.rpc("platform_reissue_admin_invitation", { target_invitation_id: invitationId });
  if (error || typeof token !== "string") return { error: error?.message.includes("property_inactive") ? "Reactiva el conjunto antes de generar el enlace." : "No pudimos generar el enlace." };
  revalidatePath("/plataforma", "layout");
  return { success: "Enlace nuevo generado; el anterior dejó de servir. Vence en 7 días.", link: await invitationLink(token) };
}

// Equipo de mantenimiento de ResiQ (28/10/2026): el superadmin invita al admin de mantenimiento.
export async function inviteMaintenanceAdmin(_: CreatePropertyState, data: FormData): Promise<CreatePropertyState> {
  const email = field(data, "adminEmail").toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Escribe un correo válido." };
  const { supabase } = await requirePlatformAdmin();
  const { data: token, error } = await supabase.rpc("platform_invite_maintenance_admin", { target_email: email });
  if (error || typeof token !== "string") return { error: error?.message.includes("already_member") ? "Ese correo ya es parte del equipo de mantenimiento." : "No pudimos crear la invitación." };
  revalidatePath("/plataforma", "layout");
  return { success: `Invitación creada. Comparte el enlace; debe entrar con ${email}. Vence en 7 días.`, link: await invitationLink(token) };
}

export async function reissueMaintenanceInvitation(_: CreatePropertyState, data: FormData): Promise<CreatePropertyState> {
  const invitationId = field(data, "invitationId");
  if (!/^[0-9a-f-]{36}$/i.test(invitationId)) return { error: "Invitación inválida." };
  const { supabase } = await requirePlatformAdmin();
  const { data: token, error } = await supabase.rpc("platform_reissue_maintenance_invitation", { target_invitation_id: invitationId });
  if (error || typeof token !== "string") return { error: "No pudimos generar el enlace." };
  revalidatePath("/plataforma", "layout");
  return { success: "Enlace nuevo generado; el anterior dejó de servir. Vence en 7 días.", link: await invitationLink(token) };
}

async function invitationLink(token: string) {
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  return `${origin}/invitacion?token=${encodeURIComponent(token)}`;
}

// Propiedades: suspender o reactivar un conjunto (no borra datos).
export async function setPropertyStatus(_: PlatformState, data: FormData): Promise<PlatformState> {
  const propertyId = field(data, "propertyId"), status = field(data, "status");
  if (!/^[0-9a-f-]{36}$/i.test(propertyId) || !["active", "suspended"].includes(status)) return { error: "Datos inválidos." };
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc("platform_set_property_status", { target_property_id: propertyId, target_status: status });
  if (error) return { error: "No pudimos cambiar el estado del conjunto." };
  revalidatePath("/", "layout");
  return { success: status === "suspended" ? "Conjunto suspendido." : "Conjunto reactivado." };
}

// Módulo jurídico (31/10/2026): el superadmin invita a la abogada de cobros con un enlace a su correo.
export async function inviteLegal(_: CreatePropertyState, data: FormData): Promise<CreatePropertyState> {
  const email = field(data, "email").toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Escribe un correo válido." };
  const { supabase } = await requirePlatformAdmin();
  const { data: token, error } = await supabase.rpc("platform_invite_legal", { target_email: email });
  if (error || typeof token !== "string") return { error: error?.message.includes("already_member") ? "Ese correo ya tiene acceso al módulo jurídico." : "No pudimos crear la invitación." };
  revalidatePath("/plataforma", "layout");
  return { success: `Invitación creada. Comparte el enlace; debe entrar con ${email}. Vence en 7 días.`, link: await invitationLink(token) };
}

export async function reissueLegalInvitation(_: CreatePropertyState, data: FormData): Promise<CreatePropertyState> {
  const invitationId = field(data, "invitationId");
  if (!/^[0-9a-f-]{36}$/i.test(invitationId)) return { error: "Invitación inválida." };
  const { supabase } = await requirePlatformAdmin();
  const { data: token, error } = await supabase.rpc("platform_reissue_legal_invitation", { target_invitation_id: invitationId });
  if (error || typeof token !== "string") return { error: "No pudimos generar el enlace." };
  revalidatePath("/plataforma", "layout");
  return { success: "Enlace nuevo generado; el anterior dejó de servir. Vence en 7 días.", link: await invitationLink(token) };
}

// Asignar o quitar un conjunto a jurídica, con su umbral de mora en días (queda en auditoría).
export async function setLegalAssignment(_: PlatformState, data: FormData): Promise<PlatformState> {
  const propertyId = field(data, "propertyId"), assigned = data.get("assigned") === "on", days = Number(field(data, "overdueDays"));
  if (!/^[0-9a-f-]{36}$/i.test(propertyId)) return { error: "Conjunto inválido." };
  if (assigned && (!Number.isInteger(days) || days < 1 || days > 3650)) return { error: "El umbral debe ser un número de días entre 1 y 3650." };
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc("platform_set_legal_assignment", { target_property_id: propertyId, target_assigned: assigned, target_overdue_days: assigned ? days : null });
  if (error) return { error: "No pudimos guardar la asignación." };
  revalidatePath("/plataforma", "layout");
  revalidatePath("/juridica", "layout");
  return { success: assigned ? `Asignado a jurídica con umbral de ${days} días.` : "Ya no está asignado a jurídica." };
}

// Pruebas ResiQ (31/10/2026): marcar un conjunto como de prueba o devolverlo a producción.
export async function setPropertyTest(_: PlatformState, data: FormData): Promise<PlatformState> {
  const propertyId = field(data, "propertyId"), isTest = field(data, "isTest") === "true";
  if (!/^[0-9a-f-]{36}$/i.test(propertyId)) return { error: "Conjunto inválido." };
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc("platform_set_property_test", { target_property_id: propertyId, target_is_test: isTest });
  if (error) return { error: "No pudimos cambiar el conjunto." };
  revalidatePath("/plataforma", "layout");
  return { success: isTest ? "Ahora está en Pruebas ResiQ." : "Ahora está en producción." };
}

// Pruebas ResiQ: marcar o desmarcar un correo del personal de ResiQ (mantenimiento o jurídica) como de prueba.
export async function setTestEmail(_: PlatformState, data: FormData): Promise<PlatformState> {
  const email = field(data, "email").toLowerCase(), isTest = field(data, "isTest") !== "false";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) return { error: "Escribe un correo válido." };
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc("platform_set_test_email", { target_email: email, target_is_test: isTest });
  if (error) return { error: "No pudimos guardar el correo." };
  revalidatePath("/plataforma", "layout");
  return { success: isTest ? "Correo marcado como de prueba." : "Correo devuelto a producción." };
}
