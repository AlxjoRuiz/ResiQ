"use server";

import { revalidatePath } from "next/cache";
import { requireMaintenanceStaff } from "@/lib/auth/require-maintenance-staff";
import { conciergeFullName, conciergeUsername } from "@/lib/concierge/identity";
import { ageOn, normalizePhone, parseVehicles } from "@/lib/concierge/person";
import { createAdminClient } from "@/lib/supabase/admin";

// Trabajadores de mantenimiento (entrega 2, 28/10/2026): mismas reglas que el registro de portería.
// Solo el admin de mantenimiento; la cuenta se crea con la clave de servicio del servidor.
export type WorkerState = { error?: string; success?: string } | undefined;

const value = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const refresh = () => revalidatePath("/mantenimiento", "layout");

// Datos personales comunes a crear y editar; devuelve el error o los valores ya limpios.
function personalData(data: FormData) {
  const firstName = value(data, "firstName"), firstSurname = value(data, "firstSurname");
  const documentNumber = value(data, "documentNumber"), birthDate = value(data, "birthDate");
  const phone = normalizePhone(value(data, "phone")), address = value(data, "address");
  const vehicles = parseVehicles(value(data, "vehicles")), age = ageOn(birthDate);
  if (!firstName || !firstSurname || firstName.length > 60 || firstSurname.length > 60) return { error: "Revisa los nombres y apellidos (máximo 60 caracteres cada uno)." };
  if (!/^\d{5,20}$/u.test(documentNumber)) return { error: "Revisa la cédula: solo números, entre 5 y 20 dígitos." };
  if (age === null) return { error: "Revisa la fecha de nacimiento." };
  if (age < 18 || age > 100) return { error: `El trabajador debe ser mayor de 18 años; con esa fecha de nacimiento tendría ${age}.` };
  if (!phone) return { error: "Revisa el teléfono: celular de 10 dígitos que empiece por 3 (ej. 3001234567) o número internacional con +." };
  if (address.length > 180) return { error: "La dirección puede tener máximo 180 caracteres." };
  if (!vehicles || vehicles.length > 1) return { error: "Revisa el vehículo: completa tipo, marca, modelo y placa, o déjalos todos vacíos." };
  return { firstName, firstSurname, documentNumber, birthDate, phone, address, vehicles, fullName: conciergeFullName(firstName, firstSurname) };
}

function passwordError(password: string, confirmation: string, documentNumber: string) {
  if (password !== confirmation) return "Las contraseñas no coinciden.";
  if (password.length < 12 || password.length > 128 || !/[a-z]/u.test(password) || !/[A-Z]/u.test(password) || !/\d/u.test(password)) return "La contraseña debe tener de 12 a 128 caracteres, con mayúscula, minúscula y número.";
  if (password.includes(documentNumber)) return "La contraseña no puede contener la cédula.";
  return null;
}

export async function registerMaintenanceWorker(_: WorkerState, data: FormData): Promise<WorkerState> {
  const { userId: adminId } = await requireMaintenanceStaff("admin");
  const person = personalData(data);
  if ("error" in person) return { error: person.error };
  const email = value(data, "email").toLowerCase(), username = value(data, "username");
  if (username !== conciergeUsername(person.firstName, person.firstSurname, person.documentNumber)) return { error: "Escribe el usuario con primer nombre, primer apellido y los dos últimos dígitos de la cédula, en minúsculas y sin espacios ni tildes." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email) || email.length > 254 || data.get("emailVerified") !== "yes") return { error: "Indica un correo real y confirma que pertenece al trabajador." };
  const passwordProblem = passwordError(String(data.get("password") ?? ""), String(data.get("confirmation") ?? ""), person.documentNumber);
  if (passwordProblem) return { error: passwordProblem };
  const admin = createAdminClient();
  // El usuario no puede repetirse con porteros, auxiliares ni otros trabajadores.
  const taken = await Promise.all([
    admin.from("concierge_accounts").select("id").eq("username", username).maybeSingle(),
    admin.from("admin_assistant_records").select("id").eq("username", username).maybeSingle(),
    admin.from("maintenance_worker_records").select("id").eq("username", username).maybeSingle(),
  ]);
  if (taken.some((result) => result.error)) return { error: "No pudimos comprobar la disponibilidad del usuario." };
  if (taken.some((result) => result.data)) return { error: "Ese usuario ya existe en ResiQ." };

  const created = await admin.auth.admin.createUser({ email, password: String(data.get("password")), email_confirm: true, user_metadata: { display_name: person.fullName } });
  if (created.error || !created.data.user) return { error: "No pudimos crear la cuenta. Comprueba que el correo no esté asignado a otra cuenta de ResiQ." };
  const workerId = created.data.user.id;
  let staffId: string | null = null;
  // Si algo falla a mitad de camino se deshace todo lo creado.
  async function cleanup() {
    const recordRemoval = await admin.from("maintenance_worker_records").delete().eq("user_id", workerId);
    const staffRemoval = staffId ? await admin.from("maintenance_staff").delete().eq("id", staffId) : null;
    const profileRemoval = await admin.from("profiles").delete().eq("id", workerId);
    const authRemoval = await admin.auth.admin.deleteUser(workerId);
    return !recordRemoval.error && !staffRemoval?.error && !profileRemoval.error && !authRemoval.error;
  }
  const incomplete = "El registro quedó incompleto y no se pudo revertir totalmente. No lo repitas; revisa la cuenta antes de continuar.";
  const staff = await admin.from("maintenance_staff").insert({ user_id: workerId, role: "worker", status: "active", created_by: adminId }).select("id").single();
  if (staff.error || !staff.data) return { error: await cleanup() ? "No pudimos agregar la cuenta al equipo de mantenimiento." : incomplete };
  staffId = staff.data.id;
  const record = await admin.from("maintenance_worker_records").insert({ staff_id: staffId, user_id: workerId, username, first_name: person.firstName, first_surname: person.firstSurname, document_number: person.documentNumber, birth_date: person.birthDate, phone_e164: person.phone, email_normalized: email, address: person.address || null, vehicles: person.vehicles, created_by: adminId });
  if (record.error) return { error: await cleanup() ? record.error.code === "23505" ? "Ese usuario ya existe en ResiQ." : "No pudimos guardar la ficha del trabajador." : incomplete };
  refresh();
  return { success: `Trabajador registrado. Usuario permanente: ${username}. Entrega la contraseña asignada de forma privada; ResiQ no volverá a mostrarla.` };
}

