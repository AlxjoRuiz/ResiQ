"use client";

import { useActionState, useRef, useState } from "react";
import { readSheet } from "read-excel-file/browser";
import { importCensus, type CensusImportState } from "@/app/panel/propiedades/[propertyId]/censo/actions";
import { parseCensusRows, type CensusPreview } from "@/lib/census/parse";
import { censusUnitKey, eligiblePrimary, validatePrimarySelections, type PrimarySelection } from "@/lib/census/primary-selection";
import { boundedXlsx } from "@/lib/finance/bounded-xlsx";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";

export function CensusImportForm({ propertyId }: { propertyId: string }) {
  const [state, action, pending] = useActionState(importCensus, undefined as CensusImportState);
  const [preview, setPreview] = useState<CensusPreview | null>(null);
  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [reading, setReading] = useState(false);
  const [readingError, setReadingError] = useState("");
  const [chosenRows, setChosenRows] = useState<Record<string, number>>({});
  const [relationships, setRelationships] = useState<Record<string, PrimarySelection["relationship"] | "">>({});
  const selection = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    const currentSelection = ++selection.current;
    setPreview(null);
    setChosenRows({});
    setRelationships({});
    setFileName(file?.name ?? "");
    setSelectedFile(file ?? null);
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

  const grouped = new Map<string, NonNullable<typeof preview>["rows"]>();
  for (const row of preview?.rows ?? []) {
    const key = censusUnitKey(row);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  const selected = Object.entries(chosenRows).filter(([, source]) => source > 0 && relationships[String(source)])
    .map(([, source]) => ({ source_row: source, relationship: relationships[String(source)] }));
  const primaryCheck = preview ? validatePrimarySelections(preview.rows, selected) : null;
  const incompleteRelation = Object.values(chosenRows).some((source) => source > 0 && !relationships[String(source)]);

  return <form action={action} className="grid min-w-0 gap-5">
    <input type="hidden" name="propertyId" value={propertyId} />
    <input type="hidden" name="primarySelections" value={JSON.stringify(selected)} />
    <FilePicker inputRef={fileInput} files={selectedFile ? [selectedFile] : []} onFilesChange={(files) => { void onFile(files[0]); }} title="Archivo del censo" hint="Excel .xlsx · máximo 2 MB" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" name="file" disabled={pending || reading} />
    <p className="text-sm text-muted-foreground">Antes de guardar, elige un principal por apartamento. Su correo sale de la columna G. Por ahora no se envían invitaciones ni se vinculan cuentas.</p>
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
      <div className="space-y-3"><h4 className="font-semibold">Principal por apartamento</h4><p className="text-sm text-muted-foreground">El correo no depende de si la persona es propietaria o arrendataria. La relación elegida se usará más adelante al activar la invitación.</p>
        {[...grouped.entries()].map(([unit, rows]) => {
          const eligible = rows.filter(eligiblePrimary);
          const chosen = chosenRows[unit] ?? 0;
          return <div key={unit} className="grid min-w-0 gap-3 rounded-lg border p-3 sm:grid-cols-2">
            <label className="grid min-w-0 gap-1 text-sm"><span className="font-medium">{rows[0].building_name} · Apto {rows[0].unit_code}</span><select className="h-10 w-full min-w-0 rounded-md border bg-white px-3" value={chosen} disabled={!eligible.length} onChange={(event) => setChosenRows((current) => ({ ...current, [unit]: Number(event.target.value) }))}><option value={0}>{eligible.length ? "Selecciona residente principal" : "Sin nombre y correo elegibles"}</option>{eligible.map((row) => <option key={row.source_row} value={row.source_row}>{row.full_name} · {row.email} (fila {row.source_row})</option>)}</select></label>
            <label className="grid min-w-0 gap-1 text-sm"><span className="font-medium">Relación para acceso futuro</span><select className="h-10 w-full min-w-0 rounded-md border bg-white px-3" value={chosen ? relationships[String(chosen)] ?? "" : ""} disabled={!chosen} onChange={(event) => setRelationships((current) => ({ ...current, [String(chosen)]: event.target.value as PrimarySelection["relationship"] }))}><option value="">Selecciona relación</option><option value="owner">Propietario</option><option value="resident">Arrendatario</option></select></label>
          </div>;
        })}
        {(incompleteRelation || primaryCheck?.error) && <p role="status" className="text-sm text-amber-800">{incompleteRelation ? "Selecciona la relación de cada principal." : primaryCheck?.error}</p>}
      </div>
      <div className="max-h-[28rem] overflow-auto rounded-lg border"><table className="min-w-[42rem] w-full text-left text-sm"><thead className="sticky top-0 bg-secondary"><tr><th className="p-3">Torre</th><th className="p-3">Apto</th><th className="p-3">Residente</th><th className="p-3">Acción</th></tr></thead><tbody>
        {preview.rows.map((row) => <tr key={row.source_row} className="border-t align-top"><td className="p-3">{row.building_name}</td><td className="p-3">{row.unit_code}</td><td className="p-3">{row.full_name || "Sin información"}</td><td className="p-3"><details><summary className="cursor-pointer text-primary">Ver detalles</summary><dl className="mt-3 grid gap-2">{preview.headers.map((header, index) => <div key={index}><dt className="font-medium">{header}</dt><dd className="break-words text-muted-foreground">{row.cells[index] || "Sin información"}</dd></div>)}</dl></details></td></tr>)}
      </tbody></table></div>
      <p className="text-xs text-muted-foreground">El archivo se validará nuevamente en el servidor. La importación guardará todas las respuestas o ninguna.</p>
    </section>}
    {preview && <div className="flex flex-wrap gap-3"><Button disabled={pending || reading || preview.errors.length > 0 || preview.rows.length === 0 || incompleteRelation || Boolean(primaryCheck?.error)}>{pending ? "Importando…" : "Confirmar importación"}</Button><Button type="button" variant="outline" onClick={() => { selection.current++; setPreview(null); setFileName(""); setSelectedFile(null); setChosenRows({}); setRelationships({}); if (fileInput.current) { fileInput.current.value = ""; fileInput.current.click(); } }}>Corregir archivo</Button><Button type="reset" variant="outline" onClick={() => { selection.current++; setPreview(null); setFileName(""); setSelectedFile(null); setChosenRows({}); setRelationships({}); setReading(false); setReadingError(""); }}>Cancelar</Button></div>}
    {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
  </form>;
}
