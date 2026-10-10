"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppAccessStatus } from "@/lib/auth/app-access";
import { safeNext } from "@/lib/auth/safe-next";

export type AuthState = { error?: string; success?: string } | undefined;
export type InvitationState = { error?: string; invitationUrl?: string } | undefined;

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}


export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = field(formData, "email").toLowerCase();
  const password = field(formData, "password");
  const next = safeNext(field(formData, "next"));
  if (!email.includes("@") || password.length < 8) return { error: "Revisa el correo y la contraseña." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "No pudimos iniciar sesión con esos datos." };
  if (!next.startsWith("/invitacion?")) {
    const access = data.user ? await getAppAccessStatus(supabase, data.user.id) : "error";
    if (access !== "authorized") {
      await supabase.auth.signOut({ scope: "local" });
      return { error: access === "unauthorized" ? "Esta cuenta no tiene una invitación aceptada o un acceso activo a ResiQ." : "No pudimos verificar tu acceso. Intenta nuevamente." };
    }
  }
  redirect(next);
}

export async function registerWithInvitation(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = field(formData, "email").toLowerCase();
  const password = field(formData, "password");
  const displayName = field(formData, "displayName");
  const token = field(formData, "token");
  if (!token || !email.includes("@") || password.length < 8 || displayName.length < 2) {
    return { error: "Completa el nombre, un correo válido y una contraseña de mínimo 8 caracteres." };
  }

  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const next = `/invitacion?token=${encodeURIComponent(token)}`;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: "No fue posible crear la cuenta. Verifica los datos o intenta iniciar sesión." };
  if (data.session) redirect(next);
  return { success: "Revisa tu correo para confirmar la cuenta y continuar con la invitación." };
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(field(formData, "next"));
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: next.startsWith("/invitacion?") ? { prompt: "select_account" } : undefined,
    },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}

export async function updateProfile(_: AuthState, formData: FormData): Promise<AuthState> {
  const displayName = field(formData, "displayName");
  if (displayName.length < 2 || displayName.length > 80) return { error: "El nombre debe tener entre 2 y 80 caracteres." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
  if (error) return { error: "No pudimos actualizar el perfil." };
  return { success: "Perfil actualizado." };
}

export async function acceptInvitation(_: AuthState, formData: FormData): Promise<AuthState> {
  const token = field(formData, "token");
  if (!token) return { error: "La invitación no contiene un token válido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { invitation_token: token });
  if (error) return { error: "La invitación es inválida, venció o pertenece a otro correo." };
  redirect("/panel?invitation=accepted");
}

export async function createInvitation(_: InvitationState, formData: FormData): Promise<InvitationState> {
  const propertyId = field(formData, "propertyId");
  const email = field(formData, "email").toLowerCase();
  const role = field(formData, "role");
  const unitId = field(formData, "unitId") || null;
  const relationship = unitId ? field(formData, "relationship") : null;
  if (!propertyId || !email.includes("@") || !["member", "concierge"].includes(role)) return { error: "Revisa la propiedad, el correo y el rol." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invitation", {
    target_property_id: propertyId,
    target_email: email,
    target_roles: [role],
    target_unit_id: unitId,
    target_relationship: relationship,
    valid_hours: 72,
  });
  if (error || typeof data !== "string") return { error: "No pudimos crear la invitación. Verifica tus permisos y los datos." };
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  return { invitationUrl: `${origin}/invitacion?token=${encodeURIComponent(data)}` };
}
