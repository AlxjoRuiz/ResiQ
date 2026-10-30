"use client";

import { useState } from "react";
import { useFormActionState } from "@/lib/forms/use-form-action-state";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { changeAdminAssistantPassword, editAdminAssistant, removeAdminAssistant, type ConciergeState } from "./concierge-actions";

type Vehicle = { type: string; brand: string; model: string; plate: string };
export type EditableAssistant = { id: string; first_name: string; first_surname: string; document_number: string; birth_date: string; phone_e164: string; address: string | null; vehicles: unknown; username: string; email: string };
const input = "mt-1 h-10 w-full rounded-lg border bg-white px-3 text-sm";
function initialVehicles(value: unknown): Vehicle[] { return Array.isArray(value) ? value.filter((item): item is Vehicle => !!item && typeof item === "object" && ["type", "brand", "model", "plate"].every((key) => typeof item[key] === "string")) : []; }

// Editar, sustituir contraseña y eliminar un auxiliar: mismo diseño que portería (27/10/2026).
export function AdminAssistantManagementForms({ propertyId, account }: { propertyId: string; account: EditableAssistant }) {
  const [editState, editAction, editPending] = useFormActionState(editAdminAssistant, undefined as ConciergeState);
  const [passwordState, passwordAction, passwordPending] = useFormActionState(changeAdminAssistantPassword, undefined as ConciergeState);
  const [removeState, removeAction, removePending] = useFormActionState(removeAdminAssistant, undefined as ConciergeState);
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => initialVehicles(account.vehicles));
  function changeVehicle(index: number, key: keyof Vehicle, value: string) { setVehicles((current) => current.map((vehicle, item) => item === index ? { ...vehicle, [key]: value } : vehicle)); }
  return <div className="mt-4 space-y-5 border-t pt-4">
    <details><summary className="cursor-pointer text-sm font-medium">Editar</summary><form onSubmit={editAction} className="mt-3 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="recordId" value={account.id} /><input type="hidden" name="vehicles" value={JSON.stringify(vehicles)} />
      <p className="text-xs text-muted-foreground sm:col-span-2">Usuario {account.username} y correo {account.email}: no cambian al editar esta ficha.</p>
      <label className="text-sm">Nombres<input className={input} name="firstName" defaultValue={account.first_name} required maxLength={60} /></label>
      <label className="text-sm">Apellidos<input className={input} name="firstSurname" defaultValue={account.first_surname} required maxLength={60} /></label>
      <label className="text-sm">Cédula<input className={input} name="documentNumber" defaultValue={account.document_number} inputMode="numeric" pattern="[0-9]{5,20}" required /></label>
      <label className="text-sm">Fecha de nacimiento<DatePicker className="h-10" name="birthDate" defaultValue={account.birth_date} required yearSelect initialMonth="1990-01" label="Elegir fecha de nacimiento" /></label>
      <label className="text-sm">Teléfono<input className={input} name="phone" type="tel" defaultValue={account.phone_e164} required /></label>
      <label className="text-sm sm:col-span-2">Dirección<input className={input} name="address" defaultValue={account.address ?? ""} maxLength={180} /></label>
      <div className="sm:col-span-2"><p className="text-sm font-medium">Vehículo (máximo uno)</p>{vehicles.map((vehicle, index) => <div key={index} className="mt-2 grid gap-2 sm:grid-cols-4">{(["type", "brand", "model", "plate"] as const).map((key) => <label key={key} className="text-xs">{{ type: "Tipo", brand: "Marca", model: "Modelo", plate: "Placa" }[key]}<input className={input} value={vehicle[key]} onChange={(event) => changeVehicle(index, key, event.target.value)} required maxLength={60} /></label>)}<button type="button" className="text-left text-sm text-destructive sm:col-span-4" onClick={() => setVehicles((current) => current.filter((_, item) => item !== index))}>Quitar vehículo</button></div>)}<Button type="button" variant="outline" className="mt-2" disabled={vehicles.length >= 1} onClick={() => setVehicles((current) => [...current, { type: "", brand: "", model: "", plate: "" }])}>Agregar vehículo</Button></div>
      <div className="sm:col-span-2"><Button disabled={editPending}>{editPending ? "Guardando…" : "Guardar cambios"}</Button></div>
      {editState?.error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{editState.error}</p>}{editState?.success && <p role="status" className="text-sm text-primary sm:col-span-2">{editState.success}</p>}
    </form></details>
    <details><summary className="cursor-pointer text-sm font-medium">Sustituir contraseña</summary><form onSubmit={passwordAction} className="mt-3 grid gap-3 sm:grid-cols-2"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="recordId" value={account.id} /><label className="text-sm">Nueva contraseña<input className={input} name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label><label className="text-sm">Confirmar contraseña<input className={input} name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label><p className="text-xs text-muted-foreground sm:col-span-2">No se muestra ni recupera la contraseña anterior. Entrega la nueva de forma privada.</p><div className="sm:col-span-2"><Button variant="outline" disabled={passwordPending}>{passwordPending ? "Cambiando…" : "Cambiar contraseña"}</Button></div>{passwordState?.error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{passwordState.error}</p>}{passwordState?.success && <p role="status" className="text-sm text-primary sm:col-span-2">{passwordState.success}</p>}</form></details>
    <details><summary className="cursor-pointer text-sm font-medium text-destructive">Eliminar auxiliar</summary><form onSubmit={removeAction} className="mt-3 space-y-3 rounded-lg border border-destructive/30 p-3"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="recordId" value={account.id} /><p className="text-sm">Se revoca su acceso de administración de inmediato y desaparece la tarjeta. La cuenta solo se bloquea si no tiene otros accesos activos. El usuario no se reutiliza.</p><label className="block text-sm">Escribe RETIRAR para confirmar<input className={input} name="confirmation" required pattern="RETIRAR" autoComplete="off" /></label><Button variant="outline" className="border-destructive text-destructive" disabled={removePending}>{removePending ? "Retirando…" : "Eliminar auxiliar"}</Button>{removeState?.error && <p role="alert" className="text-sm text-destructive">{removeState.error}</p>}{removeState?.success && <p role="status" className="text-sm text-primary">{removeState.success}</p>}</form></details>
  </div>;
}
