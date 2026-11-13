import assert from "node:assert/strict";
import test from "node:test";
import { amountValue } from "../../src/lib/finance/receivable-amount.ts";
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

test("las fechas DD/MM/AAAA, las de Excel (Date) y AAAA-MM-DD se aceptan; las que no existen no", () => {
  assert.equal(dateValue("05/10/2026"), "2026-10-05");
  assert.equal(dateValue(" 5/1/2026 "), "2026-01-05");
  assert.equal(dateValue("05-10-2026"), "2026-10-05");
  assert.equal(dateValue(new Date("2026-10-05T00:00:00Z")), "2026-10-05");
  assert.equal(dateValue(" 2026-10-05 "), "2026-10-05");
  assert.equal(dateValue("31/02/2026"), "");
  assert.equal(dateValue("10/2026"), "");
  assert.equal(dateValue(null), "");
});

test("la torre y el apartamento se encuentran sin importar tildes, mayúsculas, espacios ni la palabra torre", () => {
  const map = new Map([[unitKey("Torre Única", "101"), "u1"], [unitKey("Torre 3", "202"), "u3"]]);
  const index = receivableColumnIndex(headers);
  const row = (building, code) => [building, code, "Administración", 1000, "01/10/2026", "31/10/2026", "obligacion"];
  const { rows, rowErrors } = parseReceivableRows([row("TORRE  UNICA", "101"), row("3", "Apto 202"), row(" torre 3 ", "202")], index, map);
  assert.deepEqual(rowErrors, []);
  assert.deepEqual(rows.map((item) => item.unit_id), ["u1", "u3", "u3"]);
});

test("las filas vacías se ignoran", () => {
  const { rows, rowErrors } = parse(valid, [null, null, "", null, null, null, null]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rowErrors, []);
});

test("cada fila inválida se reporta con su número de fila en Excel y no se carga", () => {
  const { rows, rowErrors } = parse(
    valid, // fila 2: válida
    ["Torre 9", "101", "Administración", 1000, "2026-10-01", "2026-10-10", "Obligación"], // 3: apartamento que no existe
    ["Torre 1", "101", "Administración", 0, "2026-10-01", "2026-10-10", "Obligación"], // 4: valor cero
    ["Torre 1", "101", "Administración", "mil", "2026-10-01", "2026-10-10", "Obligación"], // 5: valor que no es número
    ["Torre 1", "101", "Administración", 1000, "2026-10-10", "2026-10-01", "Obligación"], // 6: vence antes de emitirse
    ["Torre 1", "101", "Administración", 1000, "octubre", "2026-10-10", "Obligación"], // 7: fecha que no es fecha
    ["Torre 1", "101", "A", 1000, "2026-10-01", "2026-10-10", "Obligación"], // 8: concepto muy corto
    ["Torre 1", "101", "Administración", 1000, "2026-10-01", "2026-10-10", "Abono"], // 9: tipo desconocido
  );
  assert.equal(rows.length, 1);
  assert.deepEqual(rowErrors, [
    "Fila 3: no existe la torre «Torre 9», apartamento «101» en el conjunto",
    "Fila 4: el valor no puede ser 0",
    "Fila 5: el valor no es un número",
    "Fila 6: vence antes de la fecha de emisión",
    "Fila 7: la fecha de emisión debe ser DD/MM/AAAA",
    "Fila 8: el concepto debe tener entre 2 y 180 caracteres",
    "Fila 9: el tipo debe ser «obligacion» o «saldo_inicial»",
  ]);
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
  assert.deepEqual(tooLong.rowErrors, ["Fila 2: la referencia supera 120 caracteres"]);
});

test("una fila con valor negativo es un saldo a favor, con el valor en positivo y sin exigir vencimiento", () => {
  const { rows, rowErrors } = parse(["Torre 1", "101", "Saldo a favor octubre", -84147, "01/10/2026", "", "obligacion"]);
  assert.deepEqual(rowErrors, []);
  assert.equal(rows[0].kind, "credit");
  assert.equal(rows[0].amount, 84147);
  assert.equal(rows[0].issued_on, "2026-10-01");
  assert.match(rows[0].external_reference, /^AUTO-[0-9a-f]{32}$/);
});

test("el valor se entiende como número de Excel o como texto al estilo colombiano", () => {
  assert.equal(amountValue(128000), 128000);
  assert.equal(amountValue("$ 128.000"), 128000);
  assert.equal(amountValue("128.000"), 128000);
  assert.equal(amountValue("128,000"), 128000);
  assert.equal(amountValue("1.250.000,50"), 1250000.5);
  assert.equal(amountValue("1,250,000.50"), 1250000.5);
  assert.equal(amountValue("COP 52.610"), 52610);
  assert.equal(amountValue("-84.147"), -84147);
  assert.equal(amountValue("(84.147)"), -84147);
  assert.equal(amountValue("270443,2"), 270443.2);
  assert.ok(Number.isNaN(amountValue("mil")));
  assert.ok(Number.isNaN(amountValue("")));
  const { rows } = parse(["Torre 1", "101", "Administración", "$ 128.000", "01/10/2026", "31/10/2026", "obligacion"]);
  assert.equal(rows[0].amount, 128000);
});

test("una fila con la celda de valor vacía se salta y se cuenta (el apartamento no debe nada)", () => {
  const { rows, rowErrors, emptyValueRows } = parse(valid, ["Torre 1", "101", "Cuota junio", null, "01/06/2026", "30/06/2026", "obligacion"], ["Torre 2", "202", "Cuota junio", "", "01/06/2026", "30/06/2026", "obligacion"]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rowErrors, []);
  assert.equal(emptyValueRows, 2);
});

test("las fechas se aceptan en cualquier formato común", () => {
  assert.equal(dateValue(46203), "2026-06-30");
  assert.equal(dateValue("46203"), "2026-06-30");
  assert.equal(dateValue("30.06.2026"), "2026-06-30");
  assert.equal(dateValue("30/6/26"), "2026-06-30");
  assert.equal(dateValue("2026/06/30"), "2026-06-30");
  assert.equal(dateValue("30/06/2026 12:00"), "2026-06-30");
  assert.equal(dateValue("2026-06-30T00:00:00Z"), "2026-06-30");
  assert.equal(dateValue("30 de junio de 2026"), "2026-06-30");
  assert.equal(dateValue("30-jun-2026"), "2026-06-30");
  assert.equal(dateValue("Junio 30 2026"), "2026-06-30");
  assert.equal(dateValue("Jun 30, 2026"), "2026-06-30");
  assert.equal(dateValue("30 sept 26"), "2026-09-30");
  assert.equal(dateValue("31/02/2026"), "");
  assert.equal(dateValue("junio"), "");
});
