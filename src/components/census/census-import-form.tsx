"use client";

import { useActionState, useRef, useState } from "react";
import { readSheet } from "read-excel-file/browser";
import { importCensus, type CensusImportState } from "@/app/panel/propiedades/[propertyId]/censo/actions";
import { parseCensusRows, type CensusPreview } from "@/lib/census/parse";
import { boundedXlsx } from "@/lib/finance/bounded-xlsx";
import { Button } from "@/components/ui/button";

export function CensusImportForm({ propertyId }: { propertyId: string }) {
  const [state, action, pending] = useActionState(importCensus, undefined as CensusImportState);
  const [preview, setPreview] = useState<CensusPreview | null>(null);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [readingError, setReadingError] = useState("");
  const selection = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    const currentSelection = ++selection.current;
    setPreview(null);
    setFileName(file?.name ?? "");
    setReadingError("");
    setReading(false);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx") || file.size > 2 * 1024 * 1024) {
      setReadingError("Selecciona un .xlsx de máximo 2 MB.");
      return;
    }
    setReading(true);
    try {
      const safeArchive = boundedXlsx(new Uint8Array(await file.arrayBuffer()), 80);
      const safeFile = new File([safeArchive as BlobPart], file.name, { type: file.type });
      const result = parseCensusRows(await readSheet(safeFile));
      if (selection.current === currentSelection) setPreview(result);
    } catch {
      if (selection.current === currentSelection) setReadingError("No pudimos abrir el Excel. Comprueba que sea un archivo .xlsx válido.");
    } finally {
      if (selection.current === currentSelection) setReading(false);
    }
  }

  return <form action={action} className="grid min-w-0 gap-5">
    <input type="hidden" name="propertyId" value={propertyId} />
    <label className="inline-flex w-fit cursor-pointer items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">Importar Excel
      <input ref={fileInput} name="file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        onChange={(event) => { void onFile(event.target.files?.[0]); }} required />
    </label>
    <p className="text-sm text-muted-foreground">Antes de guardar, se muestra una vista previa de todos los registros. La importación no envía invitaciones ni vincula cuentas.</p>
    {reading && <p role="status" className="text-sm">Leyendo el Excel…</p>}
    {readingError && <p role="alert" className="text-sm text-destructive">{readingError}</p>}
    {preview && <section className="min-w-0 space-y-4 rounded-xl border p-3 sm:p-5" aria-label="Vista previa del censo">
      <div><h3 className="font-semibold">Vista previa: {fileName}</h3><p className="text-sm text-muted-foreground">No se ha guardado nada todavía.</p></div>
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <p>Respuestas: <strong>{preview.rows.length}</strong></p><p>Torres: <strong>{preview.towerCount}</strong></p>
        <p>Apartamentos: <strong>{preview.unitCount}</strong></p><p>Residentes identificados: <strong>{preview.residentCount}</strong></p>
        <p>Columnas: <strong>{preview.headers.length}</strong></p><p>Duplicados: <strong>{preview.duplicateRows.length}</strong></p>
      </div>
      {preview.additionalHeaders.length > 0 && <p className="text-sm">Columnas adicionales: {preview.additionalHeaders.join(", ")}</p>}
      {preview.errors.length > 0 && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900"><p className="font-semibold">Corrige el archivo antes de importar:</p><ul className="mt-2 list-disc pl-5">{preview.errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul></div>}
      <div className="max-h-[28rem] overflow-auto rounded-lg border"><table className="min-w-[42rem] w-full text-left text-sm"><thead className="sticky top-0 bg-secondary"><tr><th className="p-3">Torre</th><th className="p-3">Apto</th><th className="p-3">Residente</th><th className="p-3">Acción</th></tr></thead><tbody>
        {preview.rows.map((row) => <tr key={row.source_row} className="border-t align-top"><td className="p-3">{row.building_name}</td><td className="p-3">{row.unit_code}</td><td className="p-3">{row.full_name || "Sin información"}</td><td className="p-3"><details><summary className="cursor-pointer text-primary">Ver detalles</summary><dl className="mt-3 grid gap-2">{preview.headers.map((header, index) => <div key={index}><dt className="font-medium">{header}</dt><dd className="break-words text-muted-foreground">{row.cells[index] || "Sin información"}</dd></div>)}</dl></details></td></tr>)}
      </tbody></table></div>
      <p className="text-xs text-muted-foreground">El archivo se validará nuevamente en el servidor. La importación guardará todas las respuestas o ninguna.</p>
    </section>}
    {preview && <div className="flex flex-wrap gap-3"><Button disabled={pending || reading || preview.errors.length > 0 || preview.rows.length === 0}>{pending ? "Importando…" : "Confirmar importación"}</Button><Button type="button" variant="outline" onClick={() => { selection.current++; setPreview(null); setFileName(""); if (fileInput.current) { fileInput.current.value = ""; fileInput.current.click(); } }}>Corregir archivo</Button><Button type="reset" variant="outline" onClick={() => { selection.current++; setPreview(null); setFileName(""); setReading(false); setReadingError(""); }}>Cancelar</Button></div>}
    {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
  </form>;
}
