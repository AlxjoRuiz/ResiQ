import Link from "next/link";
import { notFound } from "next/navigation";
import { FinanceImportButtons } from "@/components/finance/finance-forms";
import { FinanceTowers, type FinanceTower } from "@/components/finance/finance-towers";
import { NewObligationCard } from "@/components/finance/new-obligation-card";
import { Card, CardContent } from "@/components/ui/card";
import { requirePropertyMember } from "@/lib/auth/require-property-member";
import { formatCop } from "@/lib/finance/constants";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

type Summary={unit_id:string;building_name:string;unit_code:string;total_amount:number|string;applied_amount:number|string;outstanding_balance:number|string;overdue_balance:number|string;oldest_due_on:string|null;overdue_days:number;account_status:string;unapplied_payments:number|string};

export default async function FinancePage({params,searchParams}:{params:Promise<{propertyId:string}>;searchParams:Promise<{imported?:string;skipped?:string}>}){
  const{propertyId}=await params;const{supabase,membership}=await requirePropertyMember(propertyId);const admin=membership.roles.includes("administrator"),member=membership.roles.includes("member");if(!admin&&!member)notFound();
  // Los avisos de mora ya no se calculan al abrir Cartera (era lo más lento de la página): los genera el trabajo
  // diario de las 8:00 a. m. (migración 20261112160000, 12/11/2026).
  const[{data:summaryData,error:summaryError},{data:agreementData},{data:policy},{data:conceptData},{data:pendingEvidenceData},{data:legalUnitData}]=await Promise.all([
    fetchAllRows((from,to)=>supabase.rpc("list_finance_account_summaries",{target_property_id:propertyId}).order("unit_id").range(from,to)),
    admin?supabase.from("payment_agreements").select("unit_id").eq("property_id",propertyId).eq("status","active"):Promise.resolve({data:[]}),
    admin?supabase.from("property_policies").select("minimum_overdue_days").eq("property_id",propertyId).maybeSingle():Promise.resolve({data:null}),
    fetchAllRows((from,to)=>supabase.rpc("list_unit_pending_concepts",{target_property_id:propertyId}).order("unit_id").range(from,to)),
    supabase.rpc("list_units_with_pending_evidence",{target_property_id:propertyId}),
    // Apartamentos «En cobro jurídico» (expediente abierto de la abogada, 03/11/2026); solo para el admin.
    admin?supabase.rpc("property_legal_units",{target_property_id:propertyId}):Promise.resolve({data:null}),
  ]);if(summaryError)throw summaryError;
  const summaries=((summaryData??[]) as Summary[]).sort((a,b)=>a.building_name.localeCompare(b.building_name,"es",{numeric:true})||a.unit_code.localeCompare(b.unit_code,"es",{numeric:true}));const pendingEvidence=new Set(Array.isArray(pendingEvidenceData)?pendingEvidenceData.map(String):[]);const legalUnits=new Set(Array.isArray(legalUnitData)?legalUnitData.map(String):[]);const conceptsByUnit=new Map(((conceptData??[]) as {unit_id:string;concepts:string[]}[]).map((row)=>[row.unit_id,row.concepts]));const withAgreement=new Set(((agreementData??[]) as {unit_id:string}[]).map((row)=>row.unit_id));
  const total=summaries.reduce((sum,row)=>sum+Number(row.outstanding_balance),0),overdue=summaries.reduce((sum,row)=>sum+Number(row.overdue_balance),0),overdueCount=summaries.filter((row)=>row.account_status==="overdue").length;const query=await searchParams,imported=Number(query.imported??0),skipped=Number(query.skipped??0);
  // Estado por apartamento (12/11/2026, pedido de Alejandro): una pestaña plegable por torre, de menor a mayor,
  // con sus apartamentos y su deuda. El resumen de cada torre dice cuántos están en mora y cuánto deben.
  const byName=(a:string,b:string)=>a.localeCompare(b,"es",{numeric:true});
  const towers=[...summaries.reduce((map,row)=>map.set(row.building_name,[...(map.get(row.building_name)??[]),row]),new Map<string,Summary[]>())]
    .sort(([a],[b])=>byName(a,b)).map(([name,rows])=>({name,rows:rows.sort((a,b)=>byName(a.unit_code,b.unit_code))}));
  const financeTowers:FinanceTower[]=towers.map((tower)=>({name:tower.name,units:tower.rows.map((row)=>({id:row.unit_id,code:row.unit_code,concepts:conceptsByUnit.get(row.unit_id)?.join(", ")??"",status:row.account_status,owed:Number(row.outstanding_balance),late:Number(row.overdue_balance),days:Number(row.overdue_days),legal:legalUnits.has(row.unit_id),dot:pendingEvidence.has(row.unit_id)}))}));
  const accounts=<section className="mt-8"><div className="mb-4"><p className="text-sm text-muted-foreground">{summaries.length} cuentas visibles · {towers.length} {towers.length===1?"torre":"torres"}</p><h2 className="text-2xl font-semibold tracking-tight">Estado por apartamento</h2></div>
    {!summaries.length?<p className="rounded-2xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">{admin?"No hay apartamentos activos.":"No tienes acceso financiero habilitado para ningún apartamento."}</p>
    :<FinanceTowers towers={financeTowers} propertyId={propertyId} admin={admin}/>}
  </section>;
  return <main className="mx-auto min-h-screen max-w-7xl px-5 py-8 sm:px-10"><header className="flex flex-wrap items-end justify-between gap-4 border-b pb-6"><div><Link href={`/panel/propiedades/${propertyId}/dashboard`} className="text-sm text-muted-foreground hover:text-foreground">← Volver al inicio</Link><p className="mt-5 text-xs font-semibold tracking-wider text-primary uppercase">Información financiera</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Cartera</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">{admin?"Registra obligaciones, pagos y acuerdos de pago, y controla la mora. Cada propietario o residente ve la cartera de su apartamento.":"Consulta únicamente los apartamentos para los que la administración habilitó tu acceso financiero."}</p></div>{admin&&<FinanceImportButtons propertyId={propertyId}/>}</header>{imported>0&&<p role="status" className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-primary">Se importaron {imported} obligaciones correctamente.{skipped>0?` Se saltaron ${skipped} que ya estaban cargadas.`:""}</p>}<section className="my-7 grid gap-4 sm:grid-cols-3"><Card><CardContent><p className="text-2xl font-semibold">{formatCop(total)}</p><p className="mt-1 text-sm text-muted-foreground">Saldo pendiente visible</p></CardContent></Card><Card><CardContent><p className="text-2xl font-semibold">{formatCop(overdue)}</p><p className="mt-1 text-sm text-muted-foreground">Saldo vencido</p></CardContent></Card><Card><CardContent><p className="text-2xl font-semibold">{overdueCount}</p><p className="mt-1 text-sm text-muted-foreground">Apartamentos en mora</p></CardContent></Card></section>{admin&&<section className="grid gap-6"><NewObligationCard propertyId={propertyId} units={summaries.map((row)=>({id:row.unit_id,label:`${row.building_name} · ${row.unit_code}`}))} arrears={summaries.map((row)=>({id:row.unit_id,label:`${row.building_name} · ${row.unit_code}`,balance:Number(row.outstanding_balance),overdueDays:Number(row.overdue_days),hasAgreement:withAgreement.has(row.unit_id)}))} policy={{days:policy?.minimum_overdue_days??30}}/></section>}{accounts}</main>;
}
