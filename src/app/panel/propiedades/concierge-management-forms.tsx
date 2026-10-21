"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { changeConciergePassword, editConcierge, removeConcierge, type ConciergeState } from "./concierge-actions";

type Vehicle = { type: string; brand: string; model: string; plate: string };
export type EditableConcierge = { id: string; full_name: string; document_number: string; birth_date: string; phone_e164: string; address: string | null; vehicles: unknown; username: string; email_normalized: string };
const input = "mt-1 h-10 w-full rounded-lg border bg-white px-3 text-sm";
function initialVehicles(value: unknown): Vehicle[] { return Array.isArray(value) ? value.filter((item): item is Vehicle => !!item && typeof item === "object" && ["type", "brand", "model", "plate"].every((key) => typeof item[key] === "string")) : []; }

export function ConciergeManagementForms({ propertyId, account }: { propertyId: string; account: EditableConcierge }) {
  const [editState, editAction, editPending] = useActionState(editConcierge, undefined as ConciergeState);
  const [passwordState, passwordAction, passwordPending] = useActionState(changeConciergePassword, undefined as ConciergeState);
  const [removeState, removeAction, removePending] = useActionState(removeConcierge, undefined as ConciergeState);
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => initialVehicles(account.vehicles));
  function changeVehicle(index: number, key: keyof Vehicle, value: string) { setVehicles((current) => current.map((vehicle, item) => item === index ? { ...vehicle, [key]: value } : vehicle)); }
  return <div className="mt-4 space-y-5 border-t pt-4">
    <details><summary className="cursor-pointer text-sm font-medium">Editar</summary><form action={editAction} className="mt-3 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="accountId" value={account.id} /><input type="hidden" name="vehicles" value={JSON.stringify(vehicles)} />
      <p className="text-xs text-muted-foreground sm:col-span-2">Usuario {account.username} y correo {account.email_normalized}: no cambian al editar esta ficha.</p>
      <label className="text-sm">Nombre completo<input className={input} name="fullName" defaultValue={account.full_name} required maxLength={120} /></label>
      <label className="text-sm">Cédula<input className={input} name="documentNumber" defaultValue={account.document_number} inputMode="numeric" pattern="[0-9]{5,20}" required /></label>
      <label className="text-sm">Fecha de nacimiento<input className={input} name="birthDate" type="date" defaultValue={account.birth_date} required /></label>
      <label className="text-sm">Teléfono<input className={input} name="phone" type="tel" defaultValue={account.phone_e164} required /></label>
      <label className="text-sm sm:col-span-2">Dirección<input className={input} name="address" defaultValue={account.address ?? ""} maxLength={180} /></label>
      <div className="sm:col-span-2"><p className="text-sm font-medium">Vehículos</p>{vehicles.map((vehicle, index) => <div key={index} className="mt-2 grid gap-2 sm:grid-cols-4">{(["type", "brand", "model", "plate"] as const).map((key) => <label key={key} className="text-xs">{{ type: "Tipo", brand: "Marca", model: "Modelo", plate: "Placa" }[key]}<input className={input} value={vehicle[key]} onChange={(event) => changeVehicle(index, key, event.target.value)} required maxLength={60} /></label>)}<button type="button" className="text-left text-sm text-destructive sm:col-span-4" onClick={() => setVehicles((current) => current.filter((_, item) => item !== index))}>Quitar vehículo</button></div>)}<Button type="button" variant="outline" className="mt-2" disabled={vehicles.length >= 10} onClick={() => setVehicles((current) => [...current, { type: "", brand: "", model: "", plate: "" }])}>Agregar vehículo</Button></div>
      <div className="sm:col-span-2"><Button disabled={editPending}>{editPending ? "Guardando…" : "Guardar cambios"}</Button></div>
      {editState?.error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{editState.error}</p>}{editState?.success && <p role="status" className="text-sm text-primary sm:col-span-2">{editState.success}</p>}
    </form></details>
    <details><summary className="cursor-pointer text-sm font-medium">Sustituir contraseña</summary><form action={passwordAction} className="mt-3 grid gap-3 sm:grid-cols-2"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="accountId" value={account.id} /><label className="text-sm">Nueva contraseña<input className={input} name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label><label className="text-sm">Confirmar contraseña<input className={input} name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label><p className="text-xs text-muted-foreground sm:col-span-2">No se muestra ni recupera la contraseña anterior. Entrega la nueva de forma privada.</p><div className="sm:col-span-2"><Button variant="outline" disabled={passwordPending}>{passwordPending ? "Cambiando…" : "Cambiar contraseña"}</Button></div>{passwordState?.error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{passwordState.error}</p>}{passwordState?.success && <p role="status" className="text-sm text-primary sm:col-span-2">{passwordState.success}</p>}</form></details>
    <details><summary className="cursor-pointer text-sm font-medium text-destructive">Eliminar portero</summary><form action={removeAction} className="mt-3 space-y-3 rounded-lg border border-destructive/30 p-3"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="accountId" value={account.id} /><p className="text-sm">Se revoca su acceso de portería de inmediato y desaparece la tarjeta. La cuenta Auth solo se bloquea globalmente si no tiene otros roles activos. El usuario no se reutiliza. Los datos sujetos a retención se revisarán por separado.</p><label className="block text-sm">Escribe RETIRAR para confirmar<input className={input} name="confirmation" required pattern="RETIRAR" autoComplete="off" /></label><Button variant="outline" className="border-destructive text-destructive" disabled={removePending}>{removePending ? "Retirando…" : "Eliminar portero"}</Button>{removeState?.error && <p role="alert" className="text-sm text-destructive">{removeState.error}</p>}{removeState?.success && <p role="status" className="text-sm text-primary">{removeState.success}</p>}</form></details>
  </div>;
}
