"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { accessErrorCode, accessErrorMessages, getAppAccessStatus } from "@/lib/auth/app-access";
import { safeNext } from "@/lib/auth/safe-next";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuthFailure } from "@/lib/auth/log-auth-failure";

export type AuthState = { error?: string; success?: string } | undefined;

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
    // El usuario puede ser de un portero o de un auxiliar de administración (27/10/2026). Un
    // auxiliar suspendido sí intenta entrar, para que vea su propio aviso después de la contraseña.
    const admin = createAdminClient();
    const [{ data: account, error: lookupError }, { data: assistant, error: assistantError }, { data: worker, error: workerError }] = await Promise.all([
      admin.from("concierge_accounts").select("user_id,email_normalized,status").eq("username", identifier).maybeSingle(),
      admin.from("admin_assistant_records").select("user_id,email_normalized").eq("username", identifier).is("removed_at", null).maybeSingle(),
      // Trabajadores de mantenimiento (28/10/2026).
      admin.from("maintenance_worker_records").select("user_id,email_normalized").eq("username", identifier).is("removed_at", null).maybeSingle(),
    ]);
    const named = assistant ?? worker;
    if (lookupError || assistantError || workerError || (!named && (!account || account.status !== "active"))) {
      logAuthFailure("concierge_lookup", { method: "username", reason: lookupError || assistantError || workerError ? "lookup_error" : !account ? "unknown_username" : `account_${account.status}` });
      return { error: "No pudimos iniciar sesión con esos datos." };
    }
    email = named?.email_normalized ?? account!.email_normalized;
    conciergeUserId = named?.user_id ?? account!.user_id;
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
      return { error: accessErrorMessages[accessErrorCode(access)] };
    }
  }
  redirect(next);
}

// Registro con invitación al instante (04/11/2026): con nombre, el correo invitado y una contraseña se crea la
// cuenta ya confirmada, se inicia sesión y se acepta la invitación en el mismo paso, sin ir al correo. Solo se
// acepta el correo al que se envió la invitación. Si ese correo se registró antes y nunca confirmó, se completa
// esa cuenta. Si ya tiene una cuenta confirmada, debe iniciar sesión con ella.
export async function registerWithInvitation(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = field(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const displayName = field(formData, "displayName");
  const token = field(formData, "token");
  if (!token || !email.includes("@") || password.length < 8 || displayName.length < 2 || displayName.length > 80) {
    return { error: "Completa el nombre, el correo invitado y una contraseña de mínimo 8 caracteres." };
  }
  const admin = createAdminClient();
  const { data: targets, error: targetError } = await admin.rpc("invitation_signup_target", { invitation_token: token });
  const target = Array.isArray(targets) ? targets[0] as { email: string; user_id: string | null; confirmed: boolean | null } | undefined : undefined;
  if (targetError || !target) return { error: "La invitación venció o ya no es válida. Pide un enlace nuevo." };
  if (target.email !== email) return { error: "Usa el mismo correo al que llegó la invitación." };
  if (target.user_id && target.confirmed) return { error: "Este correo ya tiene una cuenta. Usa «Ingresar» o «Continuar con Google» y luego acepta la invitación." };

  const metadata = { display_name: displayName };
  const created = target.user_id
    ? await admin.auth.admin.updateUserById(target.user_id, { password, email_confirm: true, user_metadata: metadata })
    : await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: metadata });
  if (created.error || !created.data.user) {
    logAuthFailure("signup", { method: "email", reason: created.error?.code ?? created.error?.name ?? "no_user", status: created.error?.status });
    if (created.error?.code === "weak_password") return { error: "La contraseña es muy débil. Usa al menos 8 caracteres combinando letras y números." };
    return { error: "No fue posible crear la cuenta. Intenta de nuevo o usa «Continuar con Google»." };
  }
  // Cuenta que existía sin confirmar: se deja el nombre que escribió ahora.
  if (target.user_id) await admin.from("profiles").update({ display_name: displayName }).eq("id", target.user_id);

  const supabase = await createClient();
  const { data: session, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError || !session.user) {
    logAuthFailure("password", { method: "email", reason: signInError?.code ?? "signup_sign_in", status: signInError?.status });
    return { error: "La cuenta quedó creada. Inicia sesión con tu correo y contraseña para continuar." };
  }
  const accepted = await acceptInvitationToken(supabase, session.user, token);
  if (accepted.error) return { error: accepted.error };
  redirect(accepted.path!);
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
  const accepted = await acceptInvitationToken(supabase, user, token);
  if (accepted.error) return { error: accepted.error };
  redirect(accepted.path!);
}

// Acepta la invitación (de un conjunto, de mantenimiento o de jurídica) y dice a dónde llevar a la persona.
async function acceptInvitationToken(supabase: Awaited<ReturnType<typeof createClient>>, user: { email?: string; identities?: { provider: string }[] | null }, token: string): Promise<{ error?: string; path?: string }> {
  let { error } = await supabase.rpc("accept_invitation", { invitation_token: token });
  let maintenance = false, legal = false;
  if (error?.message.includes("invalid_invitation")) {
    const result = await supabase.rpc("accept_maintenance_invitation", { invitation_token: token });
    if (!result.error || !result.error.message.includes("invalid_invitation")) { error = result.error; maintenance = !result.error; }
  }
  // Abogada de cobros (31/10/2026): su invitación va en una tabla aparte.
  if (error?.message.includes("invalid_invitation")) {
    const result = await supabase.rpc("accept_legal_invitation", { invitation_token: token });
    if (!result.error || !result.error.message.includes("invalid_invitation")) { error = result.error; legal = !result.error; }
  }
  if (error) {
    // Mensaje según la causa, para que quien acepta sepa qué hacer.
    if (error.message.includes("email_mismatch")) return { error: `Esta invitación es para otro correo. Ahora tienes la sesión iniciada con ${user.email ?? "otra cuenta"}: cierra sesión y entra con el correo invitado.` };
    if (error.message.includes("invalid_invitation")) return { error: "La invitación venció o ya no es válida. Si se generó un enlace nuevo, usa el último." };
    if (error.message.includes("membership_exists") || error.message.includes("already_assigned")) return { error: "Esta cuenta ya tiene acceso a esta comunidad, a este apartamento, al equipo de mantenimiento o al módulo jurídico." };
    return { error: "No pudimos aceptar la invitación. Intenta nuevamente." };
  }
  return { path: user.identities?.some((identity) => identity.provider === "google") && !user.identities.some((identity) => identity.provider === "email") ? "/invitacion/contrasena" : maintenance ? "/mantenimiento" : legal ? "/juridica" : "/panel?invitation=accepted" };
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
