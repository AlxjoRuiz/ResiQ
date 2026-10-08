"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { visitKinds } from "@/lib/visitors/constants";
import { requirePropertyMember } from "@/lib/auth/require-property-member";
import { validVisitDocument, visitTimeToIso, visitWindowError, visitErrorMessage as friendlyError } from "@/lib/visitors/validation";

export type VisitState = { error?: string; success?: string } | undefined;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const field = (data: FormData, name: string) => String(data.get(name) ?? "").trim();

export async function createVisit(_: VisitState, data: FormData): Promise<VisitState> {
  const propertyId=field(data,"propertyId"),unitId=field(data,"unitId"),hostMemberId=field(data,"hostMemberId"),visitorName=field(data,"visitorName"),documentLastDigits=field(data,"documentLastDigits"),kind=field(data,"kind"),company=field(data,"company"),serviceType=field(data,"serviceType"),scheduledStart=field(data,"scheduledStart"),scheduledEnd=field(data,"scheduledEnd"),notes=field(data,"notes"),authorizationNote=field(data,"authorizationNote");
  const peopleCount=Number(field(data,"peopleCount"));
  if(!uuidPattern.test(propertyId)||!uuidPattern.test(unitId)||(hostMemberId&&!uuidPattern.test(hostMemberId))||visitorName.length<2||visitorName.length>120||!visitKinds.some(([value])=>value===kind)||!Number.isInteger(peopleCount)||peopleCount<1||peopleCount>20||notes.length>1000)return{error:"Completa los campos con información válida."};
  if (!validVisitDocument(documentLastDigits)) return { error: friendlyError("invalid_document") };
  if (company.length > 120 || serviceType.length > 120) return { error: "La empresa y el servicio admiten máximo 120 caracteres." };
  if (kind === "maintenance" && !serviceType) return { error: friendlyError("service_required") };
  const { supabase, membership, property } = await requirePropertyMember(propertyId);
  if (!membership.roles.includes("member") || membership.roles.some((role: string) => role === "administrator" || role === "concierge")) return { error: friendlyError("not_authorized") };
  const start = visitTimeToIso(scheduledStart, property.timezone), end = visitTimeToIso(scheduledEnd, property.timezone);
  if (!start || !end) return { error: "Selecciona una fecha y hora válidas en la zona horaria del conjunto." };
  const windowError = visitWindowError(start, end);
  if (windowError) return { error: windowError };
  const result=await supabase.rpc("create_visit",{target_property_id:propertyId,target_unit_id:unitId,target_host_member_id:hostMemberId||null,target_visitor_name:visitorName,target_document_last_digits:documentLastDigits||null,target_kind:kind,target_company:company,target_service_type:serviceType,target_scheduled_start:start,target_scheduled_end:end,target_people_count:peopleCount,target_notes:notes,target_authorization_note:authorizationNote});
  if(result.error||!result.data)return{error:friendlyError(result.error?.message)}; revalidatePath(`/panel/propiedades/${propertyId}/visitas`); redirect(`/panel/propiedades/${propertyId}/visitas/${result.data}?created=1`);
}

export async function cancelVisit(_: VisitState,data:FormData):Promise<VisitState>{
  const propertyId=field(data,"propertyId"),visitorId=field(data,"visitorId"),reason=field(data,"reason"); if(!uuidPattern.test(propertyId)||!uuidPattern.test(visitorId)||reason.length<3||reason.length>500)return{error:"Escribe un motivo válido."};
  const supabase=await createClient();const result=await supabase.rpc("cancel_visit",{target_visitor_id:visitorId,target_reason:reason});if(result.error)return{error:friendlyError(result.error.message)};revalidatePath(`/panel/propiedades/${propertyId}/visitas`);revalidatePath(`/panel/propiedades/${propertyId}/visitas/${visitorId}`);return{success:"Visita cancelada."};
}
export async function registerVisitEntry(_:VisitState,data:FormData):Promise<VisitState>{
  const propertyId=field(data,"propertyId"),visitorId=field(data,"visitorId"),notes=field(data,"notes");if(!uuidPattern.test(propertyId)||!uuidPattern.test(visitorId)||notes.length>1000)return{error:"Revisa las observaciones."};const supabase=await createClient();const result=await supabase.rpc("register_visit_entry",{target_visitor_id:visitorId,target_notes:notes});if(result.error)return{error:friendlyError(result.error.message)};revalidatePath(`/panel/propiedades/${propertyId}/visitas`);revalidatePath(`/panel/propiedades/${propertyId}/visitas/${visitorId}`);return{success:"Ingreso registrado."};
}
export async function registerVisitExit(_:VisitState,data:FormData):Promise<VisitState>{
  const propertyId=field(data,"propertyId"),visitorId=field(data,"visitorId"),notes=field(data,"notes");if(!uuidPattern.test(propertyId)||!uuidPattern.test(visitorId)||notes.length>1000)return{error:"Revisa las observaciones."};const supabase=await createClient();const result=await supabase.rpc("register_visit_exit",{target_visitor_id:visitorId,target_notes:notes});if(result.error)return{error:friendlyError(result.error.message)};revalidatePath(`/panel/propiedades/${propertyId}/visitas`);revalidatePath(`/panel/propiedades/${propertyId}/visitas/${visitorId}`);return{success:"Salida registrada."};
}

export async function reviewVisit(_:VisitState,data:FormData):Promise<VisitState>{
  const propertyId=field(data,"propertyId"),visitorId=field(data,"visitorId"),decision=field(data,"decision"),reason=field(data,"reason");
  if(!uuidPattern.test(propertyId)||!uuidPattern.test(visitorId)||!["approve","reject"].includes(decision)||reason.length>500||(decision==="reject"&&reason.length<3))return{error:"Para rechazar, escribe un motivo de al menos tres caracteres."};
  const supabase=await createClient();const {error}=await supabase.rpc("review_visit",{target_visitor_id:visitorId,target_approved:decision==="approve",target_reason:reason});
  if(error)return{error:friendlyError(error.message)};
  revalidatePath(`/panel/propiedades/${propertyId}/visitas`);revalidatePath(`/panel/propiedades/${propertyId}/visitas/${visitorId}`);
  return{success:decision==="approve"?"Solicitud aceptada.":"Solicitud rechazada."};
}
