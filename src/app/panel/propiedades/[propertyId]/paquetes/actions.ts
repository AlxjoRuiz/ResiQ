"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type PackageState = { error?: string; success?: string } | undefined;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const field = (data: FormData, name: string) => String(data.get(name) ?? "").trim();

function friendlyError(message?: string) {
  if (message?.includes("not_authorized")) return "No tienes permiso para realizar esta acción.";
  if (message?.includes("invalid_unit")) return "Selecciona un apartamento activo.";
  if (message?.includes("invalid_recipient")) return "El destinatario ya no está vinculado a ese apartamento.";
  if (message?.includes("invalid_transition")) return "Esta entrega ya no admite ese cambio.";
  return "No pudimos guardar el cambio. Revisa los datos e inténtalo nuevamente.";
}

export async function registerPackage(_: PackageState, data: FormData): Promise<PackageState> {
  const propertyId = field(data, "propertyId");
  const unitId = field(data, "unitId");
  const recipientMemberId = field(data, "recipientMemberId");
  const recipientName = field(data, "recipientName");
  const carrier = field(data, "carrier");
  const trackingNumber = field(data, "trackingNumber");
  const senderName = field(data, "senderName");
  const origin = field(data, "origin");
  const description = field(data, "description");
  const notes = field(data, "notes");
  const itemKind = field(data, "itemKind") || "package";
  const utilityService = field(data, "utilityService");
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(unitId) || (recipientMemberId && !uuidPattern.test(recipientMemberId)) || recipientName.length > 120 || (itemKind === "package" && (description.length < 3 || description.length > 500)) || carrier.length > 100 || trackingNumber.length > 100 || senderName.length > 120 || origin.length > 120 || notes.length > 1000) return { error: "Completa los campos obligatorios con información válida." };
  if (!recipientMemberId && recipientName.length < 2) return { error: "Escribe el nombre del destinatario." };
  if (!["package", "utility_bill"].includes(itemKind) || (itemKind === "utility_bill" && !["electricity", "gas", "water"].includes(utilityService))) return { error: "Selecciona el tipo de entrega y servicio." };
  const supabase = await createClient();
  const result = itemKind === "utility_bill"
    ? await supabase.rpc("register_utility_bill", { target_property_id: propertyId, target_unit_id: unitId, target_recipient_member_id: recipientMemberId || null, target_recipient_name: recipientName, target_service: utilityService, target_notes: notes })
    : await supabase.rpc("register_package", { target_property_id: propertyId, target_unit_id: unitId, target_recipient_member_id: recipientMemberId || null, target_recipient_name: recipientName, target_carrier: carrier, target_tracking_number: trackingNumber, target_sender_name: senderName, target_origin: origin, target_description: description, target_notes: notes });
  if (result.error || !result.data) return { error: friendlyError(result.error?.message) };
  revalidatePath(`/panel/propiedades/${propertyId}/paquetes`);
  redirect(`/panel/propiedades/${propertyId}/paquetes/${result.data}?created=1`);
}

export async function assignPackageRecipient(_: PackageState, data: FormData): Promise<PackageState> {
  const propertyId = field(data, "propertyId"), packageId = field(data, "packageId"), memberId = field(data, "memberId");
  if (![propertyId, packageId, memberId].every((value) => uuidPattern.test(value))) return { error: "Selecciona un destinatario válido." };
  const supabase = await createClient();
  const result = await supabase.rpc("assign_package_recipient", { target_package_id: packageId, target_member_id: memberId });
  if (result.error) return { error: friendlyError(result.error.message) };
  revalidatePath(`/panel/propiedades/${propertyId}/paquetes`);
  revalidatePath(`/panel/propiedades/${propertyId}/paquetes/${packageId}`);
  return { success: "Destinatario asociado y aviso creado." };
}

export async function deliverPackage(_: PackageState, data: FormData): Promise<PackageState> {
  const propertyId = field(data, "propertyId"), packageId = field(data, "packageId"), collectedByName = field(data, "collectedByName");
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(packageId) || collectedByName.length < 2 || collectedByName.length > 120) return { error: "Escribe el nombre de quien retira la entrega." };
  const supabase = await createClient();
  const result = await supabase.rpc("deliver_package", { target_package_id: packageId, target_collected_by_name: collectedByName });
  if (result.error) return { error: friendlyError(result.error.message) };
  revalidatePath(`/panel/propiedades/${propertyId}/paquetes`);
  revalidatePath(`/panel/propiedades/${propertyId}/paquetes/${packageId}`);
  return { success: "Entrega registrada correctamente." };
}
