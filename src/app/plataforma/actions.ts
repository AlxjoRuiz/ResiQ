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
  return { success: enabled ? "Decoración de Navidad activada para todos." : "Decoración de Navidad apagada para todos." };
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
