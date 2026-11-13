import assert from "node:assert/strict";
import test from "node:test";
import { parsePaymentRows, paymentColumnIndex } from "../../src/lib/finance/parse-payments.ts";
import { unitKey } from "../../src/lib/finance/parse-receivables.ts";

const headers = ["Torre", "Apartamento", "Valor", "Fecha de pago", "Referencia"];
const units = new Map([[unitKey("Torre 1", "101"), "u101"], [unitKey("Torre 2", "202"), "u202"]]);
const parse = (...rows) => parsePaymentRows(rows, paymentColumnIndex(headers), units, "2026-11-13");

test("los encabezados se reconocen; «Fecha de pago» cuenta como fecha_pago", () => {
  const index = paymentColumnIndex(headers);
  assert.equal(index.fecha_pago, 3);
  assert.equal(paymentColumnIndex(["torre", "apartamento", "valor"]), null);
});

test("cada fila válida es un pago con su fecha y referencia; valor y fecha en cualquier formato", () => {
  const { rows, rowErrors } = parse(["Torre 1", "101", "$ 128.000", "30/08/2026", "Transferencia 123"], ["TORRE 2", 202, 50000, "1 de octubre de 2026", ""]);
  assert.deepEqual(rowErrors, []);
  assert.deepEqual(rows, [
    { line: 2, unit_id: "u101", amount: 128000, paid_on: "2026-08-30", reference: "Transferencia 123", concept: "" },
    { line: 3, unit_id: "u202", amount: 50000, paid_on: "2026-10-01", reference: "", concept: "" },
  ]);
});

test("filas sin valor se saltan y se cuentan; las inválidas dicen qué tienen mal", () => {
  const { rows, rowErrors, emptyValueRows } = parse(
    ["Torre 1", "101", null, "30/08/2026", ""], // 2: sin valor
    ["Torre 9", "101", 1000, "30/08/2026", ""], // 3: no existe
    ["Torre 1", "101", -5, "30/08/2026", ""], // 4: negativo
    ["Torre 1", "101", 1000, "agosto", ""], // 5: fecha mala
    ["Torre 1", "101", 1000, "30/12/2026", ""], // 6: futura
  );
  assert.equal(rows.length, 0);
  assert.equal(emptyValueRows, 1);
  assert.deepEqual(rowErrors, [
    "Fila 3: no existe la torre «Torre 9», apartamento «101» en el conjunto",
    "Fila 4: el valor del pago debe ser mayor que 0",
    "Fila 5: la fecha del pago no es una fecha válida",
    "Fila 6: la fecha del pago no puede ser futura",
  ]);
});

test("si el Excel trae una columna concepto, se ignora: el pago va a la deuda más antigua", () => {
  const index = paymentColumnIndex([...headers, "Concepto"]);
  const { rows } = parsePaymentRows([["Torre 1", "101", 128000, "15/03/2026", "", "  Administración   marzo 2026 "]], index, units, "2026-11-13");
  assert.equal(rows[0].concept, "");
});
