import assert from "node:assert/strict";
import { test } from "node:test";
import { validatePrimarySelections } from "../../src/lib/census/primary-selection.ts";

const rows = [
  { source_row: 2, building_code: "T1", unit_code: "101", full_name: "Ana", email: "ana@example.com" },
  { source_row: 3, building_code: "T1", unit_code: "101", full_name: "Beto", email: "beto@example.com" },
  { source_row: 4, building_code: "T2", unit_code: "101", full_name: "Carla", email: "carla@example.com" },
];

test("exige un principal por apartamento elegible sin inferir relación", () => {
  assert.match(validatePrimarySelections(rows, [{ source_row: 2, relationship: "owner" }]).error, /cada apartamento/);
  assert.deepEqual(validatePrimarySelections(rows, [
    { source_row: 3, relationship: "resident" }, { source_row: 4, relationship: "owner" },
  ]).selections.map((item) => item.source_row), [3, 4]);
});

test("impide dos principales en el mismo apartamento", () => {
  assert.match(validatePrimarySelections(rows, [
    { source_row: 2, relationship: "owner" }, { source_row: 3, relationship: "resident" },
  ]).error, /solo un principal/);
});

test("impide repetir el correo principal en apartamentos distintos", () => {
  const repeated = [{ ...rows[0] }, { ...rows[2], email: "ANA@example.com" }];
  assert.match(validatePrimarySelections(repeated, [
    { source_row: 2, relationship: "owner" }, { source_row: 4, relationship: "resident" },
  ]).error, /mismo correo/);
});

test("rechaza filas sin correo de columna G o sin nombre", () => {
  assert.match(validatePrimarySelections(rows, [
    { source_row: 2, relationship: "owner" }, { source_row: 99, relationship: "resident" },
  ]).error, /correo válido/);
  assert.deepEqual(validatePrimarySelections([{ ...rows[0], email: "" }], []).selections, []);
});
