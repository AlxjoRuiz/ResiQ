"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readSheet, type CellValue } from "read-excel-file/node";
import { createClient } from "@/lib/supabase/server";
import { requirePropertyAdmin } from "@/lib/auth/require-property-admin";
import { boundedXlsx } from "@/lib/finance/bounded-xlsx";

export type FinanceState = { error?: string; success?: string } | undefined;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const field = (data: FormData, name: string) => String(data.get(name) ?? "").trim();
const financePath = (propertyId: string) => `/panel/propiedades/${propertyId}/cartera`;

function friendlyError(message?: string) {
  if (message?.includes("not_authorized")) return "No tienes permiso para realizar esta acción.";
  if (message?.includes("duplicate_reference")) return "Ya existe una obligación con una de esas referencias.";
  if (message?.includes("duplicate_payment")) return "El pago ya fue registrado.";
  if (message?.includes("payment_overallocated")) return "La distribución supera el valor del pago.";
  if (message?.includes("receivable_overallocated")) return "La distribución supera el saldo de una obligación.";
  if (message?.includes("invalid_receivable")) return "Una obligación seleccionada ya no está disponible.";
  if (message?.includes("inactive_membership")) return "El vínculo ya no está vigente.";
  if (message?.includes("invalid_import")) return "El archivo debe contener entre 1 y 500 registros.";
  if (message?.includes("invalid_import_row")) return "Una fila del archivo no cumple las reglas de cartera.";
  return "No pudimos guardar el cambio. Revisa los datos e inténtalo nuevamente.";
}

function refreshFinance(propertyId: string, unitId?: string) {
  revalidatePath(financePath(propertyId));
  if (unitId) revalidatePath(`${financePath(propertyId)}/${unitId}`);
  revalidatePath(`/panel/propiedades/${propertyId}/reservas`);
  revalidatePath(`/panel/propiedades/${propertyId}/dashboard`);
}

export async function createReceivable(_: FinanceState, data: FormData): Promise<FinanceState> {
  const propertyId=field(data,"propertyId"),unitId=field(data,"unitId"),concept=field(data,"concept"),issuedOn=field(data,"issuedOn"),dueOn=field(data,"dueOn"),externalReference=field(data,"externalReference");
  const amount=Number(field(data,"amount"));
  if(!uuidPattern.test(propertyId)||!uuidPattern.test(unitId)||concept.length<2||concept.length>180||!Number.isFinite(amount)||amount<=0||!isoDatePattern.test(issuedOn)||!isoDatePattern.test(dueOn)||dueOn<issuedOn||externalReference.length>120)return{error:"Completa una obligación válida."};
  const supabase=await createClient();const result=await supabase.rpc("create_receivable",{target_property_id:propertyId,target_unit_id:unitId,target_concept:concept,target_amount:amount,target_issued_on:issuedOn,target_due_on:dueOn,target_external_reference:externalReference});
  if(result.error)return{error:friendlyError(result.error.message)};
  refreshFinance(propertyId,unitId);return{success:"Obligación registrada."};
}

export async function recordPayment(_: FinanceState, data: FormData): Promise<FinanceState> {
  const propertyId=field(data,"propertyId"),unitId=field(data,"unitId"),paidOn=field(data,"paidOn"),reference=field(data,"reference");const amount=Number(field(data,"amount"));
  const allocations=data.getAll("receivableId").map(String).flatMap((receivableId)=>{const value=Number(field(data,`allocation_${receivableId}`));return value>0?[{receivable_id:receivableId,amount:value}]:[];});
  if(!uuidPattern.test(propertyId)||!uuidPattern.test(unitId)||!Number.isFinite(amount)||amount<=0||!isoDatePattern.test(paidOn)||allocations.some((item)=>!uuidPattern.test(item.receivable_id)))return{error:"Completa un pago válido."};
  const allocated=allocations.reduce((sum,item)=>sum+item.amount,0);if(allocated>amount+0.001)return{error:"La distribución supera el valor del pago."};
  const supabase=await createClient();const result=await supabase.rpc("record_payment",{target_property_id:propertyId,target_unit_id:unitId,target_amount:amount,target_paid_on:paidOn,target_reference:reference,target_allocations:allocations,target_idempotency_key:crypto.randomUUID()});
  if(result.error)return{error:friendlyError(result.error.message)};
  refreshFinance(propertyId,unitId);return{success:"Pago registrado y distribuido."};
}

export async function voidReceivable(_: FinanceState, data: FormData): Promise<FinanceState> {
  const propertyId=field(data,"propertyId"),unitId=field(data,"unitId"),receivableId=field(data,"receivableId"),reason=field(data,"reason");
  if(![propertyId,unitId,receivableId].every((value)=>uuidPattern.test(value))||reason.length<3||reason.length>500)return{error:"Escribe un motivo válido."};
  const supabase=await createClient();const result=await supabase.rpc("void_receivable",{target_receivable_id:receivableId,target_reason:reason});if(result.error)return{error:friendlyError(result.error.message)};
  refreshFinance(propertyId,unitId);return{success:"Obligación anulada."};
}

export async function voidPayment(_: FinanceState, data: FormData): Promise<FinanceState> {
  const propertyId=field(data,"propertyId"),unitId=field(data,"unitId"),paymentId=field(data,"paymentId"),reason=field(data,"reason");
  if(![propertyId,unitId,paymentId].every((value)=>uuidPattern.test(value))||reason.length<3||reason.length>500)return{error:"Escribe un motivo válido."};
  const supabase=await createClient();const result=await supabase.rpc("void_payment",{target_payment_id:paymentId,target_reason:reason});if(result.error)return{error:friendlyError(result.error.message)};
  refreshFinance(propertyId,unitId);return{success:"Pago anulado."};
}

