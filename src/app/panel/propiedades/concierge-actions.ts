"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { requirePropertyAdmin } from "@/lib/auth/require-property-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { conciergeFullName, conciergeUsername } from "@/lib/concierge/identity";
import { ageOn, normalizePhone, parseVehicles } from "@/lib/concierge/person";

export type ConciergeState = { error?: string; success?: string } | undefined;

function value(data: FormData, key: string) { return String(data.get(key) ?? "").trim(); }
function refresh(propertyId: string) { revalidatePath(`/panel/propiedades/${propertyId}`); }

export async function registerConcierge(_: ConciergeState, data: FormData): Promise<ConciergeState> {
  const propertyId = value(data, "propertyId");
  const { user } = await requirePropertyAdmin(propertyId);
  const firstName = value(data, "firstName");
  const firstSurname = value(data, "firstSurname");
  const fullName = conciergeFullName(firstName, firstSurname);
  const documentNumber = value(data, "documentNumber");
  const birthDate = value(data, "birthDate");
  const phone = normalizePhone(value(data, "phone"));
  const email = value(data, "email").toLowerCase();
  const address = value(data, "address");
  const password = String(data.get("password") ?? "");
  const confirmation = String(data.get("confirmation") ?? "");
  const expectedUsername = conciergeUsername(firstName, firstSurname, documentNumber);
  const username = value(data, "username");
  const vehicles = parseVehicles(value(data, "vehicles"));
  const age = ageOn(birthDate);
  if (!expectedUsername || username !== expectedUsername) return { error: "Escribe el usuario con primer nombre, primer apellido y los dos últimos dígitos de la cédula, en minúsculas y sin espacios ni tildes." };
  if (!firstName || !firstSurname || firstName.length > 60 || firstSurname.length > 60 || fullName.length > 120 || age === null || age < 18 || age > 100 || !phone || !vehicles || vehicles.length > 1 || address.length > 180) return { error: "Revisa nombres, apellidos, cédula, fecha de nacimiento, teléfono y vehículo (máximo uno)." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email) || email.length > 254 || data.get("emailVerified") !== "yes") return { error: "Indica un correo real y confirma que pertenece al portero." };
  if (password !== confirmation) return { error: "Las contraseñas no coinciden." };
  if (password.length < 12 || password.length > 128 || !/[a-z]/u.test(password) || !/[A-Z]/u.test(password) || !/\d/u.test(password) || password.includes(documentNumber)) return { error: "La contraseña debe tener de 12 a 128 caracteres, mayúscula, minúscula y número; no puede contener la cédula." };
  const admin = createAdminClient();
  const [existingUsername, existingEmail] = await Promise.all([
    admin.from("concierge_accounts").select("id").eq("username", username).maybeSingle(),
    admin.from("concierge_accounts").select("id").eq("email_normalized", email).maybeSingle(),
  ]);
  if (existingUsername.error || existingEmail.error) return { error: "No pudimos comprobar la disponibilidad del usuario." };
  if (existingUsername.data) return { error: "Ese usuario ya existe en ResiQ. No se puede registrar otro portero con el mismo usuario." };
  if (existingEmail.data) return { error: "Ese correo ya está registrado para otro portero." };

  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: fullName } });
  if (created.error || !created.data.user) return { error: "No pudimos crear la cuenta. Comprueba que el correo real no esté asignado a otra cuenta." };
  const userId = created.data.user.id;
  let memberId: string | null = null;
  const accountId = randomUUID();
  async function cleanup() {
    const accountRemoval = await admin.from("concierge_accounts").delete().eq("id", accountId);
    const memberRemoval = memberId ? await admin.from("property_members").delete().eq("id", memberId) : null;
    const profileRemoval = await admin.from("profiles").delete().eq("id", userId);
    const authRemoval = await admin.auth.admin.deleteUser(userId);
    return !accountRemoval.error && !memberRemoval?.error && !profileRemoval.error && !authRemoval.error;
  }
  const incomplete = "El registro quedó incompleto y no se pudo revertir totalmente. No lo repitas; revisa la cuenta antes de continuar.";
  const member = await admin.from("property_members").insert({ property_id: propertyId, user_id: userId, roles: ["concierge"], status: "suspended", created_by: user.id }).select("id").single();
  if (member.error || !member.data) return { error: await cleanup() ? "No pudimos vincular la cuenta a la propiedad." : incomplete };
  memberId = member.data.id;
  const account = await admin.from("concierge_accounts").insert({ id: accountId, property_id: propertyId, user_id: userId, member_id: memberId, username, full_name: fullName, document_number: documentNumber, birth_date: birthDate, phone_e164: phone, email_normalized: email, address: address || null, vehicles, status: "pending", created_by: user.id });
  if (account.error) return { error: await cleanup() ? account.error.code === "23505" ? "Ese usuario o correo ya existe en ResiQ." : "No pudimos guardar la ficha del portero." : incomplete };
  const accountReady = await admin.from("concierge_accounts").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", accountId).eq("status", "pending").select("id").single();
  if (accountReady.error || !accountReady.data) return { error: await cleanup() ? "No pudimos activar la ficha del portero." : incomplete };
  const accessReady = await admin.from("property_members").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", memberId).eq("status", "suspended").select("id").single();
  if (accessReady.error || !accessReady.data) return { error: await cleanup() ? "No pudimos activar el acceso del portero." : incomplete };
  refresh(propertyId);
  return { success: `Portero registrado. Usuario permanente: ${username}. Entrega la contraseña asignada de forma privada; ResiQ no volverá a mostrarla.` };
}

