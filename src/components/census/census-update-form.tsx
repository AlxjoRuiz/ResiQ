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
  // React vacía el campo de archivo tras cada envío; el archivo elegido se envía explícitamente.
  const chosenFile = useRef<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [previewState, previewAction, previewPending] = useActionState(async (previous: TaggedState, form: FormData): Promise<TaggedState> => {
    const key = fileKey.current;
    if (chosenFile.current) form.set("file", chosenFile.current);
    return { ...(await previewCensusUpdate(previous, form)), fileKey: key };
  }, undefined as TaggedState);
  const [applyState, applyAction, applyPending] = useActionState(async (previous: TaggedState, form: FormData): Promise<TaggedState> => {
    const key = fileKey.current;
    if (chosenFile.current) form.set("file", chosenFile.current);
    return { ...(await applyCensusUpdate(previous, form)), fileKey: key };
  }, undefined as TaggedState);

  const currentKey = fileKeyOf(selectedFile);
  const preview = previewState?.fileKey === currentKey ? previewState : undefined;
  const applied = applyState?.fileKey === currentKey ? applyState : undefined;
  const pending = previewPending || applyPending;
  const summary = preview?.summary;

  return <form className="grid min-w-0 gap-4">
    <input type="hidden" name="propertyId" value={propertyId} />
    <FilePicker inputRef={fileInput} files={selectedFile ? [selectedFile] : []} onFilesChange={(files) => { setSelectedFile(files[0] ?? null); chosenFile.current = files[0] ?? null; fileKey.current = fileKeyOf(files[0] ?? null); }} title="Excel actualizado" hint={`Excel .xlsx · máximo ${CENSUS_MAX_FILE_LABEL} · mismas columnas del censo`} accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" name="file" disabled={pending} />
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
      {(summary.changes?.length ?? 0) > 0 && <div className="max-h-[28rem] overflow-auto rounded-lg border"><table className="w-full min-w-[40rem] text-left text-sm"><thead className="sticky top-0 bg-secondary"><tr><th className="p-3">Torre</th><th className="p-3">Apto</th><th className="p-3">Residente</th><th className="p-3">Cambio</th><th className="p-3">Invitación</th></tr></thead><tbody>
        {summary.changes!.map((item) => <tr key={item.source_row} className="border-t align-top"><td className="p-3">{item.building_name}</td><td className="p-3">{item.unit_code}</td><td className="p-3">{item.full_name || "Sin información"}</td><td className="p-3">{item.change === "created" ? "Nuevo" : "Actualizado"}</td><td className="p-3">{item.invitation === "new" ? "Nueva" : item.invitation === "replaced" ? "Reemplazada" : item.invitation === "resident_replaced" ? "Residente desvinculado e invitación nueva" : "—"}</td></tr>)}
      </tbody></table></div>}
      <Button formAction={applyAction} disabled={pending}>{applyPending ? "Actualizando…" : "Confirmar actualización"}</Button>
    </section>}
    {applied?.error && <p role="alert" className="text-sm text-destructive">{applied.error}</p>}
    {applied?.summary && <p role="status" className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">Censo actualizado: {applied.summary.updated} apartamentos actualizados, {applied.summary.created} nuevos y {applied.summary.unchanged} sin cambios. Las invitaciones quedan retenidas mientras el envío esté en modo de prueba.</p>}
  </form>;
}
