"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pqrsCategories,pqrsRequestTypes,pqrsStatuses } from "@/lib/pqrs/constants";
export type PqrsState={error?:string;success?:string}|undefined;
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const field=(data:FormData,name:string)=>String(data.get(name)??"").trim();
function friendlyError(message?:string){if(message?.includes("invalid_transition"))return "Ese cambio de estado no está permitido.";if(message?.includes("not_authorized"))return "No tienes permiso para realizar esta acción.";return "No pudimos guardar el cambio. Revisa los datos e inténtalo nuevamente.";}
export async function createPqrs(_:PqrsState,data:FormData):Promise<PqrsState>{
  const propertyId=field(data,"propertyId"),unitId=field(data,"unitId"),category=field(data,"category"),requestType=field(data,"requestType"),subject=field(data,"subject"),description=field(data,"description");
  if(!uuidPattern.test(propertyId)||!uuidPattern.test(unitId)||!pqrsCategories.some(([value])=>value===category)||!pqrsRequestTypes.some(([value])=>value===requestType)||subject.length<4||subject.length>140||description.length<10||description.length>5000)return{error:"Completa todos los campos con información válida."};
  const supabase=await createClient();const result=await supabase.rpc("create_pqrs",{target_property_id:propertyId,target_unit_id:unitId,target_category:category,target_request_type:requestType,target_subject:subject,target_description:description});
  if(result.error||!result.data)return{error:friendlyError(result.error?.message)};revalidatePath(`/panel/propiedades/${propertyId}/pqrs`);redirect(`/panel/propiedades/${propertyId}/pqrs/${result.data}?created=1`);
}
export async function addPqrsMessage(_:PqrsState,data:FormData):Promise<PqrsState>{
  const propertyId=field(data,"propertyId"),pqrsId=field(data,"pqrsId"),body=field(data,"body");if(!uuidPattern.test(propertyId)||!uuidPattern.test(pqrsId)||body.length<1||body.length>5000)return{error:"Escribe una respuesta válida."};
  const supabase=await createClient();const result=await supabase.rpc("add_pqrs_message",{target_pqrs_id:pqrsId,target_body:body});if(result.error)return{error:friendlyError(result.error.message)};revalidatePath(`/panel/propiedades/${propertyId}/pqrs/${pqrsId}`);revalidatePath(`/panel/propiedades/${propertyId}/pqrs`);return{success:"Respuesta enviada."};
}
export async function changePqrsStatus(_:PqrsState,data:FormData):Promise<PqrsState>{
  const propertyId=field(data,"propertyId"),pqrsId=field(data,"pqrsId"),status=field(data,"status");if(!uuidPattern.test(propertyId)||!uuidPattern.test(pqrsId)||!pqrsStatuses.slice(1).some(([value])=>value===status))return{error:"Selecciona un estado válido."};
  const supabase=await createClient();const result=await supabase.rpc("change_pqrs_status",{target_pqrs_id:pqrsId,target_status:status});if(result.error)return{error:friendlyError(result.error.message)};revalidatePath(`/panel/propiedades/${propertyId}/pqrs/${pqrsId}`);revalidatePath(`/panel/propiedades/${propertyId}/pqrs`);return{success:"Estado actualizado."};
}