// Ficha vigente del trabajador (no eliminada) con su cuenta del equipo.
async function findWorker(recordId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("maintenance_worker_records").select("id,staff_id,user_id,document_number,removed_at").eq("id", recordId).maybeSingle();
  return { admin, record: error || !data || data.removed_at ? null : data };
}

export async function editMaintenanceWorker(_: WorkerState, data: FormData): Promise<WorkerState> {
  await requireMaintenanceStaff("admin");
  const person = personalData(data);
  if ("error" in person) return { error: person.error };
  const { admin, record } = await findWorker(value(data, "recordId"));
  if (!record) return { error: "La ficha ya no está disponible." };
  const saved = await admin.from("maintenance_worker_records").update({ first_name: person.firstName, first_surname: person.firstSurname, document_number: person.documentNumber, birth_date: person.birthDate, phone_e164: person.phone, address: person.address || null, vehicles: person.vehicles }).eq("id", record.id).select("id").single();
  if (saved.error || !saved.data) return { error: "No pudimos guardar los cambios." };
  await admin.from("profiles").update({ display_name: person.fullName }).eq("id", record.user_id);
  await admin.auth.admin.updateUserById(record.user_id, { user_metadata: { display_name: person.fullName } });
  refresh();
  return { success: "Ficha actualizada. El usuario permanente y el correo de acceso no cambiaron." };
}

export async function changeMaintenanceWorkerPassword(_: WorkerState, data: FormData): Promise<WorkerState> {
  await requireMaintenanceStaff("admin");
  const { admin, record } = await findWorker(value(data, "recordId"));
  if (!record) return { error: "El trabajador no tiene una cuenta activa." };
  const problem = passwordError(String(data.get("password") ?? ""), String(data.get("confirmation") ?? ""), record.document_number);
  if (problem) return { error: problem };
  const { error } = await admin.auth.admin.updateUserById(record.user_id, { password: String(data.get("password")) });
  if (error) return { error: "No pudimos sustituir la contraseña." };
  return { success: "Contraseña sustituida. Entrégala al trabajador de forma privada; ResiQ no puede mostrar la anterior." };
}

export async function setMaintenanceWorkerStatus(_: WorkerState, data: FormData): Promise<WorkerState> {
  await requireMaintenanceStaff("admin");
  const status = value(data, "status");
  if (!["active", "suspended"].includes(status)) return { error: "Estado inválido." };
  const { admin, record } = await findWorker(value(data, "recordId"));
  if (!record) return { error: "La ficha ya no está disponible." };
  const saved = await admin.from("maintenance_staff").update({ status }).eq("id", record.staff_id).eq("role", "worker").neq("status", "revoked").select("id").single();
  if (saved.error || !saved.data) return { error: "No pudimos cambiar el acceso del trabajador." };
  refresh();
  return { success: status === "suspended" ? "Acceso del trabajador suspendido." : "Acceso del trabajador reactivado." };
}

export async function removeMaintenanceWorker(_: WorkerState, data: FormData): Promise<WorkerState> {
  const { userId: adminId } = await requireMaintenanceStaff("admin");
  if (value(data, "confirmation") !== "RETIRAR") return { error: "Escribe RETIRAR para confirmar la baja." };
  const { admin, record } = await findWorker(value(data, "recordId"));
  if (!record) return { error: "La ficha ya no está disponible." };
  if (record.user_id === adminId) return { error: "No puedes eliminar tu propia cuenta." };
  // Primero se revoca el acceso al equipo; luego se bloquea la cuenta si no tiene otros accesos.
  const revoked = await admin.from("maintenance_staff").update({ status: "revoked" }).eq("id", record.staff_id).select("id").single();
  if (revoked.error || !revoked.data) return { error: "No pudimos revocar el acceso. La baja no se completó." };
  const [memberships, platformRoles] = await Promise.all([
    admin.from("property_members").select("id").eq("user_id", record.user_id).eq("status", "active").limit(1),
    admin.from("platform_admins").select("id").eq("user_id", record.user_id).eq("status", "active").limit(1),
  ]);
  if (!memberships.data?.length && !platformRoles.data?.length) {
    const banned = await admin.auth.admin.updateUserById(record.user_id, { ban_duration: "876000h" });
    if (banned.error) { refresh(); return { error: "El acceso quedó revocado, pero falta bloquear la cuenta. Intenta de nuevo." }; }
  }
  const removed = await admin.from("maintenance_worker_records").update({ removed_at: new Date().toISOString(), address: null, vehicles: [] }).eq("id", record.id).select("id").single();
  if (removed.error || !removed.data) { refresh(); return { error: "El acceso quedó bloqueado, pero falta marcar la ficha. Intenta de nuevo." }; }
  refresh();
  return { success: "Trabajador retirado: acceso revocado y cuenta bloqueada." };
}
