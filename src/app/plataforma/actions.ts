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
