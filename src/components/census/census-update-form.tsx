"use client";

import { useActionState, useRef, useState } from "react";
import { applyCensusUpdate, previewCensusUpdate, type CensusUpdateState } from "@/app/panel/propiedades/[propertyId]/censo/actions";
import { CENSUS_MAX_FILE_LABEL } from "@/lib/census/parse";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";

type TaggedState = (CensusUpdateState & { fileKey?: string }) | undefined;
const fileKeyOf = (file: File | null) => file ? `${file.name}:${file.size}:${file.lastModified}` : "";

// Actualiza el censo de una propiedad que ya tiene torres: primero simula y muestra el
// resumen; luego aplica. Ver 20261024120000_census_update_from_excel.sql.
export function CensusUpdateForm({ propertyId }: { propertyId: string }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileKey = useRef("");
  const fileInput = useRef<HTMLInputElement>(null);
  const [previewState, previewAction, previewPending] = useActionState(async (previous: TaggedState, form: FormData): Promise<TaggedState> => {
    const key = fileKey.current;
    return { ...(await previewCensusUpdate(previous, form)), fileKey: key };
  }, undefined as TaggedState);
  const [applyState, applyAction, applyPending] = useActionState(async (previous: TaggedState, form: FormData): Promise<TaggedState> => {
    const key = fileKey.current;
    return { ...(await applyCensusUpdate(previous, form)), fileKey: key };
  }, undefined as TaggedState);

  const currentKey = fileKeyOf(selectedFile);
  const preview = previewState?.fileKey === currentKey ? previewState : undefined;
  const applied = applyState?.fileKey === currentKey ? applyState : undefined;
  const pending = previewPending || applyPending;
  const summary = preview?.summary;

  return <form className="grid min-w-0 gap-4">
    <input type="hidden" name="propertyId" value={propertyId} />
    <FilePicker inputRef={fileInput} files={selectedFile ? [selectedFile] : []} onFilesChange={(files) => { setSelectedFile(files[0] ?? null); fileKey.current = fileKeyOf(files[0] ?? null); }} title="Excel actualizado" hint={`Excel .xlsx · máximo ${CENSUS_MAX_FILE_LABEL} · mismas columnas del censo`} accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" name="file" disabled={pending} />
    <p className="text-sm text-muted-foreground">Los apartamentos que ya existen se actualizan, los nuevos se crean y los que no vienen en el Excel no se tocan. Primero verás un resumen; nada se guarda hasta confirmar.</p>
    {selectedFile && !applied?.summary && <div className="flex flex-wrap gap-2"><Button formAction={previewAction} variant={summary ? "outline" : "default"} disabled={pending}>{previewPending ? "Revisando…" : "Revisar cambios"}</Button></div>}
    {preview?.error && <p role="alert" className="text-sm text-destructive">{preview.error}</p>}
    {summary && !applied?.summary && <section className="space-y-3 rounded-xl border p-4 text-sm" aria-label="Resumen de la actualización">
      <h3 className="font-semibold">Esto pasará al confirmar</h3>
      <ul className="grid gap-1 sm:grid-cols-2">
        <li>Apartamentos actualizados: <strong>{summary.updated}</strong></li>
        <li>Apartamentos nuevos: <strong>{summary.created}</strong></li>
        <li>Sin cambios: <strong>{summary.unchanged}</strong></li>
        <li>Torres nuevas: <strong>{summary.towers_created}</strong></li>
        <li>Invitaciones nuevas o reemplazadas: <strong>{summary.invitations}</strong></li>
      </ul>
      {summary.replaced_residents.length > 0 && <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900"><p className="font-medium">Cambia el correo de apartamentos con residente: se desvinculará al residente actual y se invitará al correo nuevo.</p><p className="mt-1">{summary.replaced_residents.join(", ")}</p></div>}
      <Button formAction={applyAction} disabled={pending}>{applyPending ? "Actualizando…" : "Confirmar actualización"}</Button>
    </section>}
    {applied?.error && <p role="alert" className="text-sm text-destructive">{applied.error}</p>}
    {applied?.summary && <p role="status" className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">Censo actualizado: {applied.summary.updated} apartamentos actualizados, {applied.summary.created} nuevos y {applied.summary.unchanged} sin cambios. Las invitaciones quedan retenidas mientras el envío esté en modo de prueba.</p>}
  </form>;
}
