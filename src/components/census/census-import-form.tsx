"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { readSheet } from "read-excel-file/browser";
import { importCensus, type CensusImportState } from "@/app/panel/propiedades/[propertyId]/censo/actions";
import { CENSUS_MAX_COLUMNS, CENSUS_MAX_FILE_BYTES, CENSUS_MAX_FILE_LABEL, censusTowerSummary, censusXlsxLimits, parseCensusRows, type CensusImportRow, type CensusPreview } from "@/lib/census/parse";
import { censusRelationship, censusUnitKey, defaultPrimaryRow, eligiblePrimary, validatePrimarySelections } from "@/lib/census/primary-selection";
import { boundedXlsx } from "@/lib/finance/bounded-xlsx";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";

const pageSize = 50;
type CensusUnit = { key: string; buildingCode: string; buildingName: string; unitCode: string; rows: CensusImportRow[]; eligible: CensusImportRow[] };

export function CensusImportForm({ propertyId }: { propertyId: string }) {
  const [state, action, pending] = useActionState(importCensus, undefined as CensusImportState);
  const [preview, setPreview] = useState<CensusPreview | null>(null);
  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [reading, setReading] = useState(false);
  const [readingError, setReadingError] = useState("");
  const [chosenRows, setChosenRows] = useState<Record<string, number>>({});
  const [towersConfirmed, setTowersConfirmed] = useState(false);
  const [towerFilter, setTowerFilter] = useState("");
  const [query, setQuery] = useState("");
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [page, setPage] = useState(0);
  const selection = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  function resetPreview() {
    selection.current++;
    setPreview(null); setFileName(""); setSelectedFile(null); setChosenRows({});
    setTowersConfirmed(false); setTowerFilter(""); setQuery(""); setOnlyAttention(false); setPage(0);
  }

  async function onFile(file: File | undefined) {
    resetPreview();
    const currentSelection = selection.current;
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

  const towers = useMemo(() => censusTowerSummary(preview?.rows ?? []), [preview]);
  const units = useMemo(() => {
    const grouped = new Map<string, CensusUnit>();
    for (const row of preview?.rows ?? []) {
      const key = censusUnitKey(row);
      const unit = grouped.get(key) ?? { key, buildingCode: row.building_code, buildingName: row.building_name, unitCode: row.unit_code, rows: [], eligible: [] };
      unit.rows.push(row);
      if (eligiblePrimary(row)) unit.eligible.push(row);
      grouped.set(key, unit);
    }
    return [...grouped.values()];
  }, [preview]);

  const chosenFor = (unit: CensusUnit) => chosenRows[unit.key] ?? defaultPrimaryRow(unit.rows)?.source_row ?? 0;
  const selected = units.map((unit) => ({ source_row: chosenFor(unit) })).filter((item) => item.source_row > 0);
  const primaryCheck = preview ? validatePrimarySelections(preview.rows, selected) : null;

  const chosenEmails = new Map<string, number>();
  for (const unit of units) {
    const email = unit.eligible.find((row) => row.source_row === chosenFor(unit))?.email;
    if (email) chosenEmails.set(email, (chosenEmails.get(email) ?? 0) + 1);
  }
  const needsAttention = (unit: CensusUnit) => {
    const chosen = unit.eligible.find((row) => row.source_row === chosenFor(unit));
    return unit.eligible.length > 1 || Boolean(chosen && (!censusRelationship(chosen) || (chosenEmails.get(chosen.email) ?? 0) > 1));
  };
  const attentionCount = units.filter(needsAttention).length;
  const withoutPrimary = units.filter((unit) => !unit.eligible.length).length;

  const search = query.trim().toLocaleLowerCase("es");
  const visible = units.filter((unit) => (!towerFilter || unit.buildingCode === towerFilter)
    && (!search || unit.unitCode.toLocaleLowerCase("es").includes(search) || unit.rows.some((row) => row.full_name.toLocaleLowerCase("es").includes(search)))
    && (!onlyAttention || needsAttention(unit)));
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageUnits = visible.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const filterChange = (apply: () => void) => { apply(); setPage(0); };

  return <form action={action} className="grid min-w-0 gap-5">
    <input type="hidden" name="propertyId" value={propertyId} />
    <input type="hidden" name="primarySelections" value={JSON.stringify(selected)} />
    <input type="hidden" name="confirmedTowers" value={towersConfirmed ? JSON.stringify(towers.map((tower) => tower.code)) : ""} />
    <FilePicker inputRef={fileInput} files={selectedFile ? [selectedFile] : []} onFilesChange={(files) => { void onFile(files[0]); }} title="Archivo del censo" hint={`Excel .xlsx · máximo ${CENSUS_MAX_FILE_LABEL}`} accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" name="file" disabled={pending || reading} />
    <p className="text-sm text-muted-foreground">En cada apartamento se preselecciona como principal la primera fila con nombre y correo de la columna G; puedes cambiarla. Por ahora no se envían invitaciones ni se vinculan cuentas.</p>
    {reading && <p role="status" className="text-sm">Leyendo el Excel…</p>}
    {readingError && <p role="alert" className="text-sm text-destructive">{readingError}</p>}
    {preview && <section className="min-w-0 space-y-5 rounded-xl border p-3 sm:p-5" aria-label="Vista previa del censo">
      <div><h3 className="font-semibold">Vista previa: {fileName}</h3><p className="text-sm text-muted-foreground">No se ha guardado nada todavía.</p></div>
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <p>Respuestas: <strong>{preview.rows.length.toLocaleString("es-CO")}</strong></p><p>Torres: <strong>{preview.towerCount}</strong></p>
        <p>Apartamentos: <strong>{preview.unitCount.toLocaleString("es-CO")}</strong></p><p>Residentes identificados: <strong>{preview.residentCount.toLocaleString("es-CO")}</strong></p>
        <p>Sin principal posible: <strong>{withoutPrimary}</strong></p><p>Duplicados: <strong>{preview.duplicateRows.length}</strong></p>
      </div>
      {preview.additionalHeaders.length > 0 && <p className="text-sm">Columnas adicionales: {preview.additionalHeaders.join(", ")}</p>}
      {preview.errors.length > 0 && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900"><p className="font-semibold">Corrige el archivo antes de importar:</p><ul className="mt-2 list-disc pl-5">{preview.errors.slice(0, 20).map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul>{preview.errors.length > 20 && <p className="mt-2">Y {preview.errors.length - 20} errores más.</p>}</div>}

      {towers.length > 0 && <div className="space-y-3">
        <h4 className="font-semibold">Torres que se van a crear</h4>
        <div className="overflow-auto rounded-lg border"><table className="w-full min-w-[22rem] text-left text-sm"><thead className="bg-secondary"><tr><th className="p-2">Torre</th><th className="p-2">Apartamentos</th><th className="p-2">Respuestas</th></tr></thead><tbody>
          {towers.map((tower) => <tr key={tower.code} className="border-t"><td className="p-2 font-medium">{tower.name}</td><td className="p-2">{tower.units}</td><td className="p-2">{tower.rows}</td></tr>)}
        </tbody></table></div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={towersConfirmed} onChange={(event) => setTowersConfirmed(event.target.checked)} /><span>Confirmo que estas {towers.length} torres son correctas. Si ves una torre de más (por ejemplo «Torre L» en vez de «Torre 1»), corrige el Excel antes de importar.</span></label>
      </div>}

      {units.length > 0 && <div className="space-y-3">
        <h4 className="font-semibold">Apartamentos y principal</h4>
        {attentionCount > 0 && <p className="text-sm text-amber-800">{attentionCount} apartamentos tienen varias personas con correo o un dato por revisar.</p>}
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="grid gap-1 text-sm"><span>Torre</span><select className="h-10 rounded-md border bg-white px-3" value={towerFilter} onChange={(event) => filterChange(() => setTowerFilter(event.target.value))}><option value="">Todas</option>{towers.map((tower) => <option key={tower.code} value={tower.code}>{tower.name}</option>)}</select></label>
          <label className="grid gap-1 text-sm"><span>Buscar apartamento o nombre</span><input className="h-10 rounded-md border bg-white px-3" value={query} onChange={(event) => filterChange(() => setQuery(event.target.value))} /></label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={onlyAttention} onChange={(event) => filterChange(() => setOnlyAttention(event.target.checked))} />Solo los que requieren revisión</label>
        </div>
        <p className="text-xs text-muted-foreground">Mostrando {visible.length ? currentPage * pageSize + 1 : 0}–{Math.min((currentPage + 1) * pageSize, visible.length)} de {visible.length.toLocaleString("es-CO")} apartamentos.</p>
        {pageUnits.map((unit) => {
          const chosen = chosenFor(unit);
          const selectedRow = unit.eligible.find((row) => row.source_row === chosen);
          const relationship = selectedRow ? censusRelationship(selectedRow) : null;
          const repeated = selectedRow && (chosenEmails.get(selectedRow.email) ?? 0) > 1;
          return <div key={unit.key} className={`grid min-w-0 gap-2 rounded-lg border p-3 ${needsAttention(unit) ? "border-amber-300 bg-amber-50/40" : ""}`}>
            <label className="grid min-w-0 gap-1 text-sm"><span className="font-medium">{unit.buildingName} · Apto {unit.unitCode} <span className="font-normal text-muted-foreground">({unit.rows.length} {unit.rows.length === 1 ? "persona" : "personas"})</span></span><select className="h-10 w-full min-w-0 rounded-md border bg-white px-3" value={chosen} disabled={!unit.eligible.length} onChange={(event) => setChosenRows((current) => ({ ...current, [unit.key]: Number(event.target.value) }))}><option value={0}>{unit.eligible.length ? "Selecciona residente principal" : "Sin nombre y correo elegibles"}</option>{unit.eligible.map((row) => <option key={row.source_row} value={row.source_row}>{row.full_name} · {row.email} (fila {row.source_row})</option>)}</select></label>
            {selectedRow && <p className="text-xs text-muted-foreground">Tipo de usuario del Excel: {selectedRow.user_type || "Sin información"}{relationship ? ` · ${relationship === "owner" ? "Propietario" : "Residente"} para acceso futuro` : " · Corrige este valor antes de importar"}{repeated ? " · Este correo es principal en otro apartamento" : ""}</p>}
            <details className="text-sm"><summary className="cursor-pointer text-primary">Ver respuestas del apartamento</summary>{unit.rows.map((row) => <dl key={row.source_row} className="mt-3 grid gap-2 border-t pt-3"><p className="font-medium">Fila {row.source_row}: {row.full_name || "Sin nombre"}</p>{preview.headers.map((header, index) => <div key={index}><dt className="font-medium">{header}</dt><dd className="break-words text-muted-foreground">{row.cells[index] || "Sin información"}</dd></div>)}</dl>)}</details>
          </div>;
        })}
        {pageCount > 1 && <div className="flex items-center gap-3"><Button type="button" variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anterior</Button><span className="text-sm">Página {currentPage + 1} de {pageCount}</span><Button type="button" variant="outline" size="sm" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>Siguiente</Button></div>}
        {primaryCheck?.error && <p role="status" className="text-sm text-amber-800">{primaryCheck.error}</p>}
      </div>}
      <p className="text-xs text-muted-foreground">El archivo se validará nuevamente en el servidor. La importación guardará todas las respuestas o ninguna.</p>
    </section>}
    {preview && <div className="flex flex-wrap gap-3"><Button disabled={pending || reading || !towersConfirmed || preview.errors.length > 0 || preview.rows.length === 0 || Boolean(primaryCheck?.error)}>{pending ? "Importando…" : "Confirmar importación"}</Button><Button type="button" variant="outline" onClick={() => { resetPreview(); if (fileInput.current) { fileInput.current.value = ""; fileInput.current.click(); } }}>Corregir archivo</Button><Button type="reset" variant="outline" onClick={() => { resetPreview(); setReading(false); setReadingError(""); }}>Cancelar</Button></div>}
    {preview && !towersConfirmed && towers.length > 0 && <p className="text-sm text-muted-foreground">Confirma las torres para habilitar la importación.</p>}
    {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
  </form>;
}
