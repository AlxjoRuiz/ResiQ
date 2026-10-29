"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { conciergeUsername } from "@/lib/concierge/identity";
import type { Vehicle } from "@/lib/concierge/person";
import { useFormActionState } from "@/lib/forms/use-form-action-state";
import { COLOMBIA_TIME_ZONE, dateInputValue } from "@/lib/time-zone";
import { registerMaintenanceWorker, setMaintenanceWorkerStatus, type WorkerState } from "./actions";

const inputClass = "mt-1 h-11 w-full rounded-lg border bg-white px-3 text-sm";

const blankVehicle = (): Vehicle => ({ type: "", brand: "", model: "", plate: "" });

// Registro del trabajador de mantenimiento: mismos datos que el portero, usuario permanente y
// contraseña. Entra con el usuario o con su correo.
export function MaintenanceWorkerForm() {
  const [state, action, pending] = useFormActionState(registerMaintenanceWorker, undefined as WorkerState);
  const [firstName, setFirstName] = useState("");
  const [firstSurname, setFirstSurname] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [username, setUsername] = useState("");
  const suggestedUsername = conciergeUsername(firstName, firstSurname, documentNumber);
  const [birthDate, setBirthDate] = useState("");
  const [vehicle, setVehicle] = useState<Vehicle>(blankVehicle);
  const today = dateInputValue(new Date(), COLOMBIA_TIME_ZONE);
  const age = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4)) - (today.slice(5) < birthDate.slice(5) ? 1 : 0) : null;
  const vehicleStarted = Object.values(vehicle).some((field) => field.trim().length > 0);
  return <form onSubmit={action} className="grid gap-4 sm:grid-cols-2"><input type="hidden" name="vehicles" value={JSON.stringify(vehicleStarted ? [vehicle] : [])} />
    <label className="text-sm font-medium">Nombres<input className={inputClass} name="firstName" value={firstName} onChange={(event) => setFirstName(event.target.value)} required maxLength={60} autoComplete="given-name" placeholder="Uno o dos nombres" /></label>
    <label className="text-sm font-medium">Apellidos<input className={inputClass} name="firstSurname" value={firstSurname} onChange={(event) => setFirstSurname(event.target.value)} required maxLength={60} autoComplete="family-name" placeholder="Uno o dos apellidos" /></label>
    <label className="text-sm font-medium">Cédula<input className={inputClass} name="documentNumber" value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} inputMode="numeric" pattern="[0-9]{5,20}" required /></label>
    <label className="text-sm font-medium">Fecha de nacimiento<input className={inputClass} name="birthDate" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} required /></label>
    <p className="text-sm sm:col-span-2">Edad: <strong>{age === null ? "—" : `${age} años`}</strong></p>
    <label className="text-sm font-medium">Teléfono<input className={inputClass} name="phone" type="tel" autoComplete="tel" required placeholder="3001234567" /></label>
    <label className="text-sm font-medium">Correo<input className={inputClass} name="email" type="email" autoComplete="email" required maxLength={254} /></label>
    <label className="text-sm font-medium sm:col-span-2">Dirección (opcional)<input className={inputClass} name="address" maxLength={180} /></label>
    <div className="sm:col-span-2 rounded-lg border p-3 sm:p-4"><h3 className="text-sm font-semibold">Vehículo (opcional, máximo uno)</h3><p className="mt-1 text-xs text-muted-foreground">Si registras un vehículo, completa sus cuatro datos. Déjalos vacíos si el trabajador no tiene vehículo.</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{(["type", "brand", "model", "plate"] as const).map((key) => <label key={key} className="text-sm font-medium">{{ type: "Tipo", brand: "Marca", model: "Modelo", plate: "Placa" }[key]}<input className={inputClass} value={vehicle[key]} onChange={(event) => setVehicle((current) => ({ ...current, [key]: event.target.value }))} required={vehicleStarted} maxLength={60} /></label>)}</div>{vehicleStarted && <Button type="button" size="sm" variant="ghost" className="mt-3 text-destructive" onClick={() => setVehicle(blankVehicle())}>Quitar vehículo</Button>}</div>
    <section className="grid gap-4 rounded-lg border bg-secondary/20 p-3 sm:col-span-2 sm:p-4" aria-labelledby="acceso-trabajador"><div><h3 id="acceso-trabajador" className="text-base font-semibold">Acceso al sistema</h3><p className="mt-1 text-xs text-muted-foreground">Escribe y entrega al trabajador el usuario y la contraseña. Podrá entrar con el usuario o con su correo y solo verá el módulo de mantenimiento.</p></div><label className="text-sm font-medium">Usuario permanente<input className={inputClass} name="username" value={username} onChange={(event) => setUsername(event.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" required maxLength={122} aria-describedby="regla-usuario-trabajador" /><span id="regla-usuario-trabajador" className="mt-1 block text-xs text-muted-foreground">Escribe primer nombre + primer apellido + últimos 2 dígitos de la cédula, sin espacios ni tildes, en minúsculas. {suggestedUsername ? `Para estos datos: ${suggestedUsername}.` : "Completa nombre, apellido y cédula para ver el formato."}</span></label>{username.trim() && suggestedUsername && username.trim() !== suggestedUsername && <p role="alert" className="text-xs text-destructive">El usuario debe coincidir con {suggestedUsername}.</p>}<label className="text-sm font-medium">Contraseña permanente<input className={inputClass} name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /><span className="mt-1 block text-xs text-muted-foreground">Mínimo 12 caracteres, mayúscula, minúscula y número. Entrégala en privado; no se mostrará después.</span></label><label className="text-sm font-medium">Confirmar contraseña<input className={inputClass} name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label></section>
    <label className="flex items-start gap-2 text-sm sm:col-span-2"><input className="mt-1" type="checkbox" name="emailVerified" value="yes" required />Confirmo que verifiqué que este correo real pertenece al trabajador.</label>
    <div className="sm:col-span-2"><Button disabled={pending || !suggestedUsername || username.trim() !== suggestedUsername}>{pending ? "Registrando…" : "Registrar trabajador"}</Button></div>
    {state?.error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{state.error}</p>}
    {state?.success && <p role="status" className="text-sm text-primary sm:col-span-2">{state.success}</p>}
  </form>;
}

// Suspender o reactivar el acceso del trabajador (la ficha y el usuario se conservan).
export function MaintenanceWorkerStatusForm({ recordId, suspended }: { recordId: string; suspended: boolean }) {
  const [state, action, pending] = useFormActionState(setMaintenanceWorkerStatus, undefined as WorkerState);
  return <form onSubmit={action} className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4"><input type="hidden" name="recordId" value={recordId} /><input type="hidden" name="status" value={suspended ? "active" : "suspended"} />
    <Button size="sm" variant="outline" disabled={pending}>{pending ? "Guardando…" : suspended ? "Reactivar acceso" : "Suspender acceso"}</Button>
    {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}{state?.success && <p role="status" className="text-sm text-primary">{state.success}</p>}
  </form>;
}
