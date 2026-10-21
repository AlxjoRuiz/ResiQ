"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
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
  const [username, setUsername] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [vehicle, setVehicle] = useState<Vehicle>(blankVehicle);
  const photoInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const suggestedUsername = conciergeUsername(firstName, firstSurname, documentNumber);
  const today = dateInputValue(new Date(), COLOMBIA_TIME_ZONE);
  const birth = birthDate ? new Date(`${birthDate}T12:00:00Z`) : null;
  const age = birth && !Number.isNaN(birth.getTime()) ? Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4)) - (today.slice(5) < birthDate.slice(5) ? 1 : 0) : null;
  const vehicleStarted = Object.values(vehicle).some((field) => field.trim().length > 0);
  return <form action={action} className="grid gap-4 sm:grid-cols-2">
    <input type="hidden" name="propertyId" value={propertyId} />
    <input type="hidden" name="vehicles" value={JSON.stringify(vehicleStarted ? [vehicle] : [])} />
    <label className="text-sm font-medium">Nombres<input className={input} name="firstName" value={firstName} onChange={(event) => setFirstName(event.target.value)} required maxLength={60} autoComplete="given-name" placeholder="Uno o dos nombres" /></label>
    <label className="text-sm font-medium">Apellidos<input className={input} name="firstSurname" value={firstSurname} onChange={(event) => setFirstSurname(event.target.value)} required maxLength={60} autoComplete="family-name" placeholder="Uno o dos apellidos" /></label>
    <label className="text-sm font-medium">Cédula<input className={input} name="documentNumber" value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} inputMode="numeric" pattern="[0-9]{5,20}" required /></label>
    <label className="text-sm font-medium">Fecha de nacimiento<input className={input} name="birthDate" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} required /></label>
    <p className="text-sm sm:col-span-2">Edad: <strong>{age === null ? "—" : `${age} años`}</strong></p>
    <label className="text-sm font-medium">Teléfono<input className={input} name="phone" type="tel" autoComplete="tel" required placeholder="3001234567" /></label>
    <label className="text-sm font-medium">Correo<input className={input} name="email" type="email" autoComplete="email" required /></label>
    <label className="text-sm font-medium sm:col-span-2">Dirección (opcional)<input className={input} name="address" maxLength={180} /></label>
    <div className="grid gap-2 sm:col-span-2"><p className="text-sm font-medium">Fotografía (opcional)</p><FilePicker inputRef={photoInput} files={photo ? [photo] : []} onFilesChange={(files) => setPhoto(files[0] ?? null)} title="Fotografía del portero" hint="PNG, JPG o WEBP · máximo 1 MB" accept="image/png,image/jpeg,image/webp" name="photo" disabled={pending} /></div>
    <div className="sm:col-span-2 rounded-lg border p-3 sm:p-4"><h3 className="text-sm font-semibold">Vehículo (opcional, máximo uno)</h3><p className="mt-1 text-xs text-muted-foreground">Si registras un vehículo, completa sus cuatro datos. Déjalos vacíos si el portero no tiene vehículo.</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{(["type", "brand", "model", "plate"] as const).map((key) => <label key={key} className="text-sm font-medium">{{ type: "Tipo", brand: "Marca", model: "Modelo", plate: "Placa" }[key]}<input className={input} value={vehicle[key]} onChange={(event) => setVehicle((current) => ({ ...current, [key]: event.target.value }))} required={vehicleStarted} maxLength={60} /></label>)}</div>{vehicleStarted && <Button type="button" size="sm" variant="ghost" className="mt-3 text-destructive" onClick={() => setVehicle(blankVehicle())}>Quitar vehículo</Button>}</div>
    <section className="grid gap-4 rounded-lg border bg-secondary/20 p-3 sm:col-span-2 sm:p-4" aria-labelledby="acceso-portero"><div><h3 id="acceso-portero" className="text-base font-semibold">Acceso al sistema</h3><p className="mt-1 text-xs text-muted-foreground">La administración escribe y entrega al portero el usuario y la contraseña que asigne.</p></div><label className="text-sm font-medium">Usuario permanente<input className={input} name="username" value={username} onChange={(event) => setUsername(event.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" required maxLength={122} aria-describedby="regla-usuario-portero" /><span id="regla-usuario-portero" className="mt-1 block text-xs text-muted-foreground">Escribe primer nombre + primer apellido + últimos 2 dígitos de la cédula, sin espacios ni tildes, en minúsculas. {suggestedUsername ? `Para estos datos: ${suggestedUsername}.` : "Completa nombre, apellido y cédula para ver el formato."} Si ya existe en ResiQ, no se añadirá un sufijo.</span></label>{username.trim() && suggestedUsername && username.trim() !== suggestedUsername && <p role="alert" className="text-xs text-destructive">El usuario debe coincidir con {suggestedUsername}.</p>}<label className="text-sm font-medium">Contraseña permanente asignada por administración<input className={input} name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /><span className="mt-1 block text-xs text-muted-foreground">Mínimo 12 caracteres, mayúscula, minúscula y número. Entrégala en privado; no se mostrará después.</span></label><label className="text-sm font-medium">Confirmar contraseña<input className={input} name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label></section>
    <label className="flex items-start gap-2 text-sm sm:col-span-2"><input className="mt-1" type="checkbox" name="emailVerified" value="yes" required />Confirmo que verifiqué que este correo real pertenece al portero.</label>
    <div className="sm:col-span-2"><Button disabled={pending || !suggestedUsername || username.trim() !== suggestedUsername}>{pending ? "Registrando…" : "Registrar portero"}</Button></div>
    {state?.error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{state.error}</p>}
    {state?.success && <p role="status" className="text-sm text-primary sm:col-span-2">{state.success}</p>}
  </form>;
}
