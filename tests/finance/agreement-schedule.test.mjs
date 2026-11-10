import assert from "node:assert/strict";
import test from "node:test";
import { installmentStateLabels, parseSchedule } from "../../src/lib/finance/agreement-schedule.ts";
import { accountStatusLabel, formatCop } from "../../src/lib/finance/constants.ts";

test("el calendario del acuerdo convierte a número los valores que Postgres envía como texto", () => {
  const schedule = parseSchedule({
    agreement_id: "a1", status: "active", total: "900000.00", remaining: "600000", paid: "300000",
    installments: [
      { id: "c1", number: 1, due_on: "2026-11-01", amount: "300000.00", due_amount: "0", state: "paid" },
      { id: "c2", number: 2, due_on: "2026-12-01", amount: "300000.00", due_amount: "300000.00", state: "pending" },
    ],
  });
  assert.equal(schedule.total, 900000);
  assert.equal(schedule.remaining, 600000);
  assert.equal(schedule.paid, 300000);
  assert.deepEqual(schedule.installments.map((item) => [item.amount, item.due_amount]), [[300000, 0], [300000, 300000]]);
  assert.equal(schedule.total, schedule.paid + schedule.remaining);
});

test("sin calendario o con un valor que no es objeto devuelve null", () => {
  assert.equal(parseSchedule(null), null);
  assert.equal(parseSchedule("acuerdo"), null);
});

test("un acuerdo sin cuotas queda con la lista vacía", () => {
  assert.deepEqual(parseSchedule({ agreement_id: "a1", status: "active", total: 0, remaining: 0, paid: 0 }).installments, []);
});

test("cada estado de cuota tiene su etiqueta", () => {
  assert.deepEqual(installmentStateLabels, { paid: "Pagada", settled: "Sin saldo", late: "Vencida", pending: "Por vencer" });
});

test("los valores se muestran en pesos colombianos, sin ,00 cuando no hay centavos", () => {
  const plain = (value) => formatCop(value).replace(/\s/g, " ");
  assert.equal(plain(1500000), "$ 1.500.000");
  assert.equal(plain("350000.00"), "$ 350.000");
  assert.equal(plain("350000.5"), "$ 350.000,5");
});

test("estado de la cuenta del apartamento", () => {
  assert.equal(accountStatusLabel("current"), "Al día");
  assert.equal(accountStatusLabel("overdue"), "En mora");
  assert.equal(accountStatusLabel("otro"), "Pendiente");
});
