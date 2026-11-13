import type { CellValue } from "read-excel-file/node";
// Con extensión .ts para que las pruebas (node --experimental-strip-types) encuentren los archivos.
import { amountValue } from "./receivable-amount.ts";
import { dateValue } from "./receivable-date.ts";
import { normalizeHeader, unitKey } from "./parse-receivables.ts";

// Lectura del Excel de «Importar pagos» (13/11/2026, pedido de Alejandro). Columnas: torre, apartamento, valor,
// fecha_pago y, opcional, referencia. Valor y fecha en cualquier formato común (como la cartera). Las filas sin valor
// se saltan y se cuentan; cada fila con error dice qué tiene mal.

type Cell = CellValue | null;

export const PAYMENT_REQUIRED_COLUMNS = ["torre", "apartamento", "valor", "fecha_pago"] as const;

export type ParsedPayment = { line: number; unit_id: string; amount: number; paid_on: string; reference: string };

/** Posición de cada columna según los encabezados, o null si falta alguna obligatoria. Acepta «fecha de pago». */
export function paymentColumnIndex(headerRow: Cell[]): Record<string, number> | null {
  const headers = headerRow.map((value) => { const key = normalizeHeader(value); return key === "fecha_de_pago" || key === "fecha" ? "fecha_pago" : key; });
  if (PAYMENT_REQUIRED_COLUMNS.some((name) => !headers.includes(name))) return null;
  return Object.fromEntries(headers.map((name, position) => [name, position]));
}

const text = (value: Cell) => String(value ?? "").trim();

export function parsePaymentRows(dataRows: Cell[][], index: Record<string, number>, unitIds: Map<string, string>, todayIso: string) {
  const rows: ParsedPayment[] = [];
  const rowErrors: string[] = [];
  let emptyValueRows = 0;
  dataRows.forEach((row, offset) => {
    if (row.every((cell) => text(cell) === "")) return;
    const line = offset + 2;
    if (text(row[index.valor]) === "") { emptyValueRows += 1; return; }
    const building = text(row[index.torre]), code = text(row[index.apartamento]);
    const amount = amountValue(row[index.valor]);
    const paidOn = dateValue(row[index.fecha_pago]);
    const reference = index.referencia === undefined ? "" : text(row[index.referencia]);
    const unitId = unitIds.get(unitKey(building, code));
    const problems: string[] = [];
    if (!unitId) problems.push(`no existe la torre «${building}», apartamento «${code}» en el conjunto`);
    if (!Number.isFinite(amount)) problems.push("el valor no es un número");
    else if (amount <= 0) problems.push("el valor del pago debe ser mayor que 0");
    if (!paidOn) problems.push("la fecha del pago no es una fecha válida");
    else if (paidOn > todayIso) problems.push("la fecha del pago no puede ser futura");
    if (reference.length > 120) problems.push("la referencia supera 120 caracteres");
    if (problems.length || !unitId) { rowErrors.push(`Fila ${line}: ${problems.join(", ")}`); return; }
    rows.push({ line, unit_id: unitId, amount: Math.round(amount * 100) / 100, paid_on: paidOn, reference });
  });
  return { rows, rowErrors, emptyValueRows };
}
