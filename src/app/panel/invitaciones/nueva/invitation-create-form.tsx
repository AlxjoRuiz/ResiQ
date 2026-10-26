"use client";

import { useState } from "react";
import { useFormActionState } from "@/lib/forms/use-form-action-state";
import { createInvitation, type InvitationState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

type Building = { id: string; name: string };
type Unit = { id: string; buildingId: string; code: string };
const selectClass = "mt-2 h-11 w-full rounded-lg border bg-white px-3 text-base sm:text-sm";

export function InvitationCreateForm({ propertyId, buildings, units }: { propertyId: string; buildings: Building[]; units: Unit[] }) {
  const [state, action, pending] = useFormActionState(createInvitation, undefined as InvitationState);
  const [buildingId, setBuildingId] = useState("");
  const [unitId, setUnitId] = useState("");
  const availableUnits = units.filter((unit) => unit.buildingId === buildingId);

  return <form onSubmit={action} className="mt-6 space-y-4">
    <input type="hidden" name="propertyId" value={propertyId} />
    <input type="hidden" name="role" value="member" />
    <label className="block text-sm font-medium">Correo electrónico<input className={selectClass} name="email" type="email" required autoComplete="email" /></label>
    <>
      <label className="block text-sm font-medium">Torre o bloque<select className={selectClass} name="buildingId" value={buildingId} onChange={(event) => { setBuildingId(event.target.value); setUnitId(""); }} required><option value="" disabled>Selecciona una torre</option>{buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}</select></label>
      <label className="block text-sm font-medium">Apartamento<select className={selectClass} name="unitId" value={unitId} onChange={(event) => setUnitId(event.target.value)} disabled={!buildingId} required><option value="" disabled>{buildingId ? "Selecciona un apartamento" : "Selecciona primero una torre"}</option>{availableUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.code}</option>)}</select></label>
      <label className="block text-sm font-medium">Tipo de residente<select className={selectClass} name="relationship" defaultValue="resident"><option value="resident">Arrendatario</option><option value="owner">Propietario</option></select></label>
      {!buildings.length && <p className="text-sm text-muted-foreground">Primero registra una torre y sus apartamentos en esta propiedad.</p>}
    </>
    {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    {state?.invitationUrl && <div className="rounded-lg bg-secondary p-4"><p className="text-sm font-medium">Enlace válido durante 72 horas</p><p className="mt-2 break-all text-xs text-secondary-foreground">{state.invitationUrl}</p></div>}
    <Button disabled={pending || !unitId}>{pending ? "Creando…" : "Crear invitación"}</Button>
  </form>;
}
