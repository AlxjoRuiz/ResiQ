"use client";

import { useActionState, useMemo, useState } from "react";
import { reviewVisit, cancelVisit, createVisit, registerVisitEntry, registerVisitExit, type VisitState } from "@/app/panel/propiedades/[propertyId]/visitas/actions";
import { Button } from "@/components/ui/button";
import { visitKinds } from "@/lib/visitors/constants";

export type VisitDirectoryRow={unit_id:string;unit_code:string;building_name:string;member_id:string|null;display_name:string|null};
const inputClass="mt-2 h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const areaClass="mt-2 min-h-24 w-full rounded-lg border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass="block text-sm font-medium";
function Result({state}:{state:VisitState}){if(state?.error)return <p role="alert" className="text-sm text-destructive">{state.error}</p>;if(state?.success)return <p role="status" className="text-sm text-primary">{state.success}</p>;return null;}

export function CreateVisitForm({propertyId,directory,timeZone}:{propertyId:string;directory:VisitDirectoryRow[];timeZone:string}){
  const [state,action,pending]=useActionState(createVisit,undefined as VisitState);const [unitId,setUnitId]=useState("");const [kind,setKind]=useState("personal");
  const [values,setValues]=useState({peopleCount:"1",visitorName:"",documentLastDigits:"",company:"",serviceType:"",scheduledStart:"",scheduledEnd:"",notes:""});
  const update=(name:keyof typeof values,value:string)=>setValues((previous)=>({...previous,[name]:value}));
  const units=useMemo(()=>Array.from(new Map(directory.map((row)=>[row.unit_id,{id:row.unit_id,label:`${row.building_name} · ${row.unit_code}`}])).values()),[directory]);

  return <form action={action} className="grid gap-5"><input type="hidden" name="propertyId" value={propertyId}/>
    <label className={labelClass}>Apartamento<select className={inputClass} name="unitId" value={unitId} onChange={(event)=>{setUnitId(event.target.value);}} required><option value="" disabled>Selecciona</option>{units.map((unit)=><option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label>
    <div className="grid gap-5 sm:grid-cols-2"><label className={labelClass}>Tipo<select className={inputClass} name="kind" value={kind} onChange={(event)=>setKind(event.target.value)}>{visitKinds.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className={labelClass}>Cantidad de personas<input className={inputClass} name="peopleCount" value={values.peopleCount} onChange={(event)=>update("peopleCount",event.target.value)} type="number" min={1} max={20} required/></label></div>
    <label className={labelClass}>Nombre del visitante<input className={inputClass} name="visitorName" value={values.visitorName} onChange={(event)=>update("visitorName",event.target.value)} minLength={2} maxLength={120} required/></label>
    <label className={labelClass}>Últimos dígitos del documento <span className="font-normal text-muted-foreground">(opcional)</span><input className={inputClass} name="documentLastDigits" value={values.documentLastDigits} onChange={(event)=>update("documentLastDigits",event.target.value)} inputMode="numeric" pattern="[0-9]{2,6}" maxLength={6}/><span className="mt-1 block text-xs font-normal text-muted-foreground">Entre 2 y 6 dígitos. Puedes repetirlos en otras solicitudes.</span></label>
    {kind==="maintenance"&&<div className="grid gap-5 sm:grid-cols-2"><label className={labelClass}>Empresa<input className={inputClass} name="company" value={values.company} onChange={(event)=>update("company",event.target.value)} maxLength={120}/></label><label className={labelClass}>Tipo de servicio<input className={inputClass} name="serviceType" value={values.serviceType} onChange={(event)=>update("serviceType",event.target.value)} maxLength={120} required placeholder="Plomería, internet, reparación…"/></label></div>}
    <p className="text-xs text-muted-foreground">Selecciona el horario del conjunto: {timeZone}.</p>
    <div className="grid gap-5 sm:grid-cols-2"><label className={labelClass}>Inicio de la visita<input className={inputClass} name="scheduledStart" value={values.scheduledStart} onChange={(event)=>update("scheduledStart",event.target.value)} type="datetime-local" required/></label><label className={labelClass}>Fin de la visita<input className={inputClass} name="scheduledEnd" value={values.scheduledEnd} onChange={(event)=>update("scheduledEnd",event.target.value)} type="datetime-local" required/></label></div>
    <label className={labelClass}>Observaciones<textarea className={areaClass} name="notes" value={values.notes} onChange={(event)=>update("notes",event.target.value)} maxLength={1000}/></label>
    <p className="text-xs text-muted-foreground">El documento completo no se almacena. La ventana puede durar máximo 24 horas.</p>
    <div className="flex items-center gap-4"><Button disabled={pending||!unitId}>{pending?"Enviando…":"Solicitar visita"}</Button><Result state={state}/></div>
  </form>;
}

function OperationForm({propertyId,visitorId,action,label,pendingLabel,placeholder}:{propertyId:string;visitorId:string;action:typeof registerVisitEntry;label:string;pendingLabel:string;placeholder:string}){const [state,formAction,pending]=useActionState(action,undefined as VisitState);return <form action={formAction} className="grid gap-3"><input type="hidden" name="propertyId" value={propertyId}/><input type="hidden" name="visitorId" value={visitorId}/><label className={labelClass}>Observaciones <span className="font-normal text-muted-foreground">(opcional)</span><textarea className={areaClass} name="notes" maxLength={1000} placeholder={placeholder}/></label><div className="flex items-center gap-4"><Button disabled={pending}>{pending?pendingLabel:label}</Button><Result state={state}/></div></form>}
export function VisitEntryForm(props:{propertyId:string;visitorId:string}){return <OperationForm {...props} action={registerVisitEntry} label="Registrar ingreso" pendingLabel="Registrando…" placeholder="Novedad al ingreso"/>;}
export function VisitExitForm(props:{propertyId:string;visitorId:string}){return <OperationForm {...props} action={registerVisitExit} label="Registrar salida" pendingLabel="Registrando…" placeholder="Novedad al salir"/>;}
export function CancelVisitForm({propertyId,visitorId}:{propertyId:string;visitorId:string}){const [state,action,pending]=useActionState(cancelVisit,undefined as VisitState);return <form action={action} className="grid gap-3"><input type="hidden" name="propertyId" value={propertyId}/><input type="hidden" name="visitorId" value={visitorId}/><label className={labelClass}>Motivo de cancelación<input className={inputClass} name="reason" minLength={3} maxLength={500} required/></label><div className="flex items-center gap-4"><Button variant="outline" disabled={pending}>{pending?"Cancelando…":"Cancelar visita"}</Button><Result state={state}/></div></form>}

export function ReviewVisitForm({propertyId,visitorId}:{propertyId:string;visitorId:string}){
  const [state,action,pending]=useActionState(reviewVisit,undefined as VisitState);
  return <form action={action} className="grid gap-4"><input type="hidden" name="propertyId" value={propertyId}/><input type="hidden" name="visitorId" value={visitorId}/><label className={labelClass}>Motivo de rechazo <span className="font-normal text-muted-foreground">(obligatorio para rechazar)</span><textarea className={areaClass} name="reason" maxLength={500}/></label><div className="flex flex-wrap gap-3"><Button name="decision" value="approve" disabled={pending}>Aceptar solicitud</Button><Button name="decision" value="reject" variant="outline" disabled={pending}>Rechazar solicitud</Button></div><Result state={state}/></form>;
}