export async function editConcierge(_: ConciergeState, data: FormData): Promise<ConciergeState> {
  const propertyId = value(data, "propertyId");
  await requirePropertyAdmin(propertyId);
  const accountId = value(data, "accountId");
  const fullName = value(data, "fullName");
  const documentNumber = value(data, "documentNumber");
  const birthDate = value(data, "birthDate");
  const phone = normalizePhone(value(data, "phone"));
  const address = value(data, "address");
  const vehicles = parseVehicles(value(data, "vehicles"));
  const age = ageOn(birthDate);
  if (fullName.length < 2 || fullName.length > 120 || !/^\d{5,20}$/u.test(documentNumber) || age === null || age < 18 || age > 100 || !phone || !vehicles || address.length > 180) return { error: "Revisa los datos personales y los vehículos." };
  const admin = createAdminClient();
  const { data: account, error: findError } = await admin.from("concierge_accounts").select("id,user_id,status").eq("id", accountId).eq("property_id", propertyId).maybeSingle();
  if (findError || !account || account.status === "removed") return { error: "La ficha ya no está disponible." };
  const saved = await admin.from("concierge_accounts").update({ full_name: fullName, document_number: documentNumber, birth_date: birthDate, phone_e164: phone, address: address || null, vehicles, updated_at: new Date().toISOString() }).eq("id", account.id).eq("property_id", propertyId).select("id").single();
  if (saved.error || !saved.data) return { error: "No pudimos guardar los cambios." };
  await admin.from("profiles").update({ display_name: fullName }).eq("id", account.user_id);
  await admin.auth.admin.updateUserById(account.user_id, { user_metadata: { display_name: fullName } });
  refresh(propertyId);
  return { success: "Ficha actualizada. El usuario permanente y el correo de acceso no cambiaron." };
}

export async function changeConciergePassword(_: ConciergeState, data: FormData): Promise<ConciergeState> {
  const propertyId = value(data, "propertyId");
  await requirePropertyAdmin(propertyId);
  const accountId = value(data, "accountId");
  const password = String(data.get("password") ?? "");
  const confirmation = String(data.get("confirmation") ?? "");
  if (password !== confirmation) return { error: "Las contraseñas no coinciden." };
  if (password.length < 12 || password.length > 128 || !/[a-z]/u.test(password) || !/[A-Z]/u.test(password) || !/\d/u.test(password)) return { error: "Usa entre 12 y 128 caracteres, con mayúscula, minúscula y número." };
  const admin = createAdminClient();
  const { data: account, error: findError } = await admin.from("concierge_accounts").select("user_id,document_number,status").eq("id", accountId).eq("property_id", propertyId).maybeSingle();
  if (findError || !account || account.status !== "active") return { error: "El portero no tiene una cuenta activa." };
  if (password.includes(account.document_number)) return { error: "La contraseña no puede contener la cédula." };
  const { error } = await admin.auth.admin.updateUserById(account.user_id, { password });
  if (error) return { error: "No pudimos sustituir la contraseña." };
  return { success: "Contraseña sustituida. Entrégala al portero de forma privada; ResiQ no puede mostrar la anterior." };
}

