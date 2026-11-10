"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readSheet } from "read-excel-file/node";
import { createClient } from "@/lib/supabase/server";
import { requirePropertyAdmin } from "@/lib/auth/require-property-admin";
import { boundedXlsx } from "@/lib/finance/bounded-xlsx";
import { FINANCE_MAX_FILE_BYTES, FINANCE_MAX_FILE_LABEL, FINANCE_MAX_ROWS, financeXlsxLimits } from "@/lib/finance/import-limits";
import { parseReceivableRows, receivableColumnIndex, RECEIVABLE_REQUIRED_COLUMNS, unitKey } from "@/lib/finance/parse-receivables";

export type FinanceState = { error?: string; success?: string } | undefined;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const field = (data: FormData, name: string) => String(data.get(name) ?? "").trim();
const financePath = (propertyId: string) => `/panel/propiedades/${propertyId}/cartera`;

function friendlyError(message?: string) {
  if (message?.includes("not_authorized")) return "No tienes permiso para realizar esta acción.";
  // Mismo nombre (10/11/2026): solo se bloquea si la obligación anterior con ese nombre o referencia no está pagada.
  if (message?.includes("unpaid_duplicate")) return "Ya hay una obligación con ese nombre sin pagar en este apartamento. Cámbiale el nombre y regístrala con los mismos datos.";
  if (message?.includes("duplicate_payment")) return "El pago ya fue registrado.";
  // Pagos sin sobrante (10/11/2026): un pago no puede ser mayor que lo que debe el apartamento.
  if (message?.includes("payment_exceeds_debt")) return "El pago es mayor que lo que debe el apartamento. Registra como máximo el saldo pendiente.";
  if (message?.includes("payment_overallocated")) return "La distribución supera el valor del pago.";
  if (message?.includes("receivable_has_active_payment")) return "Anula primero los pagos aplicados antes de anular esta obligación.";
  if (message?.includes("receivable_overallocated")) return "La distribución supera el saldo de una obligación.";
  if (message?.includes("invalid_receivable")) return "Una obligación seleccionada ya no está disponible.";
  if (message?.includes("inactive_membership")) return "El vínculo ya no está vigente.";
  if (message?.includes("invalid_import")) return "El archivo debe contener al menos un registro.";
  if (message?.includes("no_active_agreement")) return "El apartamento no tiene un acuerdo de pago activo.";
  if (message?.includes("already_added")) return "Esa deuda ya está sumada al acuerdo.";
  if (message?.includes("no_pending_installments")) return "El acuerdo no tiene cuotas pendientes.";
  if (message?.includes("agreement_total_mismatch")) return "Las cuotas deben sumar exactamente el saldo de las deudas elegidas.";
  if (message?.includes("agreement_payment_mismatch")) return "El pago de una cuota debe quedar aplicado completo a las deudas del acuerdo y no puede pasar de lo que falta.";
  if (message?.includes("agreement_not_active")) return "Ese acuerdo de pago ya no está vigente.";
  if (message?.includes("agreement_exists")) return "Este apartamento ya tiene un acuerdo de pago activo. Cancélalo antes de crear otro.";
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
  if(result.error)return{error:result.error.message.includes("unpaid_duplicate")?`Ya hay una obligación «${concept}» sin pagar en este apartamento. Cámbiale el nombre (por ejemplo, «${concept} 2»)${externalReference?" y la referencia":""} y regístrala con los mismos datos.`:friendlyError(result.error.message)};
  // Opcional: sumar la obligación nueva al acuerdo de pago activo del apartamento.
  if(field(data,"addToAgreement")==="on"&&result.data){const added=await supabase.rpc("add_receivable_to_payment_agreement",{target_receivable_id:String(result.data)});if(added.error){refreshFinance(propertyId,unitId);return{error:`La obligación se registró, pero no se pudo sumar al acuerdo: ${friendlyError(added.error.message)}`};}refreshFinance(propertyId,unitId);return{success:"Obligación registrada y sumada al acuerdo de pago."};}
  refreshFinance(propertyId,unitId);return{success:"Obligación registrada."};
}

