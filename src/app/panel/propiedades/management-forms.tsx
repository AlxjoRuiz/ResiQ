"use client";


import { Button } from "@/components/ui/button";
import { useFormActionState } from "@/lib/forms/use-form-action-state";
import { endUnitMembership, manageMember, queueResidentInvitation, revealInvitationLink, saveBuilding, saveUnit, updateProperty, type InvitationLinkState, type ManagementState } from "./actions";

const inputClass = "mt-2 h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "block text-sm font-medium";

function Result({ state }: { state: ManagementState }) {
  if (state?.error) return <p role="alert" className="text-sm text-destructive">{state.error}</p>;
  if (state?.success) return <p role="status" className="text-sm text-primary">{state.success}</p>;
  return null;
}

export function PropertyForm({ property }: { property: { id: string; name: string; address: string | null; city: string | null; timezone: string } }) {
  const [state, action, pending] = useFormActionState(updateProperty, undefined as ManagementState);
  return <form onSubmit={action} className="grid gap-4 md:grid-cols-2">
    <input type="hidden" name="propertyId" value={property.id} />
    <label className={labelClass}>Nombre<input className={inputClass} name="name" defaultValue={property.name} required minLength={2} maxLength={120} /></label>
    <label className={labelClass}>Ciudad<input className={inputClass} name="city" defaultValue={property.city ?? ""} maxLength={80} /></label>
    <label className={`${labelClass} md:col-span-2`}>Dirección<input className={inputClass} name="address" defaultValue={property.address ?? ""} maxLength={180} /></label>
    <label className={labelClass}>Zona horaria<input className={inputClass} name="timezone" defaultValue={property.timezone} required /></label>
    <div className="flex items-end"><Button disabled={pending}>{pending ? "Guardando…" : "Guardar propiedad"}</Button></div>
    <div className="md:col-span-2"><Result state={state} /></div>
  </form>;
}

// Solo la dirección del conjunto; nombre, ciudad y zona horaria se envían sin cambios.
export function PropertyAddressForm({ property }: { property: { id: string; name: string; address: string | null; city: string | null; timezone: string } }) {
  const [state, action, pending] = useFormActionState(updateProperty, undefined as ManagementState);
  return <form onSubmit={action} className="grid gap-4">
    <input type="hidden" name="propertyId" value={property.id} /><input type="hidden" name="name" value={property.name} /><input type="hidden" name="city" value={property.city ?? ""} /><input type="hidden" name="timezone" value={property.timezone} />
    <label className={labelClass}>Dirección<input className={inputClass} name="address" defaultValue={property.address ?? ""} maxLength={180} placeholder="Calle 123 # 45-67" /></label>
    <div className="flex flex-wrap items-center gap-3"><Button disabled={pending}>{pending ? "Guardando…" : "Guardar dirección"}</Button><Result state={state} /></div>
  </form>;
}

export function BuildingForm({ propertyId, building }: { propertyId: string; building: { id: string; name: string; code: string; active: boolean } }) {
  const [state, action, pending] = useFormActionState(saveBuilding, undefined as ManagementState);
  return <form onSubmit={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_8rem_9rem_auto] lg:items-end">
    <input type="hidden" name="propertyId" value={propertyId} />
    <input type="hidden" name="buildingId" value={building.id} />
    <label className={labelClass}>Nombre<input className={inputClass} name="name" defaultValue={building.name} required maxLength={80} placeholder="Torre 2" /></label>
    <label className={labelClass}>Código<input className={inputClass} name="code" defaultValue={building.code} required maxLength={20} placeholder="T2" /></label>
    <label className={labelClass}>Estado<select className={inputClass} name="active" defaultValue={building.active ? "true" : "false"}><option value="true">Activa</option><option value="false">Inactiva</option></select></label>
    <Button variant="outline" disabled={pending}>{pending ? "Guardando…" : "Actualizar"}</Button>
    <div className="sm:col-span-2 lg:col-span-4"><Result state={state} /></div>
  </form>;
}

