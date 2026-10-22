"use client";

import { useActionState, useState } from "react";
import { updateCensusRecord, type ManagementState } from "@/app/panel/propiedades/actions";
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

export function CensusDetail({ headers, cells, propertyId, recordId, occupied, vacant }: { headers: string[]; cells: (string | null)[]; propertyId: string; recordId: string; occupied: boolean; vacant: boolean }) {
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

  return <form action={action} className="space-y-6">
    <input type="hidden" name="propertyId" value={propertyId} />
    <input type="hidden" name="recordId" value={recordId} />
    <input type="hidden" name="cells" value={JSON.stringify(draft)} />
    <div className="flex flex-wrap items-center justify-between gap-2">
      <nav aria-label="Secciones del censo" className="flex flex-wrap gap-2">{sections.map((section) => <button key={section} type="button" aria-pressed={active === section} onClick={() => setActive(section)} className={`rounded-full border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${active === section ? "border-foreground bg-foreground text-background" : "bg-white hover:bg-secondary"}`}>{section}</button>)}</nav>
      {!editing && <Button type="button" size="sm" variant="outline" onClick={() => { setDraft(cells); setEditing(true); }}>Editar</Button>}
    </div>
    {vacant && !editing && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><p>Apartamento sin residente. Para invitar a uno nuevo, pulsa «Nueva invitación» y completa sus datos.</p><Button type="button" size="sm" onClick={() => { setDraft(headers.map((header, index) => lockedField(header) ? cells[index] : null)); setActive("Residente"); setEditing(true); }}>Nueva invitación</Button></div>}
    <section aria-label={active}><dl className="divide-y">{headers.map((header, index) => sectionFor(header) === active && <div key={index} className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><dt className="font-medium">{header}</dt><dd className="break-words text-muted-foreground">{editing && !lockedField(header)
      ? <><input className="h-10 w-full rounded-md border bg-white px-3 text-foreground" aria-label={header} value={values[index] ?? ""} maxLength={1000} onChange={(event) => { const next = [...draft]; next[index] = event.target.value === "" ? null : event.target.value; setDraft(next); }} />{fieldHint(header, occupied) && <span className="mt-1 block text-xs">{fieldHint(header, occupied)}</span>}</>
      : values[index] || "Sin información"}</dd></div>)}</dl></section>
    {editing && occupied && emailChanged && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Cambiaste el correo de un apartamento con residente. Al guardar, se desvinculará al residente actual y se creará la invitación para el correo nuevo.</p>}
    {editing && <div className="flex flex-wrap items-center gap-2"><Button disabled={pending}>{pending ? "Guardando…" : "Guardar cambios"}</Button><Button type="button" variant="outline" disabled={pending} onClick={() => { setDraft(cells); setEditing(false); }}>Cancelar</Button><p className="text-xs text-muted-foreground">La torre y el apartamento no se pueden cambiar. Si cambias el correo o el tipo de usuario, la invitación pendiente se reemplaza.</p></div>}
    {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    {state?.success && !editing && <p role="status" className="text-sm text-primary">{state.success}</p>}
  </form>;
}
