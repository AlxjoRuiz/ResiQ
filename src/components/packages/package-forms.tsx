"use client";

import { useActionState, useMemo, useState } from "react";
import { assignPackageRecipient, deliverPackage, registerPackage, type PackageState } from "@/app/panel/propiedades/[propertyId]/paquetes/actions";
import { Button } from "@/components/ui/button";

export type PackageDirectoryRow = { unit_id: string; unit_code: string; building_name: string; member_id: string | null; display_name: string | null };
const inputClass = "mt-2 h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const areaClass = "mt-2 min-h-24 w-full rounded-lg border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "block text-sm font-medium";
function Result({ state }: { state: PackageState }) { if (state?.error) return <p role="alert" className="text-sm text-destructive">{state.error}</p>; if (state?.success) return <p role="status" className="text-sm text-primary">{state.success}</p>; return null; }

export function RegisterPackageForm({ propertyId, directory }: { propertyId: string; directory: PackageDirectoryRow[] }) {
  const [state, action, pending] = useActionState(registerPackage, undefined as PackageState);
  const [unitId, setUnitId] = useState("");
  const [memberId, setMemberId] = useState("");
  const units = useMemo(() => Array.from(new Map(directory.map((row) => [row.unit_id, { id: row.unit_id, label: `${row.building_name} · ${row.unit_code}` }])).values()), [directory]);
  const members = directory.filter((row) => row.unit_id === unitId && row.member_id && row.display_name);
  return <form action={action} className="grid gap-5">
    <input type="hidden" name="propertyId" value={propertyId} />
    <label className={labelClass}>Apartamento<select className={inputClass} name="unitId" value={unitId} onChange={(event) => { setUnitId(event.target.value); setMemberId(""); }} required><option value="" disabled>Selecciona</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label>
    <label className={labelClass}>Destinatario asociado<select className={inputClass} name="recipientMemberId" value={memberId} onChange={(event) => setMemberId(event.target.value)} disabled={!unitId}><option value="">No aparece / aún sin cuenta</option>{members.map((member) => <option key={member.member_id!} value={member.member_id!}>{member.display_name}</option>)}</select></label>
    {!memberId && <label className={labelClass}>Nombre que aparece en el paquete<input className={inputClass} name="recipientName" required minLength={2} maxLength={120} /></label>}
    <div className="grid gap-5 sm:grid-cols-2"><label className={labelClass}>Transportadora<input className={inputClass} name="carrier" maxLength={100} placeholder="Servientrega, Coordinadora…" /></label><label className={labelClass}>Número de guía<input className={inputClass} name="trackingNumber" maxLength={100} /></label></div>
    <div className="grid gap-5 sm:grid-cols-2"><label className={labelClass}>Remitente<input className={inputClass} name="senderName" maxLength={120} placeholder="Persona o comercio" /></label><label className={labelClass}>Origen<input className={inputClass} name="origin" maxLength={120} placeholder="Ciudad o lugar de envío" /></label></div>
    <label className={labelClass}>Descripción<input className={inputClass} name="description" required minLength={3} maxLength={500} placeholder="Caja mediana, sobre, bolsa…" /></label>
    <label className={labelClass}>Observaciones<textarea className={areaClass} name="notes" maxLength={1000} placeholder="Estado del empaque u otra novedad" /></label>
    <div className="flex items-center gap-4"><Button disabled={pending || !unitId}>{pending ? "Registrando…" : "Registrar paquete"}</Button><Result state={state} /></div>
  </form>;
}

export function AssignRecipientForm({ propertyId, packageId, members }: { propertyId: string; packageId: string; members: PackageDirectoryRow[] }) {
  const [state, action, pending] = useActionState(assignPackageRecipient, undefined as PackageState);
  return <form action={action} className="grid gap-3"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="packageId" value={packageId} /><label className={labelClass}>Asociar destinatario<select className={inputClass} name="memberId" required defaultValue=""><option value="" disabled>Selecciona</option>{members.filter((row) => row.member_id && row.display_name).map((row) => <option key={row.member_id!} value={row.member_id!}>{row.display_name}</option>)}</select></label><div className="flex items-center gap-4"><Button variant="outline" disabled={pending}>{pending ? "Asociando…" : "Asociar y avisar"}</Button><Result state={state} /></div></form>;
}

export function DeliverPackageForm({ propertyId, packageId }: { propertyId: string; packageId: string }) {
  const [state, action, pending] = useActionState(deliverPackage, undefined as PackageState);
  return <form action={action} className="grid gap-3"><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="packageId" value={packageId} /><label className={labelClass}>Nombre de quien recibe<input className={inputClass} name="collectedByName" minLength={2} maxLength={120} required placeholder="Puede ser el destinatario u otra persona" /></label><div className="flex items-center gap-4"><Button disabled={pending}>{pending ? "Registrando…" : "Marcar como entregado"}</Button><Result state={state} /></div></form>;
}