export function UnitForm({ propertyId, buildings, unit }: {
  propertyId: string;
  buildings: { id: string; name: string; active: boolean }[];
  unit: { id: string; building_id: string; code: string; floor: string | null; status: string };
}) {
  const [state, action, pending] = useFormActionState(saveUnit, undefined as ManagementState);
  return <form onSubmit={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
    <input type="hidden" name="propertyId" value={propertyId} />
    <input type="hidden" name="unitId" value={unit.id} />
    <label className={labelClass}>Torre<select className={inputClass} name="buildingId" defaultValue={unit.building_id} required><option value="" disabled>Selecciona</option>{buildings.filter((item) => item.active || item.id === unit.building_id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className={labelClass}>Apartamento<input className={inputClass} name="code" defaultValue={unit.code} required maxLength={30} placeholder="301" /></label>
    <label className={labelClass}>Piso<input className={inputClass} name="floor" defaultValue={unit.floor ?? ""} maxLength={20} placeholder="3" /></label>
    <label className={labelClass}>Estado<select className={inputClass} name="status" defaultValue={unit.status}><option value="active">Activo</option><option value="inactive">Inactivo</option></select></label>
    <Button variant="outline" disabled={pending}>{pending ? "Guardando…" : "Actualizar"}</Button>
    <div className="sm:col-span-2 lg:col-span-5"><Result state={state} /></div>
  </form>;
}

export function MemberForm({ propertyId, member }: { propertyId: string; member: { id: string; roles: string[]; status: string } }) {
  const [state, action, pending] = useFormActionState(manageMember, undefined as ManagementState);
  return <form onSubmit={action} className="mt-4 grid gap-3 sm:grid-cols-3 sm:items-end">
    <input type="hidden" name="propertyId" value={propertyId} />
    <input type="hidden" name="memberId" value={member.id} />
    <fieldset className="flex h-11 items-center gap-4 rounded-lg border px-3"><legend className="sr-only">Roles</legend><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="roles" value="member" defaultChecked={member.roles.includes("member")} />Miembro</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="roles" value="concierge" defaultChecked={member.roles.includes("concierge")} />Portería</label></fieldset>
    <label className={labelClass}>Acceso a la aplicación<select className={inputClass} name="status" defaultValue={member.status}><option value="active">Activo</option><option value="suspended">Inactivo — sin acceso</option><option value="revoked">Revocado — quitar acceso</option></select></label>
    <Button variant="outline" disabled={pending}>{pending ? "Guardando…" : "Actualizar acceso"}</Button>
    <div className="sm:col-span-3"><Result state={state} /></div>
  </form>;
}

export function EndMembershipForm({ propertyId, unitMembershipId }: { propertyId: string; unitMembershipId: string }) {
  const [state, action, pending] = useFormActionState(endUnitMembership, undefined as ManagementState);
  return <form onSubmit={action} className="flex flex-wrap items-center gap-2">
    <input type="hidden" name="propertyId" value={propertyId} />
    <input type="hidden" name="unitMembershipId" value={unitMembershipId} />
    <Button type="submit" size="sm" variant="outline" disabled={pending}>{pending ? "Desvinculando…" : "Desvincular del apartamento"}</Button>
    <Result state={state} />
  </form>;
}

// Apartamento vacío: el admin agrega un residente; la invitación entra a la cola de correos.
export function UnitResidentInvitationForm({ propertyId, unitId }: { propertyId: string; unitId: string }) {
  const [state, action, pending] = useFormActionState(queueResidentInvitation, undefined as ManagementState);
  return <form onSubmit={action} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
    <input type="hidden" name="propertyId" value={propertyId} />
    <input type="hidden" name="unitId" value={unitId} />
    <label className={labelClass}>Correo del residente<input className={inputClass} name="email" type="email" required autoComplete="off" /></label>
    <label className={labelClass}>Tipo de residente<select className={inputClass} name="relationship" defaultValue="resident"><option value="resident">Residente</option><option value="owner">Propietario</option></select></label>
    <Button disabled={pending}>{pending ? "Creando…" : "Crear invitación"}</Button>
    <div className="sm:col-span-3"><Result state={state} /></div>
  </form>;
}

// «Ver enlace»: genera un enlace nuevo de 72 horas; el anterior deja de funcionar.
export function RevealInvitationLinkForm({ propertyId, invitationId }: { propertyId: string; invitationId: string }) {
  const [state, action, pending] = useFormActionState(revealInvitationLink, undefined as InvitationLinkState);
  return <form onSubmit={action} className="space-y-2">
    <input type="hidden" name="propertyId" value={propertyId} />
    <input type="hidden" name="invitationId" value={invitationId} />
    <Button type="submit" size="sm" variant="outline" disabled={pending}>{pending ? "Generando…" : "Ver enlace"}</Button>
    {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    {state?.link && <div className="rounded-lg bg-secondary p-3"><p className="text-sm font-medium">Enlace válido durante 72 horas</p><p className="mt-1 text-xs text-muted-foreground">Si generas otro, este deja de funcionar.</p><p className="mt-2 break-all text-xs">{state.link}</p></div>}
  </form>;
}