export async function removeConcierge(_: ConciergeState, data: FormData): Promise<ConciergeState> {
  const propertyId = value(data, "propertyId");
  await requirePropertyAdmin(propertyId);
  const accountId = value(data, "accountId");
  if (value(data, "confirmation") !== "RETIRAR") return { error: "Escribe RETIRAR para confirmar la baja." };
  const admin = createAdminClient();
  const { data: account, error: findError } = await admin.from("concierge_accounts").select("id,user_id,member_id,status,photo_path").eq("id", accountId).eq("property_id", propertyId).maybeSingle();
  if (findError || !account || account.status === "removed") return { error: "La ficha ya no está disponible." };
  const { data: member, error: memberError } = await admin.from("property_members").select("id,roles,status").eq("id", account.member_id).eq("property_id", propertyId).eq("user_id", account.user_id).maybeSingle();
  if (memberError || !member || member.roles.length !== 1 || member.roles[0] !== "concierge") return { error: "El acceso tiene otros roles o cambió; revisa la cuenta antes de retirarla." };
  const [otherMemberships, platformRoles] = await Promise.all([
    admin.from("property_members").select("id").eq("user_id", account.user_id).neq("id", member.id).eq("status", "active").limit(1),
    admin.from("platform_admins").select("id").eq("user_id", account.user_id).eq("status", "active").limit(1),
  ]);
  if (otherMemberships.error || platformRoles.error) return { error: "No pudimos comprobar otros accesos de esta cuenta." };
  const hasOtherAccess = Boolean(otherMemberships.data?.length || platformRoles.data?.length);
  // Revoking the database membership comes first: existing JWTs cannot bypass the active-member guards.
  if (member.status !== "revoked") {
    const revoked = await admin.from("property_members").update({ status: "revoked", revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", member.id).eq("property_id", propertyId).select("id").single();
    if (revoked.error || !revoked.data) return { error: "No pudimos revocar el acceso. La baja no se completó." };
  }
  const suspended = await admin.from("concierge_accounts").update({ status: "suspended", updated_at: new Date().toISOString() }).eq("id", account.id).eq("property_id", propertyId).select("id").single();
  if (suspended.error || !suspended.data) return { error: "El acceso quedó revocado, pero falta actualizar la ficha. Intenta de nuevo." };
  if (!hasOtherAccess) {
    const banned = await admin.auth.admin.updateUserById(account.user_id, { ban_duration: "876000h" });
    if (banned.error) { refresh(propertyId); return { error: "El acceso a ResiQ quedó revocado, pero falta bloquear la cuenta de Auth. Intenta de nuevo." }; }
  }
  if (account.photo_path) {
    const photoRemoval = await admin.storage.from("private-documents").remove([account.photo_path]);
    if (photoRemoval.error) { refresh(propertyId); return { error: "El acceso quedó bloqueado, pero no pudimos quitar la foto. Intenta de nuevo." }; }
  }
  const removed = await admin.from("concierge_accounts").update({ status: "removed", removed_at: new Date().toISOString(), address: null, vehicles: [], photo_path: null, updated_at: new Date().toISOString() }).eq("id", account.id).eq("property_id", propertyId).select("id").single();
  if (removed.error || !removed.data) { refresh(propertyId); return { error: "El acceso y la identidad quedaron bloqueados, pero falta ocultar la ficha. Intenta de nuevo." }; }
  refresh(propertyId);
  return { success: hasOtherAccess ? "Portero retirado y tarjeta quitada. La identidad Auth conserva otros accesos activos; no se bloqueó globalmente." : "Portero retirado: acceso revocado, identidad bloqueada y tarjeta retirada. Se conservan los datos aún exigidos por el esquema para revisión de retención." };
}
