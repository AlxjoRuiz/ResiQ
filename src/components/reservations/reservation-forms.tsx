"use client";

import { useActionState, useRef, useState } from "react";
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
import { DateTimeField } from "@/components/ui/date-time-field";
import { slotDurationHoursLabel, weekdayLabels } from "@/lib/reservations/constants";

const inputClass = "mt-2 block box-border h-11 min-w-0 w-full max-w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const areaClass = "mt-2 min-h-24 w-full rounded-lg border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "block min-w-0 text-sm font-medium";
const timeChoices = Array.from({ length: 96 }, (_, index) => `${String(Math.floor(index / 4)).padStart(2, "0")}:${String((index % 4) * 15).padStart(2, "0")}`);
function TimeChoice({ name, value, disabled }: { name: string; value: string; disabled: boolean }) {
  return <select className={inputClass} name={name} defaultValue={value} disabled={disabled}>
    {!timeChoices.includes(value) && <option value={value}>{value}</option>}
    {timeChoices.map((time) => <option key={time} value={time}>{time}</option>)}
  </select>;
}

function ClosurePicker({ name, type, label }: { name: string; type: "date" | "time"; label: string }) {
  const [value, setValue] = useState("");
  const display = type === "date" && value ? value.split("-").reverse().join("/") : value;
  return <label className="block min-w-0 text-xs text-muted-foreground">{label}
    <span className="relative mt-2 flex h-11 min-w-0 items-center overflow-hidden rounded-lg border bg-white px-3 text-base text-foreground focus-within:ring-2 focus-within:ring-ring">
      <span className="block min-w-0 truncate">{display || (type === "date" ? "Selecciona la fecha" : "Selecciona la hora")}</span>
      <input className="absolute inset-0 h-full w-full min-w-0 cursor-pointer opacity-0" name={name} type={type} value={value} onChange={(event) => setValue(event.target.value)} onClick={(event) => { try { event.currentTarget.showPicker?.(); } catch { /* Safari opens its native picker on focus. */ } }} required aria-label={label}/>
    </span>
  </label>;
}

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
  const legacySlot = amenity && amenity.slot_minutes % 60 !== 0;
  return <form action={action} className="grid gap-5">
    <input type="hidden" name="propertyId" value={propertyId}/><input type="hidden" name="amenityId" value={amenity?.id ?? ""}/>
    <div className="grid gap-5 sm:grid-cols-2"><label className={labelClass}>Nombre<input className={inputClass} name="name" defaultValue={amenity?.name} minLength={2} maxLength={100} required/></label><label className={labelClass}>Capacidad<input className={inputClass} name="capacity" type="number" min={1} max={10000} defaultValue={amenity?.capacity ?? 20} required/></label></div>
    <label className={labelClass}>Descripción<textarea className={areaClass} name="description" defaultValue={amenity?.description ?? ""} maxLength={1000}/></label>
    <div className="grid gap-5 sm:grid-cols-2"><label className={labelClass}>Duración máxima por reserva (horas)<select className={inputClass} name="slotMinutes" defaultValue={legacySlot ? "" : amenity?.slot_minutes ?? 60} required>{legacySlot && <option value="" disabled>Selecciona una duración en horas completas</option>}{Array.from({ length: 24 }, (_, index) => (index + 1) * 60).map((value)=><option key={value} value={value}>{slotDurationHoursLabel(value)}</option>)}</select>{legacySlot && <span className="text-xs text-muted-foreground">Selecciona una duración en horas completas antes de guardar esta zona.</span>}</label><label className={labelClass}>Estado<select className={inputClass} name="status" defaultValue={amenity?.status ?? "active"}><option value="active">Activa</option><option value="inactive">Inactiva</option></select></label></div>
    <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" name="requiresApproval" defaultChecked={amenity?.requires_approval ?? true}/>Requiere aprobación de administración</label>
    <fieldset className="min-w-0 space-y-3"><legend className="text-sm font-semibold">Horario semanal</legend><p className="text-xs text-muted-foreground">Si «Cierra» es anterior a «Abre», el horario termina al día siguiente. Si son iguales, la zona permanece abierta 24 horas.</p>{weekdayLabels.map(([day,label])=>{const hour=configured.get(day);return <div key={day} className="min-w-0 space-y-3 rounded-xl border p-3"><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name={`day_${day}`} checked={days[day]} onChange={(event)=>setDays({...days,[day]:event.target.checked})}/>{label}</label><div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2"><label className="block min-w-0 text-xs text-muted-foreground">Abre<TimeChoice name={`opens_${day}`} value={hour?.opens_at?.slice(0,5) ?? "08:00"} disabled={!days[day]}/></label><label className="block min-w-0 text-xs text-muted-foreground">Cierra<TimeChoice name={`closes_${day}`} value={hour?.closes_at?.slice(0,5) ?? "20:00"} disabled={!days[day]}/></label></div></div>})}</fieldset>
    <label className={labelClass}>Reglas de uso<textarea className={areaClass} name="rules" defaultValue={amenity?.rules ?? ""} maxLength={3000} placeholder="Aseo, ruido, elementos permitidos y demás condiciones"/></label>
    <div className="flex flex-wrap items-center gap-4"><Button disabled={pending}>{pending ? "Guardando…" : amenity ? "Guardar cambios" : "Crear zona"}</Button><Result state={state}/></div>
  </form>;
}

export function ReservationPolicyForm({ propertyId, pendingHoldMinutes }: { propertyId: string; pendingHoldMinutes: number }) {
  const [state, action, pending] = useActionState(updateReservationPolicy, undefined as ReservationState);
  return <form action={action} className="flex flex-wrap items-end gap-4"><input type="hidden" name="propertyId" value={propertyId}/><label className={labelClass}>Vigencia de solicitudes pendientes (horas)<input className={`${inputClass} w-56`} name="pendingHoldHours" type="number" min={1} max={48} step={0.5} defaultValue={pendingHoldMinutes / 60} required/></label><Button disabled={pending}>{pending?"Guardando…":"Guardar política"}</Button><Result state={state}/></form>;
}

export function BlackoutForm({ propertyId, amenityId }: { propertyId: string; amenityId: string }) {
  const [state, action, pending] = useActionState(createAmenityBlackout, undefined as ReservationState);
  return <form action={action} className="-mx-4 grid min-w-0 gap-3 rounded-xl border bg-muted/30 p-2 sm:mx-0 sm:p-4">
    <input type="hidden" name="propertyId" value={propertyId}/><input type="hidden" name="amenityId" value={amenityId}/>
    <p className="text-sm font-semibold">Programar cierre</p>
    <div className="grid min-w-0 gap-3 lg:grid-cols-2">
      <fieldset className="grid min-w-0 gap-2 rounded-lg border p-3"><legend className="px-1 text-sm font-medium">Inicio</legend><ClosurePicker name="startsDate" type="date" label="Fecha de inicio"/><ClosurePicker name="startsTime" type="time" label="Hora de inicio"/></fieldset>
      <fieldset className="grid min-w-0 gap-2 rounded-lg border p-3"><legend className="px-1 text-sm font-medium">Fin</legend><ClosurePicker name="endsDate" type="date" label="Fecha de fin"/><ClosurePicker name="endsTime" type="time" label="Hora de fin"/></fieldset>
    </div>
    <label className={labelClass}>Motivo del cierre (visible para residentes)<input className={inputClass} name="reason" minLength={3} maxLength={500} required/></label>
    <div className="flex flex-wrap items-center gap-4"><Button size="sm" variant="outline" disabled={pending}>{pending?"Programando…":"Programar cierre"}</Button><Result state={state}/></div>
  </form>;
}

export function DeleteBlackoutForm({ propertyId, blackoutId }: { propertyId: string; blackoutId: string }) {
  const [state, action, pending] = useActionState(deleteAmenityBlackout, undefined as ReservationState);
  return <form action={action} className="flex flex-wrap items-center gap-3"><input type="hidden" name="propertyId" value={propertyId}/><input type="hidden" name="blackoutId" value={blackoutId}/><Button size="sm" variant="ghost" disabled={pending}>{pending?"Eliminando…":"Eliminar cierre"}</Button><Result state={state}/></form>;
}

export type ReservationAmenity = { id: string; name: string; capacity: number; requires_approval: boolean; slot_minutes: number };
export type ReservationUnit = { id: string; label: string };
export function CreateReservationForm({ propertyId, amenities, units, amenityId, onAmenityChange }: { propertyId: string; amenities: ReservationAmenity[]; units: ReservationUnit[]; amenityId: string; onAmenityChange: (amenityId: string) => void }) {
  const [state, action, pending] = useActionState(createReservation, undefined as ReservationState);
  const [draft, setDraft] = useState({ unitId: "", startsAt: "", endsAt: "", attendeeCount: "1", purpose: "" });
  const [purposeError, setPurposeError] = useState("");
  const purposeRef = useRef<HTMLTextAreaElement>(null);
  function update(field: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    if (field === "purpose" && value.trim().length >= 3) setPurposeError("");
  }
  return <form action={action} className="grid gap-5" onSubmit={(event) => {
    if (draft.purpose.trim().length >= 3) return;
    event.preventDefault();
    setPurposeError("El motivo debe tener al menos 3 caracteres.");
    purposeRef.current?.focus();
  }}>
    <input type="hidden" name="propertyId" value={propertyId}/>
    <label className={labelClass}>Zona<select className={inputClass} name="amenityId" value={amenityId} onChange={(event) => onAmenityChange(event.target.value)} required><option value="">Selecciona una zona</option>{amenities.map((item)=><option key={item.id} value={item.id}>{item.name} · máximo {slotDurationHoursLabel(item.slot_minutes)} · capacidad {item.capacity} · {item.requires_approval?"requiere aprobación":"confirmación inmediata"}</option>)}</select></label>
    <label className={labelClass}>Apartamento<select className={inputClass} name="unitId" value={draft.unitId} onChange={(event) => update("unitId", event.target.value)} required><option value="">Selecciona</option>{units.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <div className="grid min-w-0 gap-5 sm:grid-cols-2">
      <DateTimeField name="startsAt" label="Inicio" value={draft.startsAt} onChange={(value) => update("startsAt", value)}/>
      <DateTimeField name="endsAt" label="Fin" value={draft.endsAt} onChange={(value) => update("endsAt", value)}/>
    </div>
    <label className={labelClass}>Asistentes<input className={inputClass} name="attendeeCount" type="number" min={1} value={draft.attendeeCount} onChange={(event) => update("attendeeCount", event.target.value)} required/></label>
    <label className={labelClass}>Motivo de la reserva<textarea ref={purposeRef} className={areaClass} name="purpose" maxLength={500} value={draft.purpose} onChange={(event) => update("purpose", event.target.value)} aria-invalid={Boolean(purposeError)} aria-describedby={purposeError ? "reservation-purpose-error" : undefined} placeholder="Cuéntanos para qué usarás la zona"/>
      {purposeError && <span id="reservation-purpose-error" role="alert" className="mt-2 block text-sm text-destructive">{purposeError}</span>}
    </label>
    <p className="text-xs text-muted-foreground">Las horas se interpretan en la zona horaria de la propiedad. Puedes elegir una duración menor que el máximo de la zona y terminar al día siguiente si su horario lo permite. El sistema valida horarios, cierres, capacidad y cruces antes de crear la reserva.</p>
    <div className="flex flex-wrap items-center gap-4"><Button disabled={pending||amenities.length===0||units.length===0}>{pending?"Reservando…":"Crear reserva"}</Button><Result state={state}/></div>
  </form>;
}

export function DecisionForm({ propertyId, reservationId }: { propertyId: string; reservationId: string }) {
  const [state, action, pending] = useActionState(decideReservation, undefined as ReservationState);
  return <form action={action} className="grid gap-3"><input type="hidden" name="propertyId" value={propertyId}/><input type="hidden" name="reservationId" value={reservationId}/><label className={labelClass}>Mensaje para el residente al aprobar o rechazar<textarea className={areaClass} name="reason" minLength={3} maxLength={500} required/></label><div className="flex flex-wrap items-center gap-2"><Button name="decision" value="approve" size="sm" disabled={pending}>Aprobar</Button><Button name="decision" value="reject" size="sm" variant="outline" disabled={pending}>Rechazar</Button><Result state={state}/></div></form>;
}

export function CancelReservationForm({ propertyId, reservationId }: { propertyId: string; reservationId: string }) {
  const [state, action, pending] = useActionState(cancelReservation, undefined as ReservationState);
  return <form action={action} className="grid gap-3"><input type="hidden" name="propertyId" value={propertyId}/><input type="hidden" name="reservationId" value={reservationId}/><label className={labelClass}>Motivo de cancelación<input className={inputClass} name="reason" minLength={3} maxLength={500} required/></label><div className="flex flex-wrap items-center gap-3"><Button size="sm" variant="outline" disabled={pending}>{pending?"Cancelando…":"Cancelar reserva"}</Button><Result state={state}/></div></form>;
}
