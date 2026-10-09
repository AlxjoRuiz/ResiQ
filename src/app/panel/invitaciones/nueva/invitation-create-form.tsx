"use client";

import { useActionState, useState } from "react";
import { createInvitation, type InvitationState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

type Unit = { id: string; code: string };

export function InvitationCreateForm({ propertyId, units }: { propertyId: string; units: Unit[] }) {
  const [state, action, pending] = useActionState(createInvitation, undefined as InvitationState);
  const [unitId, setUnitId] = useState("");
  return <form action={action} className="mt-6 space-y-4">
    <input type="hidden" name="propertyId" value={propertyId} />
    <label className="block text-sm font-medium">Correo<input className="mt-2 h-11 w-full rounded-lg border px-3" name="email" type="email" required /></label>
    <label className="block text-sm font-medium">Acceso en la comunidad<select className="mt-2 h-11 w-full rounded-lg border bg-white px-3" name="role" defaultValue="member"><option value="member">Miembro</option><option value="concierge">Portería</option></select><span className="mt-1 block text-xs font-normal text-muted-foreground">Define qué funciones podrá usar en el panel.</span></label>
    <label className="block text-sm font-medium">Apartamento opcional<select className="mt-2 h-11 w-full rounded-lg border bg-white px-3" name="unitId" value={unitId} onChange={(event) => setUnitId(event.target.value)}><option value="">Sin apartamento</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.code}</option>)}</select></label>
    {unitId && <label className="block text-sm font-medium">Vínculo con el apartamento<select className="mt-2 h-11 w-full rounded-lg border bg-white px-3" name="relationship" defaultValue="resident"><option value="resident">Residente</option><option value="owner">Propietario</option></select><span className="mt-1 block text-xs font-normal text-muted-foreground">Indica si vive allí o es propietario; no cambia su acceso al panel.</span></label>}
    {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    {state?.invitationUrl && <div className="rounded-lg bg-secondary p-4"><p className="text-sm font-medium">Enlace válido durante 72 horas</p><p className="mt-2 break-all text-xs text-secondary-foreground">{state.invitationUrl}</p></div>}
    <Button disabled={pending}>{pending ? "Creando…" : "Crear invitación"}</Button>
  </form>;
}
