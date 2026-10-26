"use client";

import { useRef, useState } from "react";
import { useFormActionState } from "@/lib/forms/use-form-action-state";
import { readSheet } from "read-excel-file/browser";
import { importCensus, type CensusImportState } from "@/app/panel/propiedades/[propertyId]/censo/actions";
import { CENSUS_MAX_COLUMNS, CENSUS_MAX_FILE_BYTES, CENSUS_MAX_FILE_LABEL, censusXlsxLimits, parseCensusRows, type CensusPreview } from "@/lib/census/parse";
import { censusUnitKey, defaultPrimaryRow, validatePrimarySelections } from "@/lib/census/primary-selection";
import { boundedXlsx } from "@/lib/finance/bounded-xlsx";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";

export function CensusImportForm({ propertyId }: { propertyId: string }) {
  const [state, action, pending] = useFormActionState(importCensus, undefined as CensusImportState);
  const [preview, setPreview] = useState<CensusPreview | null>(null);
  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [reading, setReading] = useState(false);
  const [readingError, setReadingError] = useState("");
  const selection = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    const currentSelection = ++selection.current;
    setPreview(null);
    setFileName(file?.name ?? "");
    setSelectedFile(file ?? null);
    setReadingError("");
    setReading(false);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx") || file.size > CENSUS_MAX_FILE_BYTES) {
      setReadingError(`Selecciona un .xlsx de máximo ${CENSUS_MAX_FILE_LABEL}.`);
      return;
    }
    setReading(true);
    try {
      const safeArchive = boundedXlsx(new Uint8Array(await file.arrayBuffer()), CENSUS_MAX_COLUMNS, censusXlsxLimits);
      const safeFile = new File([safeArchive as BlobPart], file.name, { type: file.type });
      const result = parseCensusRows(await readSheet(safeFile));
      if (selection.current === currentSelection) setPreview(result);
    } catch {
      if (selection.current === currentSelection) setReadingError("No pudimos abrir el Excel. Comprueba que sea un archivo .xlsx válido.");
    } finally {
      if (selection.current === currentSelection) setReading(false);
    }
  }

  const grouped = new Map<string, NonNullable<typeof preview>["rows"]>();
  for (const row of preview?.rows ?? []) {
    const key = censusUnitKey(row);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  // El principal de cada apartamento es la primera fila con nombre y correo de la columna G.
  const selected = [...grouped.values()]
    .map((rows) => ({ source_row: defaultPrimaryRow(rows)?.source_row ?? 0 }))
    .filter((item) => item.source_row > 0);
  const primaryCheck = preview ? validatePrimarySelections(preview.rows, selected) : null;

  return <form onSubmit={action} className="grid min-w-0 gap-5">
    <input type="hidden" name="propertyId" value={propertyId} />
    <input type="hidden" name="primarySelections" value={JSON.stringify(selected)} />
    <FilePicker inputRef={fileInput} files={selectedFile ? [selectedFile] : []} onFilesChange={(files) => { void onFile(files[0]); }} title="Archivo del censo" hint={`Excel .xlsx · máximo ${CENSUS_MAX_FILE_LABEL}`} accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" name="file" disabled={pending || reading} />
    <p className="text-sm text-muted-foreground">En cada apartamento, la primera respuesta con nombre y correo (columna G) queda como principal; la relación se toma de «Tipo de usuario». Por ahora no se envían invitaciones ni se vinculan cuentas.</p>
    {reading && <p role="status" className="text-sm">Leyendo el Excel…</p>}
    {readingError && <p role="alert" className="text-sm text-destructive">{readingError}</p>}
    {preview && <section className="min-w-0 space-y-4 rounded-xl border p-3 sm:p-5" aria-label="Vista previa del censo">
      <div><h3 className="font-semibold">Vista previa: {fileName}</h3><p className="text-sm text-muted-foreground">No se ha guardado nada todavía.</p></div>
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <p>Respuestas: <strong>{preview.rows.length}</strong></p><p>Torres: <strong>{preview.towerCount}</strong></p>
        <p>Apartamentos: <strong>{preview.unitCount}</strong></p><p>Residentes identificados: <strong>{preview.residentCount}</strong></p>
        <p>Columnas: <strong>{preview.headers.length}</strong></p><p>Filas repetidas: <strong>{preview.duplicateRows.length}</strong></p>
      </div>
      {preview.additionalHeaders.length > 0 && <p className="text-sm">Columnas adicionales: {preview.additionalHeaders.join(", ")}</p>}
      {preview.errors.length > 0 && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900"><p className="font-semibold">Corrige el archivo antes de importar:</p><ul className="mt-2 list-disc pl-5">{preview.errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul></div>}
      {primaryCheck?.error && <p role="status" className="text-sm text-amber-800">{primaryCheck.error}</p>}
      <div className="max-h-[28rem] overflow-auto rounded-lg border"><table className="min-w-[42rem] w-full text-left text-sm"><thead className="sticky top-0 bg-secondary"><tr><th className="p-3">Torre</th><th className="p-3">Apto</th><th className="p-3">Residente</th><th className="p-3">Detalles</th></tr></thead><tbody>
        {preview.rows.map((row) => <tr key={row.source_row} className="border-t align-top"><td className="p-3">{row.building_name}</td><td className="p-3">{row.unit_code}</td><td className="p-3">{row.full_name || "Sin información"}</td><td className="p-3"><details><summary className="cursor-pointer text-primary">Ver detalles</summary><dl className="mt-3 grid gap-2">{preview.headers.map((header, index) => <div key={index}><dt className="font-medium">{header}</dt><dd className="break-words text-muted-foreground">{row.cells[index] || "Sin información"}</dd></div>)}</dl></details></td></tr>)}
      </tbody></table></div>
      <p className="text-xs text-muted-foreground">El archivo se validará nuevamente en el servidor. La importación guardará todas las respuestas o ninguna.</p>
    </section>}
    {preview && <div className="flex flex-wrap gap-3"><Button disabled={pending || reading || preview.errors.length > 0 || preview.rows.length === 0 || Boolean(primaryCheck?.error)}>{pending ? "Importando…" : "Confirmar importación"}</Button><Button type="button" variant="outline" onClick={() => { selection.current++; setPreview(null); setFileName(""); setSelectedFile(null); if (fileInput.current) { fileInput.current.value = ""; fileInput.current.click(); } }}>Corregir archivo</Button><Button type="reset" variant="outline" onClick={() => { selection.current++; setPreview(null); setFileName(""); setSelectedFile(null); setReading(false); setReadingError(""); }}>Cancelar</Button></div>}
    {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
  </form>;
}
