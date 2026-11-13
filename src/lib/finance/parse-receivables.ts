import { createHash } from "node:crypto";
import type { CellValue } from "read-excel-file/node";
// Con extensión .ts para que las pruebas (node --experimental-strip-types) encuentren el archivo.
import { dateValue } from "./receivable-date.ts";
import { amountValue } from "./receivable-amount.ts";

// Lectura del Excel de importación de cartera (plantilla de /api/templates/cartera). Separada de la acción del
// servidor (cartera/actions.ts) para poder probarla sin Supabase: tests/finance/parse-receivables.test.mjs.
// 12/11/2026: fechas DD/MM/AAAA, torre y apartamento sin importar tildes, mayúsculas ni espacios, y cada fila con
// error dice qué tiene mal. 13/11/2026: una fila con valor negativo es un saldo a favor (kind «credit»).

type Cell = CellValue | null;

export const RECEIVABLE_REQUIRED_COLUMNS = ["torre", "apartamento", "concepto", "valor", "fecha_emision", "fecha_vencimiento", "tipo"] as const;

// kind «credit» (13/11/2026): fila con valor negativo = saldo a favor del apartamento; amount va en positivo.
export type ParsedReceivable = { unit_id: string; concept: string; amount: number; issued_on: string; due_on: string; external_reference: string; source: string; kind?: "credit" };

export { dateValue };

/** «Fecha Emisión » → «fecha_emision»: minúsculas, sin tildes y con _ en vez de espacios. */
export function normalizeHeader(value: Cell) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_");
}

function textValue(value: Cell) {
  return String(value ?? "").trim();
}

/** Texto comparable: sin tildes, en minúsculas, con un solo espacio y sin la palabra «torre» o «apto» al inicio. */
function looseText(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()
    .replace(/^(torre|apartamento|apto\.?|apt\.?)\s*/, "");
}

/** Clave para encontrar el apartamento por torre y número: «TORRE 1» = «Torre 1» = «1», «Apto 101» = «101». */
export function unitKey(building: string, unitCode: string) {
  return `${looseText(building)}|${looseText(unitCode)}`;
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
 * rowErrors como «Fila N: motivo», con N igual al número de fila que el usuario ve en Excel.
 */
export function parseReceivableRows(dataRows: Cell[][], index: Record<string, number>, unitIds: Map<string, string>) {
  const rows: ParsedReceivable[] = [];
  // Filas con la celda de valor vacía (13/11/2026): el apartamento no debe nada en ese archivo; se saltan y se cuentan.
  let emptyValueRows = 0;
  const rowErrors: string[] = [];
  dataRows.forEach((row, offset) => {
    if (row.every((cell) => textValue(cell) === "")) return; // filas vacías: se ignoran
    if (textValue(row[index.valor]) === "") { emptyValueRows += 1; return; }
    const line = offset + 2;
    const building = textValue(row[index.torre]), code = textValue(row[index.apartamento]);
    const concept = textValue(row[index.concepto]);
    const rawAmount = row[index.valor];
    // Número de Excel o texto como «$ 128.000» (13/11/2026).
    const amount = amountValue(rawAmount);
    const issued = dateValue(row[index.fecha_emision]);
    const due = dateValue(row[index.fecha_vencimiento]);
    const reference = index.referencia === undefined ? "" : textValue(row[index.referencia]);
    const kind = normalizeHeader(row[index.tipo]);
    const unitId = unitIds.get(unitKey(building, code));
    const source = kind === "saldo_inicial" ? "opening_balance" : kind === "obligacion" || kind === "import" ? "import" : "";
    const problems: string[] = [];
    if (!unitId) problems.push(`no existe la torre «${building}», apartamento «${code}» en el conjunto`);
    if (concept.length < 2 || concept.length > 180) problems.push("el concepto debe tener entre 2 y 180 caracteres");
    const credit = Number.isFinite(amount) && amount < 0;
    if (!Number.isFinite(amount)) problems.push("el valor no es un número");
    else if (amount === 0) problems.push("el valor no puede ser 0");
    if (!issued) problems.push("la fecha de emisión debe ser DD/MM/AAAA");
    // Saldo a favor: la fecha de vencimiento no aplica.
    if (!credit && !due) problems.push("la fecha de vencimiento debe ser DD/MM/AAAA");
    if (!credit && issued && due && due < issued) problems.push("vence antes de la fecha de emisión");
    if (reference.length > 120) problems.push("la referencia supera 120 caracteres");
    if (!credit && !source) problems.push("el tipo debe ser «obligacion» o «saldo_inicial»");
    if (problems.length || !unitId) {
      rowErrors.push(`Fila ${line}: ${problems.join(", ")}`);
      return;
    }
    if (credit) {
      const value = Math.abs(amount);
      rows.push({ unit_id: unitId, concept, amount: value, issued_on: issued, due_on: due || issued, external_reference: reference || autoReference(unitId, `saldo a favor|${concept}`, issued, value), source: "credit", kind: "credit" });
      return;
    }
    rows.push({ unit_id: unitId, concept, amount, issued_on: issued, due_on: due, external_reference: reference || autoReference(unitId, concept, issued, amount), source });
  });
  return { rows, rowErrors, emptyValueRows };
}