export async function recordPayment(_: FinanceState, data: FormData): Promise<FinanceState> {
  const propertyId=field(data,"propertyId"),unitId=field(data,"unitId"),paidOn=field(data,"paidOn"),reference=field(data,"reference");const amount=Number(field(data,"amount"));
  const allocations=data.getAll("receivableId").map(String).flatMap((receivableId)=>{const value=Number(field(data,`allocation_${receivableId}`));return value>0?[{receivable_id:receivableId,amount:value}]:[];});
  if(!uuidPattern.test(propertyId)||!uuidPattern.test(unitId)||!Number.isFinite(amount)||amount<=0||!isoDatePattern.test(paidOn)||allocations.some((item)=>!uuidPattern.test(item.receivable_id)))return{error:"Completa un pago válido."};
  const allocated=allocations.reduce((sum,item)=>sum+item.amount,0);if(allocated>amount+0.001)return{error:"La distribución supera el valor del pago."};
  // Desde un comprobante: el pago queda amarrado a él y no se puede registrar dos veces.
  const evidenceId=field(data,"evidenceId");if(evidenceId&&!uuidPattern.test(evidenceId))return{error:"Comprobante inválido."};
  const supabase=await createClient();const result=evidenceId
    ?await supabase.rpc("record_evidence_payment",{target_evidence_id:evidenceId,target_amount:amount,target_paid_on:paidOn,target_reference:reference,target_allocations:allocations})
    :await supabase.rpc("record_payment",{target_property_id:propertyId,target_unit_id:unitId,target_amount:amount,target_paid_on:paidOn,target_reference:reference,target_allocations:allocations,target_idempotency_key:crypto.randomUUID()});
  if(result.error)return{error:result.error.message.includes("evidence_already_registered")?"Ese comprobante ya tiene un pago registrado.":friendlyError(result.error.message)};
  refreshFinance(propertyId,unitId);return{success:evidenceId?"Pago del comprobante registrado y distribuido.":"Pago registrado y distribuido."};
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
  const propertyId=field(data,"propertyId"),days=Number(field(data,"minimumOverdueDays"));
  if(!uuidPattern.test(propertyId)||!Number.isInteger(days)||days<0||days>3650)return{error:"Configura un número de días válido."};
  const supabase=await createClient();const result=await supabase.rpc("update_finance_policy",{target_property_id:propertyId,target_restrict:true,target_minimum_overdue_days:days});if(result.error)return{error:friendlyError(result.error.message)};
  refreshFinance(propertyId);return{success:"Política de mora actualizada."};
}

// Suma una obligación creada después del acuerdo a sus cuotas pendientes.
export async function addReceivableToAgreement(_: FinanceState, data: FormData): Promise<FinanceState> {
  const propertyId=field(data,"propertyId"),unitId=field(data,"unitId"),receivableId=field(data,"receivableId");
  if(![propertyId,unitId,receivableId].every((value)=>uuidPattern.test(value)))return{error:"Elige una deuda."};
  const supabase=await createClient();const result=await supabase.rpc("add_receivable_to_payment_agreement",{target_receivable_id:receivableId});if(result.error)return{error:friendlyError(result.error.message)};
  refreshFinance(propertyId,unitId);return{success:"Deuda sumada al acuerdo."};
}

// Acuerdo de pago (05/11/2026): las deudas que cubre y las cuotas; la base de datos exige que sumen lo mismo.
export async function createPaymentAgreement(_: FinanceState, data: FormData): Promise<FinanceState> {
  const propertyId=field(data,"propertyId"),unitId=field(data,"unitId"),notes=field(data,"notes");
  let installments:{amount:number;due_on:string}[]=[];let receivableIds:string[]=[];
  try{const parsed:unknown=JSON.parse(field(data,"receivableIds")||"[]");if(Array.isArray(parsed))receivableIds=parsed.map(String);}catch{receivableIds=[];}
  if(!receivableIds.length||receivableIds.length>200||receivableIds.some((id)=>!uuidPattern.test(id)))return{error:"Elige las deudas que entran al acuerdo."};
  try{const parsed:unknown=JSON.parse(field(data,"installments")||"[]");if(Array.isArray(parsed))installments=parsed.map((item)=>({amount:Number((item as {amount?:unknown}).amount),due_on:String((item as {due_on?:unknown}).due_on??"")}));}catch{installments=[];}
  if(!uuidPattern.test(propertyId)||!uuidPattern.test(unitId)||installments.length<1||installments.length>120||installments.some((item)=>!Number.isFinite(item.amount)||item.amount<=0||!isoDatePattern.test(item.due_on))||(notes&&(notes.length<3||notes.length>1000)))return{error:"Revisa las cuotas: cada una necesita valor y fecha. La nota debe tener entre 3 y 1000 caracteres."};
  const supabase=await createClient();const result=await supabase.rpc("create_payment_agreement",{target_property_id:propertyId,target_unit_id:unitId,target_notes:notes||null,target_installments:installments,target_receivable_ids:receivableIds});if(result.error)return{error:friendlyError(result.error.message)};
  refreshFinance(propertyId,unitId);return{success:"Acuerdo de pago registrado."};
}

