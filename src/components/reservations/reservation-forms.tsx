"use client";

import { useActionState, useState } from "react";
import {
  cancelReservation,
  createAmenityBlackout,
  createReservation,
  decideReservation,
  deleteAmenityBlackout,
  saveAmenity,
  updateReservationPolicy,
  type ReservationState,
} from "@/app/panel/propiedades/[propertyId]/reservas/actions";
import { Button } from "@/components/ui/button";
import { weekdayLabels } from "@/lib/reservations/constants";

const inputClass = "mt-2 h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const areaClass = "mt-2 min-h-24 w-full rounded-lg border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "block text-sm font-medium";

function Result({ state }: { state: ReservationState }) {
  if (state?.error) return <p role="alert" className="text-sm text-destructive">{state.error}</p>;
  if (state?.success) return <p role="status" className="text-sm text-primary">{state.success}</p>;
  return null;
}

export type AmenityHour = { weekday: number; opens_at: string; closes_at: string };
export type AmenityFormValue = { id: string; name: string; description: string | null; capacity: number; requires_approval: boolean; rules: string | null; slot_minutes: number; status: string; amenity_hours?: AmenityHour[] };

export function AmenityForm({ propertyId, amenity }: { propertyId: string; amenity?: AmenityFormValue }) {
  const [state, action, pending] = useActionState(saveAmenity, undefined as ReservationState);
  const configured = new Map((amenity?.amenity_hours ?? []).map((hour) => [hour.weekday, hour]));
  const [days, setDays] = useState(() => Object.fromEntries(weekdayLabels.map(([day]) => [day, configured.has(day) || !amenity])) as Record<number, boolean>);
  return <form action={action} className="grid gap-5">
    <input type="hidden" name="propertyId" value={propertyId}/><input type="hidden" name="amenityId" value={amenity?.id ?? ""}/>
    <div className="grid gap-5 sm:grid-cols-2"><label className={labelClass}>Nombre<input className={inputClass} name="name" defaultValue={amenity?.name} minLength={2} maxLength={100} required/></label><label className={labelClass}>Capacidad<input className={inputClass} name="capacity" type="number" min={1} max={10000} defaultValue={amenity?.capacity ?? 20} required/></label></div>
    <label className={labelClass}>Descripción<textarea className={areaClass} name="description" defaultValue={amenity?.description ?? ""} maxLength={1000}/></label>
    <div className="grid gap-5 sm:grid-cols-2"><label className={labelClass}>Duración de cada bloque<select className={inputClass} name="slotMinutes" defaultValue={amenity?.slot_minutes ?? 60}>{[15,30,45,60,90,120,180,240].map((value)=><option key={value} value={value}>{value} minutos</option>)}</select></label><label className={labelClass}>Estado<select className={inputClass} name="status" defaultValue={amenity?.status ?? "active"}><option value="active">Activa</option><option value="inactive">Inactiva</option></select></label></div>
    <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" name="requiresApproval" defaultChecked={amenity?.requires_approval ?? true}/>Requiere aprobación de administración</label>
    <fieldset className="grid gap-3"><legend className="text-sm font-semibold">Horario semanal</legend>{weekdayLabels.map(([day,label])=>{const hour=configured.get(day);return <div key={day} className="grid items-center gap-3 rounded-xl border p-3 sm:grid-cols-[8rem_1fr_1fr]"><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name={`day_${day}`} checked={days[day]} onChange={(event)=>setDays({...days,[day]:event.target.checked})}/>{label}</label><label className="text-xs text-muted-foreground">Abre<input className={inputClass} name={`opens_${day}`} type="time" defaultValue={hour?.opens_at?.slice(0,5) ?? "08:00"} disabled={!days[day]}/></label><label className="text-xs text-muted-foreground">Cierra<input className={inputClass} name={`closes_${day}`} type="time" defaultValue={hour?.closes_at?.slice(0,5) ?? "20:00"} disabled={!days[day]}/></label></div>})}</fieldset>
    <label className={labelClass}>Reglas de uso<textarea className={areaClass} name="rules" defaultValue={amenity?.rules ?? ""} maxLength={3000} placeholder="Aseo, ruido, elementos permitidos y demás condiciones"/></label>
    <div className="flex flex-wrap items-center gap-4"><Button disabled={pending}>{pending ? "Guardando…" : amenity ? "Guardar cambios" : "Crear zona"}</Button><Result state={state}/></div>
  </form>;
}

export function ReservationPolicyForm({ propertyId, pendingHoldMinutes }: { propertyId: string; pendingHoldMinutes: number }) {
  const [state, action, pending] = useActionState(updateReservationPolicy, undefined as ReservationState);
  return <form action={action} className="flex flex-wrap items-end gap-4"><input type="hidden" name="propertyId" value={propertyId}/><label className={labelClass}>Vigencia de solicitudes pendientes (minutos)<input className={`${inputClass} w-56`} name="pendingHoldMinutes" type="number" min={60} max={2880} step={30} defaultValue={pendingHoldMinutes} required/></label><Button disabled={pending}>{pending?"Guardando…":"Guardar política"}</Button><Result state={state}/></form>;
}

