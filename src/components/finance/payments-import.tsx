"use client";

import { useRef, useState } from "react";
import { readSheet, type CellValue } from "read-excel-file/browser";
import { importPayments, type FinanceState } from "@/app/panel/propiedades/[propertyId]/cartera/actions";
import { Button } from "@/components/ui/button";
import { formatCop } from "@/lib/finance/constants";
import { FINANCE_MAX_FILE_BYTES, FINANCE_MAX_FILE_LABEL, FINANCE_MAX_ROWS } from "@/lib/finance/import-limits";
import { amountValue } from "@/lib/finance/receivable-amount";
import { dateValue, displayDate } from "@/lib/finance/receivable-date";
import { useFormActionState } from "@/lib/forms/use-form-action-state";

// «Importar pagos» (13/11/2026, pedido de Alejandro), igual que «Importar cartera»: se elige el Excel, se ve un resumen
// por apartamento (pagos, total y fechas) y al confirmar el servidor valida cada fila y registra todo o nada.
type Summary = { label: string; count: number; total: number; first: string; last: string };
const normalize = (value: CellValue | null) => { const key = String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_"); return key === "fecha_de_pago" || key === "fecha" ? "fecha_pago" : key; };

export function PaymentsImportButton({ propertyId }: { propertyId: string }) {
  const [state, action, pending] = useFormActionState(importPayments, undefined as FinanceState);
  // El aviso del servidor es del archivo que se envió; al elegir otro archivo deja de mostrarse (13/11/2026).
  const [submitted, setSubmitted] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Summary[]>([]);
  const [count, setCount] = useState(0);
  const [empty, setEmpty] = useState(0);
  const [previewError, setPreviewError] = useState("");

  async function selectFile(selected?: File) {
    setFile(selected ?? null); setPreview([]); setPreviewError(""); setCount(0); setEmpty(0);
    if (!selected) return;
    try {
      if (!selected.name.toLowerCase().endsWith(".xlsx") || selected.size > FINANCE_MAX_FILE_BYTES) throw new Error(`Selecciona un .xlsx de máximo ${FINANCE_MAX_FILE_LABEL}.`);
      const rows = await readSheet(selected);
      const headers = rows[0]?.map(normalize) ?? [];
      if (["torre", "apartamento", "valor", "fecha_pago"].some((name) => !headers.includes(name))) throw new Error("El archivo no corresponde a la plantilla de pagos: torre, apartamento, valor, fecha_pago y referencia (opcional).");
      if (rows.length < 2 || rows.length > FINANCE_MAX_ROWS + 1) throw new Error(`Incluye entre 1 y ${FINANCE_MAX_ROWS} filas de datos.`);
      const column = (name: string) => headers.indexOf(name);
      const groups = new Map<string, Summary>();
      let total = 0, skipped = 0;
      for (const row of rows.slice(1)) {
        if (row.every((cell) => String(cell ?? "").trim() === "")) continue;
        if (String(row[column("valor")] ?? "").trim() === "") { skipped += 1; continue; }
        const label = `${String(row[column("torre")] ?? "").trim()} · ${String(row[column("apartamento")] ?? "").trim()}`;
        const value = amountValue(row[column("valor")]);
        const day = dateValue(row[column("fecha_pago")]);
        const group = groups.get(label) ?? { label, count: 0, total: 0, first: day, last: day };
        group.count += 1; group.total += Number.isFinite(value) ? value : 0;
        if (day && (!group.first || day < group.first)) group.first = day;
        if (day && day > group.last) group.last = day;
        groups.set(label, group); total += 1;
      }
      setCount(total); setEmpty(skipped);
      setPreview([...groups.values()].sort((a, b) => a.label.localeCompare(b.label, "es", { numeric: true })));
    } catch (error) { setPreviewError(error instanceof Error ? error.message : "No pudimos leer el archivo."); }
  }
  function close() { setFile(null); setPreview([]); setCount(0); setEmpty(0); setPreviewError(""); if (inputRef.current) inputRef.current.value = ""; }

  return <>
    <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>Importar pagos</Button>
    <form onSubmit={(event) => { setSubmitted(file); action(event); }}><input type="hidden" name="propertyId" value={propertyId} />
      <input ref={inputRef} type="file" name="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" tabIndex={-1} aria-label="Elegir Excel de pagos" onChange={(event) => { void selectFile(event.target.files?.[0]); }} />
      {file && <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Importar pagos">
        <div className="grid max-h-[85vh] w-full max-w-2xl gap-4 overflow-y-auto rounded-2xl border bg-white p-5 text-sm shadow-lg">
          <div><h2 className="text-lg font-semibold">Importar pagos</h2><p className="mt-1 break-all text-muted-foreground">{file.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">Columnas: torre, apartamento, valor, fecha_pago y referencia (opcional). El orden de las columnas no importa. <a href="/api/templates/pagos" download className="font-medium text-primary underline underline-offset-2">Descargar plantilla</a></p></div>
          {previewError && <p role="alert" className="text-destructive">{previewError}</p>}
          {preview.length > 0 && <div className="overflow-x-auto rounded-xl border"><table className="min-w-full text-left text-xs">
            <thead className="bg-secondary font-semibold"><tr><th className="px-3 py-2">Apartamento</th><th className="px-3 py-2 text-right">Pagos</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2">Fecha del pago</th></tr></thead>
            <tbody>{preview.map((group) => <tr key={group.label} className="border-t"><td className="whitespace-nowrap px-3 py-2 font-medium">{group.label}</td><td className="px-3 py-2 text-right">{group.count}</td><td className="whitespace-nowrap px-3 py-2 text-right">{formatCop(group.total)}</td><td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{group.first === group.last ? displayDate(group.first) : `${displayDate(group.first)} a ${displayDate(group.last)}`}</td></tr>)}</tbody>
            <tfoot className="border-t bg-secondary/60 font-semibold"><tr><td className="px-3 py-2">{preview.length} {preview.length === 1 ? "apartamento" : "apartamentos"}</td><td className="px-3 py-2 text-right">{count}</td><td className="whitespace-nowrap px-3 py-2 text-right">{formatCop(preview.reduce((sum, group) => sum + group.total, 0))}</td><td /></tr></tfoot>
          </table><p className="border-t p-3 text-xs text-muted-foreground">Cada pago baja la deuda del apartamento, de la más antigua a la más nueva, con su fecha de pago. Al confirmar se valida cada fila y se registra todo o nada.{empty > 0 ? ` ${empty} ${empty === 1 ? "fila no tiene" : "filas no tienen"} valor y se saltan.` : ""}</p></div>}
          {!preview.length && !previewError && <p className="text-muted-foreground">Leyendo el archivo…</p>}
          <div className="flex flex-wrap items-center gap-2"><Button disabled={pending || preview.length === 0 || Boolean(previewError)}>{pending ? "Registrando…" : "Confirmar importación"}</Button><Button type="button" variant="outline" disabled={pending} onClick={close}>Cancelar</Button>
            {state?.error && submitted === file && <p role="alert" className="whitespace-pre-line text-sm text-destructive">{state.error}</p>}</div>
        </div>
      </div>}
    </form>
  </>;
}