export async function cancelPaymentAgreement(_: FinanceState, data: FormData): Promise<FinanceState> {
  const propertyId=field(data,"propertyId"),unitId=field(data,"unitId"),agreementId=field(data,"agreementId"),reason=field(data,"reason");
  if(![propertyId,unitId,agreementId].every((value)=>uuidPattern.test(value))||reason.length<4||reason.length>1000)return{error:"Escribe un motivo de al menos 4 caracteres."};
  const supabase=await createClient();const result=await supabase.rpc("cancel_payment_agreement",{target_agreement_id:agreementId,target_reason:reason});if(result.error)return{error:friendlyError(result.error.message)};
  refreshFinance(propertyId,unitId);return{success:"Acuerdo cancelado."};
}

export async function importReceivables(_: FinanceState, data: FormData): Promise<FinanceState> {
  const propertyId=field(data,"propertyId"),file=data.get("file");
  if(!uuidPattern.test(propertyId)||!(file instanceof File)||file.size===0||file.size>FINANCE_MAX_FILE_BYTES||!file.name.toLowerCase().endsWith(".xlsx"))return{error:`Selecciona un archivo .xlsx de máximo ${FINANCE_MAX_FILE_LABEL}.`};
  const { supabase } = await requirePropertyAdmin(propertyId);
  try {
    const archive = boundedXlsx(new Uint8Array(await file.arrayBuffer()), 32, financeXlsxLimits);
    const rows=await readSheet(Buffer.from(archive));
    if(rows.length<2||rows.length>FINANCE_MAX_ROWS+1)return{error:`El archivo debe contener encabezados y entre 1 y ${FINANCE_MAX_ROWS} filas.`};
    const index=receivableColumnIndex(rows[0]);
    if(!index)return{error:`Faltan columnas. Usa la plantilla: ${RECEIVABLE_REQUIRED_COLUMNS.join(", ")}.`};
    const {data:units,error:unitError}=await supabase.from("units").select("id,code,buildings(name)").eq("property_id",propertyId).eq("status","active");if(unitError)return{error:friendlyError(unitError.message)};
    const unitMap=new Map((units??[]).map((unit)=>{const building=Array.isArray(unit.buildings)?unit.buildings[0]:unit.buildings;return[unitKey(String(building?.name??""),unit.code),unit.id];}));
    const {rows:parsed,rowErrors}=parseReceivableRows(rows.slice(1),index,unitMap);
    if(rowErrors.length)return{error:`Corrige ${rowErrors.slice(0,8).join(", ")}${rowErrors.length>8?" y otras filas":""}.`};
    // Sin columna «referencia», cada fila se identifica por apartamento, concepto, emisión y valor;
    // la base de datos salta las que ya están cargadas (o repetidas en el archivo).
    const batchId=crypto.randomUUID();const result=await supabase.rpc("import_receivables",{target_property_id:propertyId,target_batch_id:batchId,target_rows:parsed});if(result.error)return{error:friendlyError(result.error.message)};
    const imported=Number(result.data??0);if(imported===0)return{error:"Todas las obligaciones del archivo ya estaban cargadas; no se agregó nada."};
    refreshFinance(propertyId);redirect(`${financePath(propertyId)}?imported=${imported}&skipped=${parsed.length-imported}`);
  } catch(error) { if(error && typeof error==="object" && "digest" in error)throw error;return{error:"No pudimos leer el archivo. Descarga la plantilla y verifica que sea un .xlsx válido."}; }
}
