import assert from "node:assert/strict";
import test from "node:test";
import { autoReference, dateValue, normalizeHeader, parseReceivableRows, receivableColumnIndex, unitKey } from "../../src/lib/finance/parse-receivables.ts";

const headers = ["Torre", "Apartamento", "Concepto", "Valor", "Fecha Emisión", "Fecha_Vencimiento", "TIPO"];
const units = new Map([[unitKey("Torre 1", "101"), "unidad-101"], [unitKey("Torre 2", "202"), "unidad-202"]]);
const parse = (...dataRows) => parseReceivableRows(dataRows, receivableColumnIndex(headers), units);
const valid = ["Torre 1", "101", "Administración octubre", 350000, "2026-10-01", "2026-10-10", "Obligación"];

test("los encabezados se reconocen sin importar mayúsculas, tildes ni espacios", () => {
  assert.equal(normalizeHeader(" Fecha  Emisión "), "fecha_emision");
  const index = receivableColumnIndex(headers);
  assert.equal(index.fecha_emision, 4);
  assert.equal(index.tipo, 6);
});

test("si falta una columna obligatoria no se lee el archivo", () => {
  assert.equal(receivableColumnIndex(headers.slice(0, 6)), null);
});

test("una fila válida se convierte en obligación con referencia automática", () => {
  const { rows, rowErrors } = parse(valid);
  assert.deepEqual(rowErrors, []);
  assert.equal(rows.length, 1);
  assert.deepEqual({ ...rows[0], external_reference: undefined }, { unit_id: "unidad-101", concept: "Administración octubre", amount: 350000, issued_on: "2026-10-01", due_on: "2026-10-10", external_reference: undefined, source: "import" });
  assert.match(rows[0].external_reference, /^AUTO-[0-9a-f]{32}$/);
});

test("el apartamento se encuentra aunque cambien mayúsculas o haya espacios", () => {
  const { rows } = parse(["  TORRE 2 ", " 202", "Multa", "50000", "2026-10-01", "2026-10-01", "obligacion"]);
  assert.equal(rows[0].unit_id, "unidad-202");
  assert.equal(rows[0].amount, 50000);
});

test("tipo «Saldo inicial» es opening_balance; Obligación e import son import", () => {
  const kinds = ["Saldo inicial", "OBLIGACIÓN", "import"].map((kind) => parse([...valid.slice(0, 6), kind]).rows[0].source);
  assert.deepEqual(kinds, ["opening_balance", "import", "import"]);
});

test("las fechas de Excel (Date) y el texto AAAA-MM-DD se aceptan; otros formatos no", () => {
  assert.equal(dateValue(new Date("2026-10-05T00:00:00Z")), "2026-10-05");
  assert.equal(dateValue(" 2026-10-05 "), "2026-10-05");
  assert.equal(dateValue("05/10/2026"), "");
  assert.equal(dateValue(null), "");
});

test("cada fila inválida se reporta con su número de fila en Excel y no se carga", () => {
  const { rows, rowErrors } = parse(
    valid, // fila 2: válida
    ["Torre 9", "101", "Administración", 1000, "2026-10-01", "2026-10-10", "Obligación"], // 3: apartamento que no existe
    ["Torre 1", "101", "Administración", 0, "2026-10-01", "2026-10-10", "Obligación"], // 4: valor cero
    ["Torre 1", "101", "Administración", -5, "2026-10-01", "2026-10-10", "Obligación"], // 5: valor negativo
    ["Torre 1", "101", "Administración", "mil", "2026-10-01", "2026-10-10", "Obligación"], // 6: valor que no es número
    ["Torre 1", "101", "Administración", 1000, "2026-10-10", "2026-10-01", "Obligación"], // 7: vence antes de emitirse
    ["Torre 1", "101", "Administración", 1000, "01/10/2026", "2026-10-10", "Obligación"], // 8: fecha con otro formato
    ["Torre 1", "101", "A", 1000, "2026-10-01", "2026-10-10", "Obligación"], // 9: concepto muy corto
    ["Torre 1", "101", "Administración", 1000, "2026-10-01", "2026-10-10", "Abono"], // 10: tipo desconocido
  );
  assert.equal(rows.length, 1);
  assert.deepEqual(rowErrors, ["Fila 3", "Fila 4", "Fila 5", "Fila 6", "Fila 7", "Fila 8", "Fila 9", "Fila 10"]);
});

test("la referencia automática es la misma para la misma deuda, para no cargarla dos veces", () => {
  assert.equal(autoReference("u", "Administración", "2026-10-01", 1000), autoReference("u", "  administración ", "2026-10-01", 1000.001));
  assert.notEqual(autoReference("u", "Administración", "2026-10-01", 1000), autoReference("u", "Administración", "2026-10-01", 1001));
  assert.notEqual(autoReference("u", "Administración", "2026-10-01", 1000), autoReference("u", "Administración", "2026-11-01", 1000));
});

test("si el archivo trae columna referencia se usa esa y se limita a 120 caracteres", () => {
  const withReference = [...headers, "Referencia"];
  const index = receivableColumnIndex(withReference);
  const ok = parseReceivableRows([[...valid, "FAC-001"]], index, units);
  assert.equal(ok.rows[0].external_reference, "FAC-001");
  const tooLong = parseReceivableRows([[...valid, "x".repeat(121)]], index, units);
  assert.deepEqual(tooLong.rowErrors, ["Fila 2"]);
});
