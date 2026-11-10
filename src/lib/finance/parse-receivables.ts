import { createHash } from "node:crypto";
import type { CellValue } from "read-excel-file/node";

// Lectura del Excel de importación de cartera (plantilla de /api/templates/cartera). Separada de la acción del
// servidor (cartera/actions.ts) para poder probarla sin Supabase: tests/finance/parse-receivables.test.mjs.

type Cell = CellValue | null;

export const RECEIVABLE_REQUIRED_COLUMNS = ["torre", "apartamento", "concepto", "valor", "fecha_emision", "fecha_vencimiento", "tipo"] as const;

export type ParsedReceivable = { unit_id: string; concept: string; amount: number; issued_on: string; due_on: string; external_reference: string; source: string };

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

/** «Fecha Emisión » → «fecha_emision»: minúsculas, sin tildes y con _ en vez de espacios. */
export function normalizeHeader(value: Cell) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_");
}

/** Fecha de Excel (Date) o texto AAAA-MM-DD; cualquier otra cosa devuelve "". */
export function dateValue(value: Cell) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value ?? "").trim();
  return isoDatePattern.test(text) ? text : "";
}

function textValue(value: Cell) {
  return String(value ?? "").trim();
}

/** Clave para encontrar el apartamento por torre y número, sin importar mayúsculas ni espacios de los extremos. */
export function unitKey(building: string, unitCode: string) {
  return `${building.trim().toLowerCase()}|${unitCode.trim().toLowerCase()}`;
}

/**
 * Sin columna «referencia», cada fila se identifica por apartamento, concepto, emisión y valor; así la base de
 * datos reconoce y salta las obligaciones que ya estaban cargadas.
 */
export function autoReference(unitId: string, concept: string, issued: string, amount: number) {
  return `AUTO-${createHash("sha256").update(`${unitId}|${concept.trim().toLowerCase()}|${issued}|${amount.toFixed(2)}`).digest("hex").slice(0, 32)}`;
}

/** Posición de cada columna según los encabezados, o null si falta alguna obligatoria. */
export function receivableColumnIndex(headerRow: Cell[]): Record<string, number> | null {
  const headers = headerRow.map(normalizeHeader);
  if (RECEIVABLE_REQUIRED_COLUMNS.some((name) => !headers.includes(name))) return null;
  return Object.fromEntries(headers.map((name, position) => [name, position]));
}

/**
 * Convierte las filas de datos (sin la de encabezados) en obligaciones. Una fila no válida no se carga y queda en
 * rowErrors como «Fila N», con N igual al número de fila que el usuario ve en Excel.
 */
export function parseReceivableRows(dataRows: Cell[][], index: Record<string, number>, unitIds: Map<string, string>) {
  const rows: ParsedReceivable[] = [];
  const rowErrors: string[] = [];
  dataRows.forEach((row, offset) => {
    const line = offset + 2;
    const concept = textValue(row[index.concepto]);
    const amount = Number(row[index.valor]);
    const issued = dateValue(row[index.fecha_emision]);
    const due = dateValue(row[index.fecha_vencimiento]);
    const reference = index.referencia === undefined ? "" : textValue(row[index.referencia]);
    const kind = normalizeHeader(row[index.tipo]);
    const unitId = unitIds.get(unitKey(textValue(row[index.torre]), textValue(row[index.apartamento])));
    const source = kind === "saldo_inicial" ? "opening_balance" : kind === "obligacion" || kind === "import" ? "import" : "";
    if (!unitId || concept.length < 2 || concept.length > 180 || !Number.isFinite(amount) || amount <= 0 || !issued || !due || due < issued || reference.length > 120 || !source) {
      rowErrors.push(`Fila ${line}`);
      return;
    }
    rows.push({ unit_id: unitId, concept, amount, issued_on: issued, due_on: due, external_reference: reference || autoReference(unitId, concept, issued, amount), source });
  });
  return { rows, rowErrors };
}
