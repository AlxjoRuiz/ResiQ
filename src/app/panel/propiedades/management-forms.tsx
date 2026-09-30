"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { addUnitMembership, endUnitMembership, manageMember, saveBuilding, saveUnit, updateProperty, type ManagementState } from "./actions";

const inputClass = "mt-2 h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "block text-sm font-medium";

function Result({ state }: { state: ManagementState }) {
  if (state?.error) return <p role="alert" className="text-sm text-destructive">{state.error}</p>;
  if (state?.success) return <p role="status" className="text-sm text-primary">{state.success}</p>;
  return null;
}

export function PropertyForm({ property }: { property: { id: string; name: string; address: string | null; city: string | null; timezone: string } }) {
  const [state, action, pending] = useActionState(updateProperty, undefined as ManagementState);
  return <form action={action} className="grid gap-4 md:grid-cols-2">
    <input type="hidden" name="propertyId" value={property.id} />
    <label className={labelClass}>Nombre<input className={inputClass} name="name" defaultValue={property.name} required minLength={2} maxLength={120} /></label>
    <label className={labelClass}>Ciudad<input className={inputClass} name="city" defaultValue={property.city ?? ""} maxLength={80} /></label>
    <label className={`${labelClass} md:col-span-2`}>Dirección<input className={inputClass} name="address" defaultValue={property.address ?? ""} maxLength={180} /></label>
    <label className={labelClass}>Zona horaria<input className={inputClass} name="timezone" defaultValue={property.timezone} required /></label>
    <div className="flex items-end"><Button disabled={pending}>{pending ? "Guardando…" : "Guardar propiedad"}</Button></div>
    <div className="md:col-span-2"><Result state={state} /></div>
  </form>;
}

export function BuildingForm({ propertyId, building }: { propertyId: string; building?: { id: string; name: string; code: string; active: boolean } }) {
  const [state, action, pending] = useActionState(saveBuilding, undefined as ManagementState);
  return <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_8rem_9rem_auto] lg:items-end">
    <input type="hidden" name="propertyId" value={propertyId} />
    <input type="hidden" name="buildingId" value={building?.id ?? ""} />
    <label className={labelClass}>Nombre<input className={inputClass} name="name" defaultValue={building?.name ?? ""} required maxLength={80} placeholder="Torre 2" /></label>
    <label className={labelClass}>Código<input className={inputClass} name="code" defaultValue={building?.code ?? ""} required maxLength={20} placeholder="T2" /></label>
    <label className={labelClass}>Estado<select className={inputClass} name="active" defaultValue={building?.active === false ? "false" : "true"}><option value="true">Activa</option><option value="false">Inactiva</option></select></label>
    <Button variant={building ? "outline" : "default"} disabled={pending}>{pending ? "Guardando…" : building ? "Actualizar" : "Crear torre"}</Button>
    <div className="sm:col-span-2 lg:col-span-4"><Result state={state} /></div>
  </form>;
}

export function UnitForm({ propertyId, buildings, unit }: {
  propertyId: string;
  buildings: { id: string; name: string; active: boolean }[];
  unit?: { id: string; building_id: string; code: string; floor: string | null; status: string };
}) {
  const [state, action, pending] = useActionState(saveUnit, undefined as ManagementState);
  return <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
    <input type="hidden" name="propertyId" value={propertyId} />
    <input type="hidden" name="unitId" value={unit?.id ?? ""} />
    <label className={labelClass}>Torre<select className={inputClass} name="buildingId" defaultValue={unit?.building_id ?? ""} required><option value="" disabled>Selecciona</option>{buildings.filter((item) => item.active || item.id === unit?.building_id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className={labelClass}>Apartamento<input className={inputClass} name="code" defaultValue={unit?.code ?? ""} required maxLength={30} placeholder="301" /></label>
    <label className={labelClass}>Piso<input className={inputClass} name="floor" defaultValue={unit?.floor ?? ""} maxLength={20} placeholder="3" /></label>
    <label className={labelClass}>Estado<select className={inputClass} name="status" defaultValue={unit?.status ?? "active"}><option value="active">Activo</option><option value="inactive">Inactivo</option></select></label>
    <Button variant={unit ? "outline" : "default"} disabled={pending}>{pending ? "Guardando…" : unit ? "Actualizar" : "Crear apartamento"}</Button>
    <div className="sm:col-span-2 lg:col-span-5"><Result state={state} /></div>
  </form>;
}

export function MemberForm({ propertyId, member }: { propertyId: string; member: { id: string; roles: string[]; status: string } }) {
  const [state, action, pending] = useActionState(manageMember, undefined as ManagementState);
  return <form action={action} className="mt-4 grid gap-3 sm:grid-cols-3 sm:items-end">
    <input type="hidden" name="propertyId" value={propertyId} />
    <input type="hidden" name="memberId" value={member.id} />
    <fieldset className="flex h-11 items-center gap-4 rounded-lg border px-3"><legend className="sr-only">Roles</legend><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="roles" value="member" defaultChecked={member.roles.includes("member")} />Miembro</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="roles" value="concierge" defaultChecked={member.roles.includes("concierge")} />Portería</label></fieldset>
    <label className={labelClass}>Estado<select className={inputClass} name="status" defaultValue={member.status}><option value="active">Activo</option><option value="suspended">Suspendido</option><option value="revoked">Revocado</option></select></label>
    <Button variant="outline" disabled={pending}>{pending ? "Guardando…" : "Actualizar acceso"}</Button>
    <div className="sm:col-span-3"><Result state={state} /></div>
  </form>;
}

export function UnitMembershipForm({ propertyId, memberId, units }: { propertyId: string; memberId: string; units: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState(addUnitMembership, undefined as ManagementState);
  return <form action={action} className="mt-4 grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
    <input type="hidden" name="propertyId" value={propertyId} />
    <input type="hidden" name="memberId" value={memberId} />
    <label className={labelClass}>Nuevo apartamento<select className={inputClass} name="unitId" defaultValue="" required><option value="" disabled>Selecciona</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label>
    <label className={labelClass}>Relación<select className={inputClass} name="relationship" defaultValue="resident"><option value="resident">Residente</option><option value="owner">Propietario</option></select></label>
    <Button disabled={pending}>{pending ? "Vinculando…" : "Vincular"}</Button>
    <div className="sm:col-span-3"><Result state={state} /></div>
  </form>;
}

export function EndMembershipForm({ propertyId, unitMembershipId }: { propertyId: string; unitMembershipId: string }) {
  const [state, action, pending] = useActionState(endUnitMembership, undefined as ManagementState);
  return <form action={action} className="inline-flex items-center gap-2">
    <input type="hidden" name="propertyId" value={propertyId} />
    <input type="hidden" name="unitMembershipId" value={unitMembershipId} />
    <Button type="submit" size="sm" variant="ghost" disabled={pending}>{pending ? "Finalizando…" : "Finalizar vínculo"}</Button>
    <Result state={state} />
  </form>;
}
