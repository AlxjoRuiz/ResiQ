"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { conciergeUsername } from "@/lib/concierge/identity";
import { COLOMBIA_TIME_ZONE, dateInputValue } from "@/lib/time-zone";
import { registerConcierge, type ConciergeState } from "./concierge-actions";

type Vehicle = { type: string; brand: string; model: string; plate: string };
const input = "mt-1 h-11 w-full rounded-lg border bg-white px-3 text-sm";
const blankVehicle = (): Vehicle => ({ type: "", brand: "", model: "", plate: "" });

export function ConciergeRegistrationForm({ propertyId }: { propertyId: string }) {
  const [state, action, pending] = useActionState(registerConcierge, undefined as ConciergeState);
  const [firstName, setFirstName] = useState("");
  const [firstSurname, setFirstSurname] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const username = conciergeUsername(firstName, firstSurname, documentNumber);
  const today = dateInputValue(new Date(), COLOMBIA_TIME_ZONE);
  const birth = birthDate ? new Date(`${birthDate}T12:00:00Z`) : null;
  const age = birth && !Number.isNaN(birth.getTime()) ? Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4)) - (today.slice(5) < birthDate.slice(5) ? 1 : 0) : null;
  function changeVehicle(index: number, key: keyof Vehicle, value: string) {
    setVehicles((current) => current.map((vehicle, item) => item === index ? { ...vehicle, [key]: value } : vehicle));
  }
  return <form action={action} className="grid gap-4 sm:grid-cols-2">
    <input type="hidden" name="propertyId" value={propertyId} />
    <input type="hidden" name="vehicles" value={JSON.stringify(vehicles)} />
    <label className="text-sm font-medium sm:col-span-2">Nombre completo<input className={input} name="fullName" required maxLength={120} autoComplete="name" /></label>
    <label className="text-sm font-medium">Primer nombre<input className={input} name="firstName" value={firstName} onChange={(event) => setFirstName(event.target.value)} required maxLength={60} /></label>
    <label className="text-sm font-medium">Primer apellido<input className={input} name="firstSurname" value={firstSurname} onChange={(event) => setFirstSurname(event.target.value)} required maxLength={60} /></label>
    <label className="text-sm font-medium">Cédula<input className={input} name="documentNumber" value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} inputMode="numeric" pattern="[0-9]{5,20}" required /></label>
    <label className="text-sm font-medium">Fecha de nacimiento<input className={input} name="birthDate" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} required /></label>
    <p className="text-sm sm:col-span-2">Edad: <strong>{age === null ? "—" : `${age} años`}</strong></p>
    <label className="text-sm font-medium">Teléfono<input className={input} name="phone" type="tel" autoComplete="tel" required placeholder="3001234567" /></label>
    <label className="text-sm font-medium">Correo real del portero<input className={input} name="email" type="email" autoComplete="email" required /></label>
    <label className="text-sm font-medium sm:col-span-2">Dirección (opcional)<input className={input} name="address" maxLength={180} /></label>
    <label className="text-sm font-medium sm:col-span-2">Fotografía (opcional, máximo 1 MB)<input className="mt-1 block w-full text-sm" name="photo" type="file" accept="image/png,image/jpeg,image/webp" /></label>
    <div className="sm:col-span-2 rounded-lg border p-3"><p className="text-sm font-medium">Vehículos ({vehicles.length})</p>{vehicles.map((vehicle, index) => <div key={index} className="mt-3 grid gap-2 sm:grid-cols-4">{(["type", "brand", "model", "plate"] as const).map((key) => <label key={key} className="text-xs">{{ type: "Tipo", brand: "Marca", model: "Modelo", plate: "Placa" }[key]}<input className={input} value={vehicle[key]} onChange={(event) => changeVehicle(index, key, event.target.value)} required maxLength={60} /></label>)}<button type="button" className="text-left text-sm text-destructive sm:col-span-4" onClick={() => setVehicles((current) => current.filter((_, item) => item !== index))}>Quitar vehículo</button></div>)}<Button type="button" variant="outline" className="mt-3" disabled={vehicles.length >= 10} onClick={() => setVehicles((current) => [...current, blankVehicle()])}>Agregar vehículo</Button></div>
    <div className="sm:col-span-2 rounded-lg border bg-secondary/30 p-3"><p className="text-sm">Usuario permanente: <strong>{username ?? "Completa primer nombre, apellido y cédula"}</strong></p><p className="mt-1 text-xs text-muted-foreground">Si ya existe en ResiQ, el registro se detendrá; no se creará un usuario con sufijo.</p></div>
    <label className="text-sm font-medium sm:col-span-2">Contraseña permanente asignada por administración<input className={input} name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /><span className="mt-1 block text-xs text-muted-foreground">Mínimo 12 caracteres, mayúscula, minúscula y número. Entrégala en privado; no se mostrará después.</span></label>
    <label className="text-sm font-medium sm:col-span-2">Confirmar contraseña<input className={input} name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
    <label className="flex items-start gap-2 text-sm sm:col-span-2"><input className="mt-1" type="checkbox" name="emailVerified" value="yes" required />Confirmo que verifiqué que este correo real pertenece al portero.</label>
    <div className="sm:col-span-2"><Button disabled={pending || !username}>{pending ? "Registrando…" : "Registrar portero"}</Button></div>
    {state?.error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{state.error}</p>}
    {state?.success && <p role="status" className="text-sm text-primary sm:col-span-2">{state.success}</p>}
  </form>;
}