export function BlackoutForm({ propertyId, amenityId }: { propertyId: string; amenityId: string }) {
  const [state, action, pending] = useActionState(createAmenityBlackout, undefined as ReservationState);
  return <form action={action} className="grid gap-3 rounded-xl border bg-muted/30 p-4"><input type="hidden" name="propertyId" value={propertyId}/><input type="hidden" name="amenityId" value={amenityId}/><p className="text-sm font-semibold">Programar cierre</p><div className="grid gap-3 sm:grid-cols-2"><label className={labelClass}>Desde<input className={inputClass} name="startsAt" type="datetime-local" required/></label><label className={labelClass}>Hasta<input className={inputClass} name="endsAt" type="datetime-local" required/></label></div><label className={labelClass}>Motivo<input className={inputClass} name="reason" minLength={3} maxLength={500} required/></label><div className="flex flex-wrap items-center gap-4"><Button size="sm" variant="outline" disabled={pending}>{pending?"Programando…":"Programar cierre"}</Button><Result state={state}/></div></form>;
}

export function DeleteBlackoutForm({ propertyId, blackoutId }: { propertyId: string; blackoutId: string }) {
  const [state, action, pending] = useActionState(deleteAmenityBlackout, undefined as ReservationState);
  return <form action={action} className="flex flex-wrap items-center gap-3"><input type="hidden" name="propertyId" value={propertyId}/><input type="hidden" name="blackoutId" value={blackoutId}/><Button size="sm" variant="ghost" disabled={pending}>{pending?"Eliminando…":"Eliminar cierre"}</Button><Result state={state}/></form>;
}

export type ReservationAmenity = { id: string; name: string; capacity: number; requires_approval: boolean; slot_minutes: number };
export type ReservationUnit = { id: string; label: string };
export function CreateReservationForm({ propertyId, amenities, units }: { propertyId: string; amenities: ReservationAmenity[]; units: ReservationUnit[] }) {
  const [state, action, pending] = useActionState(createReservation, undefined as ReservationState);
  return <form action={action} className="grid gap-5"><input type="hidden" name="propertyId" value={propertyId}/><label className={labelClass}>Zona<select className={inputClass} name="amenityId" required><option value="">Selecciona una zona</option>{amenities.map((item)=><option key={item.id} value={item.id}>{item.name} · capacidad {item.capacity} · {item.requires_approval?"requiere aprobación":"confirmación inmediata"}</option>)}</select></label><label className={labelClass}>Apartamento<select className={inputClass} name="unitId" required><option value="">Selecciona</option>{units.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label><div className="grid gap-5 sm:grid-cols-2"><label className={labelClass}>Inicio<input className={inputClass} name="startsAt" type="datetime-local" required/></label><label className={labelClass}>Fin<input className={inputClass} name="endsAt" type="datetime-local" required/></label></div><label className={labelClass}>Asistentes<input className={inputClass} name="attendeeCount" type="number" min={1} defaultValue={1} required/></label><p className="text-xs text-muted-foreground">Las horas se interpretan en la zona horaria de la propiedad. El sistema valida horarios, cierres, capacidad y cruces antes de crear la reserva.</p><div className="flex flex-wrap items-center gap-4"><Button disabled={pending||amenities.length===0||units.length===0}>{pending?"Reservando…":"Crear reserva"}</Button><Result state={state}/></div></form>;
}

export function DecisionForm({ propertyId, reservationId }: { propertyId: string; reservationId: string }) {
  const [state, action, pending] = useActionState(decideReservation, undefined as ReservationState);
  return <form action={action} className="grid gap-3"><input type="hidden" name="propertyId" value={propertyId}/><input type="hidden" name="reservationId" value={reservationId}/><label className={labelClass}>Motivo si se rechaza<input className={inputClass} name="reason" maxLength={500}/></label><div className="flex flex-wrap items-center gap-2"><Button name="decision" value="approve" size="sm" disabled={pending}>Aprobar</Button><Button name="decision" value="reject" size="sm" variant="outline" disabled={pending}>Rechazar</Button><Result state={state}/></div></form>;
}

export function CancelReservationForm({ propertyId, reservationId }: { propertyId: string; reservationId: string }) {
  const [state, action, pending] = useActionState(cancelReservation, undefined as ReservationState);
  return <form action={action} className="grid gap-3"><input type="hidden" name="propertyId" value={propertyId}/><input type="hidden" name="reservationId" value={reservationId}/><label className={labelClass}>Motivo de cancelación<input className={inputClass} name="reason" minLength={3} maxLength={500} required/></label><div className="flex flex-wrap items-center gap-3"><Button size="sm" variant="outline" disabled={pending}>{pending?"Cancelando…":"Cancelar reserva"}</Button><Result state={state}/></div></form>;
}
