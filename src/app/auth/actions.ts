"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppAccessStatus } from "@/lib/auth/app-access";
import { safeNext } from "@/lib/auth/safe-next";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuthFailure } from "@/lib/auth/log-auth-failure";

export type AuthState = { error?: string; success?: string } | undefined;
export type InvitationState = { error?: string; invitationUrl?: string } | undefined;

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}


export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  const identifier = (field(formData, "identifier") || field(formData, "email")).toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(field(formData, "next"));
  if (password.length < 8 || (!identifier.includes("@") && !/^[a-z0-9]+$/u.test(identifier))) return { error: "Revisa el usuario o correo y la contraseña." };

  let email = identifier;
  let conciergeUserId: string | null = null;
  if (!identifier.includes("@")) {
    const { data: account, error: lookupError } = await createAdminClient().from("concierge_accounts")
      .select("user_id,email_normalized,status").eq("username", identifier).maybeSingle();
    if (lookupError || !account || account.status !== "active") {
      logAuthFailure("concierge_lookup", { method: "username", reason: lookupError ? "lookup_error" : !account ? "unknown_username" : `account_${account.status}` });
      return { error: "No pudimos iniciar sesión con esos datos." };
    }
    email = account.email_normalized;
    conciergeUserId = account.user_id;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  const method = conciergeUserId ? "username" : "email";
  if (error) {
    logAuthFailure("password", { method, reason: error.code ?? error.name, status: error.status });
    return { error: "No pudimos iniciar sesión con esos datos." };
  }
  if (conciergeUserId && data.user?.id !== conciergeUserId) {
    logAuthFailure("concierge_mismatch", { method });
    await supabase.auth.signOut({ scope: "local" });
    return { error: "No pudimos iniciar sesión con esos datos." };
  }
  if (!next.startsWith("/invitacion?")) {
    const access = data.user ? await getAppAccessStatus(supabase, data.user.id) : "error";
    if (access !== "authorized") {
      logAuthFailure("access", { method, reason: access });
      await supabase.auth.signOut({ scope: "local" });
      return { error: access === "unauthorized" ? "No has sido invitado o aún no has aceptado tu invitación. Si recibiste un enlace, ábrelo y acéptalo con el correo invitado." : "No pudimos verificar tu acceso. Intenta nuevamente." };
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
  // Mensajes según la causa, sin confirmar si un correo ya tiene cuenta (evita enumerar usuarios).
  const existingAccount = "Si ya tienes una cuenta con este correo, usa «Iniciar sesión» o «Continuar con Google» y luego acepta la invitación.";
  if (error) {
    logAuthFailure("signup", { method: "email", reason: error.code ?? error.name, status: error.status });
    if (error.code === "user_already_exists" || error.code === "email_exists") return { error: existingAccount };
    if (error.code === "weak_password") return { error: "La contraseña es muy débil. Usa al menos 8 caracteres combinando letras y números." };
    if (error.code === "over_email_send_rate_limit" || error.code === "email_address_not_authorized" || error.code === "signup_disabled" || error.code === "email_provider_disabled") {
      return { error: "Por ahora no podemos crear cuentas con contraseña. Usa «Continuar con Google» con el correo invitado." };
    }
    return { error: "No fue posible crear la cuenta. Verifica los datos o usa «Continuar con Google»." };
  }
  // Supabase responde sin identidades cuando el correo ya estaba registrado.
  if (data.user && !data.user.identities?.length) return { error: existingAccount };
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
  if (await getAppAccessStatus(supabase, user.id) !== "authorized") return { error: "Tu acceso a ResiQ ya no está activo." };
  const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
  if (error) return { error: "No pudimos actualizar el perfil." };
  return { success: "Perfil actualizado." };
}

export async function acceptInvitation(_: AuthState, formData: FormData): Promise<AuthState> {
  const token = field(formData, "token");
  if (!token) return { error: "La invitación no contiene un token válido." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Inicia sesión con el correo invitado para continuar." };
  const { error } = await supabase.rpc("accept_invitation", { invitation_token: token });
  if (error) return { error: "La invitación es inválida, venció o pertenece a otro correo." };
  redirect(user.identities?.some((identity) => identity.provider === "google") && !user.identities.some((identity) => identity.provider === "email") ? "/invitacion/contrasena" : "/panel?invitation=accepted");
}

export async function createInvitedPassword(_: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (password !== confirmation) return { error: "Las contraseñas no coinciden." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (await getAppAccessStatus(supabase, user.id) !== "authorized" || !user.identities?.some((identity) => identity.provider === "google") || user.identities.some((identity) => identity.provider === "email")) {
    return { error: "No pudimos verificar tu invitación. Vuelve a abrir el enlace recibido." };
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "No pudimos guardar la contraseña. Intenta nuevamente." };
  redirect("/panel?invitation=accepted");
}

export async function setAccountPassword(_: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (password !== confirmation) return { error: "Las contraseñas no coinciden." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (await getAppAccessStatus(supabase, user.id) !== "authorized") return { error: "No pudimos verificar tu acceso." };
  if (!user.identities?.some((identity) => identity.provider === "google")) return { error: "Esta opción requiere una cuenta vinculada a Google." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "No pudimos guardar la contraseña. Intenta nuevamente." };
  return { success: "Contraseña guardada. Ya puedes entrar con tu correo y contraseña." };
}

export async function requestPasswordReset(_: AuthState, formData: FormData): Promise<AuthState> {
  if (process.env.PASSWORD_RECOVERY_ENABLED !== "true") return { error: "La recuperación por correo aún no está disponible." };
  const email = field(formData, "email").toLowerCase();
  if (!email.includes("@") || email.length > 254) return { error: "Escribe un correo válido." };
  const origin = (await headers()).get("origin");
  if (!origin) return { error: "No pudimos procesar la solicitud. Intenta nuevamente." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirmar-recuperacion`,
  });
  if (error) return { error: "No pudimos enviar el enlace en este momento. Intenta más tarde." };
  return { success: "Si ese correo tiene una cuenta, recibirás un enlace para crear una nueva contraseña." };
}

export async function confirmPasswordRecovery(formData: FormData) {
  if (process.env.PASSWORD_RECOVERY_ENABLED !== "true") redirect("/login?error=callback");
  const tokenHash = field(formData, "token_hash");
  if (!tokenHash) redirect("/recuperar-contrasena?error=link");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
  if (error || !data.user) redirect("/recuperar-contrasena?error=link");
  if (await getAppAccessStatus(supabase, data.user.id) !== "authorized") {
    await supabase.auth.signOut({ scope: "local" });
    redirect("/login?error=no_invitation");
  }
  redirect("/restablecer-contrasena");
}

export async function completePasswordReset(_: AuthState, formData: FormData): Promise<AuthState> {
  if (process.env.PASSWORD_RECOVERY_ENABLED !== "true") return { error: "La recuperación por correo aún no está disponible." };
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (password !== confirmation) return { error: "Las contraseñas no coinciden." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "El enlace venció o no es válido. Solicita uno nuevo." };
  if (await getAppAccessStatus(supabase, user.id) !== "authorized") return { error: "No pudimos verificar tu acceso." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "No pudimos guardar la contraseña. Solicita otro enlace e intenta nuevamente." };
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?reset=success");
}

export async function createInvitation(_: InvitationState, formData: FormData): Promise<InvitationState> {
  const propertyId = field(formData, "propertyId");
  const email = field(formData, "email").toLowerCase();
  const role = field(formData, "role");
  const buildingId = field(formData, "buildingId");
  const unitId = field(formData, "unitId");
  const relationship = field(formData, "relationship");
  if (!propertyId || !email.includes("@") || role !== "member") return { error: "Esta invitación es solo para residentes. Registra porteros desde Propiedad." };
  if (!buildingId || !unitId || !["owner", "resident"].includes(relationship)) return { error: "Selecciona torre, apartamento y tipo de residente." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_resident_invitation", { target_property_id: propertyId, target_building_id: buildingId, target_unit_id: unitId, target_email: email, target_relationship: relationship });
  if (error || typeof data !== "string") {
    if (error?.message.includes("already_assigned")) return { error: "Ese residente ya está vinculado a este apartamento." };
    if (error?.message.includes("not_a_resident")) return { error: "Ese correo tiene otro rol en esta propiedad. Revisa su acceso antes de invitarlo como residente." };
    return { error: "No pudimos crear la invitación. Comprueba que la torre y el apartamento sigan activos y pertenezcan a esta propiedad." };
  }
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  return { invitationUrl: `${origin}/invitacion?token=${encodeURIComponent(data)}` };
}