export async function updateFinancePolicy(_: FinanceState, data: FormData): Promise<FinanceState> {
  const propertyId=field(data,"propertyId"),days=Number(field(data,"minimumOverdueDays")),restrict=data.get("restrictReservations")==="on",confirmed=data.get("balancesConfirmed")==="on";
  if(!uuidPattern.test(propertyId)||!Number.isInteger(days)||days<0||days>3650)return{error:"Configura un número de días válido."};
  if(restrict&&!confirmed)return{error:"Confirma que los saldos vigentes ya fueron cargados antes de activar el bloqueo."};
  const supabase=await createClient();const result=await supabase.rpc("update_finance_policy",{target_property_id:propertyId,target_restrict:restrict,target_minimum_overdue_days:days});if(result.error)return{error:friendlyError(result.error.message)};
  refreshFinance(propertyId);return{success:"Política de mora actualizada."};
}

export async function setFinanceAccess(_: FinanceState, data: FormData): Promise<FinanceState> {
  const propertyId=field(data,"propertyId"),membershipId=field(data,"unitMembershipId"),enabled=field(data,"enabled")==="true";
  if(!uuidPattern.test(propertyId)||!uuidPattern.test(membershipId))return{error:"No encontramos el vínculo."};
  const supabase=await createClient();const result=await supabase.rpc("set_unit_finance_access",{target_unit_membership_id:membershipId,target_enabled:enabled});if(result.error)return{error:friendlyError(result.error.message)};
  refreshFinance(propertyId);revalidatePath(`/panel/propiedades/${propertyId}/miembros`);return{success:enabled?"Acceso financiero habilitado.":"Acceso financiero retirado."};
}

function normalizeHeader(value: CellValue | null) { return String(value??"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,"_"); }
function dateValue(value: CellValue | null) { if(value instanceof Date)return value.toISOString().slice(0,10);const text=String(value??"").trim();return isoDatePattern.test(text)?text:""; }
function textValue(value: CellValue | null) { return String(value??"").trim(); }

export async function importReceivables(_: FinanceState, data: FormData): Promise<FinanceState> {
  const propertyId=field(data,"propertyId"),file=data.get("file");
  if(!uuidPattern.test(propertyId)||!(file instanceof File)||file.size===0||file.size>2*1024*1024||!file.name.toLowerCase().endsWith(".xlsx"))return{error:"Selecciona un archivo .xlsx de máximo 2 MB."};
  const { supabase } = await requirePropertyAdmin(propertyId);
  try {
    const archive = boundedXlsx(new Uint8Array(await file.arrayBuffer()));
    const rows=await readSheet(Buffer.from(archive));
    if(rows.length<2||rows.length>501)return{error:"El archivo debe contener encabezados y entre 1 y 500 filas."};
    const headers=rows[0].map(normalizeHeader);const required=["torre","apartamento","concepto","valor","fecha_emision","fecha_vencimiento","referencia","tipo"];
    if(required.some((name)=>!headers.includes(name)))return{error:`Faltan columnas. Usa la plantilla: ${required.join(", ")}.`};
    const index=Object.fromEntries(headers.map((name,position)=>[name,position]));
    const {data:units,error:unitError}=await supabase.from("units").select("id,code,buildings(name)").eq("property_id",propertyId).eq("status","active");if(unitError)return{error:friendlyError(unitError.message)};
    const unitMap=new Map((units??[]).map((unit)=>{const building=Array.isArray(unit.buildings)?unit.buildings[0]:unit.buildings;return[`${String(building?.name??"").trim().toLowerCase()}|${unit.code.trim().toLowerCase()}`,unit.id];}));
    const parsed=[] as {unit_id:string;concept:string;amount:number;issued_on:string;due_on:string;external_reference:string;source:string}[];const rowErrors:string[]=[];
    rows.slice(1).forEach((row,offset)=>{const line=offset+2,building=textValue(row[index.torre]),unitCode=textValue(row[index.apartamento]),concept=textValue(row[index.concepto]),amount=Number(row[index.valor]),issued=dateValue(row[index.fecha_emision]),due=dateValue(row[index.fecha_vencimiento]),reference=textValue(row[index.referencia]),kind=normalizeHeader(row[index.tipo]);const unitId=unitMap.get(`${building.toLowerCase()}|${unitCode.toLowerCase()}`);const source=kind==="saldo_inicial"?"opening_balance":kind==="obligacion"||kind==="import"?"import":"";if(!unitId||concept.length<2||concept.length>180||!Number.isFinite(amount)||amount<=0||!issued||!due||due<issued||!reference||reference.length>120||!source){rowErrors.push(`Fila ${line}`);return;}parsed.push({unit_id:unitId,concept,amount,issued_on:issued,due_on:due,external_reference:reference,source});});
    if(rowErrors.length)return{error:`Corrige ${rowErrors.slice(0,8).join(", ")}${rowErrors.length>8?" y otras filas":""}.`};
    const batchId=crypto.randomUUID();const result=await supabase.rpc("import_receivables",{target_property_id:propertyId,target_batch_id:batchId,target_rows:parsed});if(result.error)return{error:friendlyError(result.error.message)};
    refreshFinance(propertyId);redirect(`${financePath(propertyId)}?imported=${result.data??parsed.length}`);
  } catch(error) { if(error && typeof error==="object" && "digest" in error)throw error;return{error:"No pudimos leer el archivo. Descarga la plantilla y verifica que sea un .xlsx válido."}; }
}
