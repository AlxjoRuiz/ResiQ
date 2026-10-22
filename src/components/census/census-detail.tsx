"use client";

import { useActionState, useState } from "react";
import { Plus, UserPlus } from "lucide-react";
import { unlinkUnitResidents, updateCensusRecord, type ManagementState } from "@/app/panel/propiedades/actions";
import { Button } from "@/components/ui/button";
import { normalizeCensusHeader } from "@/lib/census/parse";

const sections = ["Residente", "Familia", "Vehículos", "Mascotas", "Otros"] as const;
type Section = typeof sections[number];

function sectionFor(header: string): Section {
  const key = normalizeCensusHeader(header);
  if (["torre", "apartamento", "tipo de usuario", "nombre completo", "cedula", "numero de telefono", "correo electronico"].includes(key)) return "Residente";
  if (/personas viven|parentesco|discapacidad|menores/.test(key)) return "Familia";
  if (/vehiculo|placa|parqueadero/.test(key)) return "Vehículos";
  if (/mascota/.test(key)) return "Mascotas";
  return "Otros";
}

// Torre y apartamento identifican la unidad: no se editan.
const lockedField = (header: string) => ["torre", "apartamento"].includes(normalizeCensusHeader(header));

function fieldHint(header: string, occupied: boolean) {
  const key = normalizeCensusHeader(header);
  if (key === "correo electronico") return occupied
    ? "Este apartamento tiene un residente con cuenta. Si cambias el correo, al guardar se desvinculará al residente actual y se enviará la invitación al correo nuevo."
    : "Este es el correo que recibe la invitación y con el que se entra a ResiQ. Si lo cambias, la invitación pendiente se reemplaza.";
  if (key === "a que correo se le hace el envio de las facturas") return "Los avisos de cartera de este apartamento también llegarán a este correo si «¿Autoriza recibir las facturas…?» dice Sí.";
  return null;
}

export type LinkedResident = { linkId: string; label: string };

// Desvincular junto a Editar, con confirmación antes de quitar el acceso.
function UnlinkResidents({ propertyId, residents }: { propertyId: string; residents: LinkedResident[] }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(unlinkUnitResidents, undefined as ManagementState);
  if (!confirming) return <>
    <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(true)}>Desvincular</Button>
    {state?.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
  </>;
  // Confirmación centrada sobre la ficha, con el contenido desenfocado detrás.
  return <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Confirmar desvinculación">
    <form action={action} className="w-full max-w-md space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 shadow-lg">
      <input type="hidden" name="propertyId" value={propertyId} />
      {residents.map((resident) => <input key={resident.linkId} type="hidden" name="unitMembershipId" value={resident.linkId} />)}
      <p>¿Seguro que quieres desvincular a {residents.map((resident) => resident.label).join(" y ")}? Perderá el acceso a ResiQ para este apartamento. El apartamento y su historial se conservan.</p>
      <div className="flex flex-wrap gap-2"><Button size="sm" disabled={pending}>{pending ? "Desvinculando…" : "Sí, desvincular"}</Button><Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setConfirming(false)}>Cancelar</Button></div>
      {state?.error && <p role="alert" className="text-destructive">{state.error}</p>}
    </form>
  </div>;
}

export function CensusDetail({ headers, cells, propertyId, recordId, residents, vacant }: { headers: string[]; cells: (string | null)[]; propertyId: string; recordId: string; residents: LinkedResident[]; vacant: boolean }) {
  const occupied = residents.length > 0;
  const [active, setActive] = useState<Section>("Residente");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cells);
  const [state, action, pending] = useActionState(async (previous: ManagementState, formData: FormData) => {
    const result = await updateCensusRecord(previous, formData);
    if (result?.success) setEditing(false);
    return result;
  }, undefined as ManagementState);
  const values = editing ? draft : cells;
  const emailIndex = headers.findIndex((header) => normalizeCensusHeader(header) === "correo electronico");
  const emailChanged = emailIndex >= 0 && (draft[emailIndex] ?? "").trim().toLowerCase() !== (cells[emailIndex] ?? "").trim().toLowerCase();

  const startNewInvitation = () => { setDraft(headers.map((header, index) => lockedField(header) ? cells[index] : null)); setActive("Residente"); setEditing(true); };

  // Apartamento libre: solo el mensaje central para invitar; el formulario aparece al pulsar.
  if (vacant && !editing) return <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
    <span className="relative flex size-16 items-center justify-center rounded-full bg-secondary text-primary"><UserPlus size={30} aria-hidden="true" /></span>
    <div><p className="font-semibold">Apartamento sin residente</p><p className="mt-1 text-sm text-muted-foreground">Invita al nuevo propietario o residente para que tenga acceso a ResiQ.</p></div>
    <Button type="button" onClick={startNewInvitation}><Plus size={16} aria-hidden="true" />Nueva invitación</Button>
    {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    {state?.success && <p role="status" className="text-sm text-primary">{state.success}</p>}
  </div>;

  // La barra superior queda fuera del formulario de edición: Desvincular tiene su propio formulario.
  return <div className="relative space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <nav aria-label="Secciones del censo" className="flex min-w-0 max-w-full gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">{sections.map((section) => <button key={section} type="button" aria-pressed={active === section} onClick={() => setActive(section)} className={`shrink-0 rounded-full border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${active === section ? "border-foreground bg-foreground text-background" : "bg-white hover:bg-secondary"}`}>{section}</button>)}</nav>
      {!editing && <div className="flex flex-wrap items-center gap-2"><Button type="button" size="sm" variant="outline" onClick={() => { setDraft(cells); setEditing(true); }}>Editar</Button>{occupied && <UnlinkResidents propertyId={propertyId} residents={residents} />}</div>}
    </div>
    <form action={action} className="space-y-6">
    <input type="hidden" name="propertyId" value={propertyId} />
    <input type="hidden" name="recordId" value={recordId} />
    <input type="hidden" name="cells" value={JSON.stringify(draft)} />
    <section aria-label={active}><dl className="divide-y">{headers.map((header, index) => sectionFor(header) === active && <div key={index} className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><dt className="font-medium">{header}</dt><dd className="break-words text-muted-foreground">{editing && !lockedField(header)
      ? <><input className="h-10 w-full rounded-md border bg-white px-3 text-base text-foreground sm:text-sm" aria-label={header} value={values[index] ?? ""} maxLength={1000} onChange={(event) => { const next = [...draft]; next[index] = event.target.value === "" ? null : event.target.value; setDraft(next); }} />{fieldHint(header, occupied) && <span className="mt-1 block text-xs">{fieldHint(header, occupied)}</span>}</>
      : values[index] || "Sin información"}</dd></div>)}</dl></section>
    {editing && occupied && emailChanged && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Cambiaste el correo de un apartamento con residente. Al guardar, se desvinculará al residente actual y se creará la invitación para el correo nuevo.</p>}
    {editing && <div className="flex flex-wrap items-center gap-2"><Button disabled={pending}>{pending ? "Guardando…" : "Guardar cambios"}</Button><Button type="button" variant="outline" disabled={pending} onClick={() => { setDraft(cells); setEditing(false); }}>Cancelar</Button><p className="text-xs text-muted-foreground">La torre y el apartamento no se pueden cambiar. Si cambias el correo o el tipo de usuario, la invitación pendiente se reemplaza.</p></div>}
    {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    {state?.success && !editing && <p role="status" className="text-sm text-primary">{state.success}</p>}
    </form>
  </div>;
}
