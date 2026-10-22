import assert from "node:assert/strict";
import { test } from "node:test";
import { censusRelationship, validatePrimarySelections } from "../../src/lib/census/primary-selection.ts";

const rows = [
  { source_row: 2, building_code: "T1", unit_code: "101", full_name: "Ana", email: "ana@example.com", user_type: "Propietario" },
  { source_row: 3, building_code: "T1", unit_code: "101", full_name: "Beto", email: "beto@example.com", user_type: "Arrendatario" },
  { source_row: 4, building_code: "T2", unit_code: "101", full_name: "Carla", email: "carla@example.com", user_type: "Residente" },
];

test("exige un principal por apartamento elegible y deriva la relación del Excel", () => {
  assert.match(validatePrimarySelections(rows, [{ source_row: 2 }]).error, /cada apartamento/);
  assert.deepEqual(validatePrimarySelections(rows, [
    { source_row: 3, relationship: "owner" }, { source_row: 4, relationship: "owner" },
  ]).selections, [{ source_row: 3, relationship: "resident" }, { source_row: 4, relationship: "resident" }]);
});

test("impide dos principales en el mismo apartamento", () => {
  assert.match(validatePrimarySelections(rows, [
    { source_row: 2 }, { source_row: 3 },
  ]).error, /solo un principal/);
});

test("impide repetir el correo principal en apartamentos distintos", () => {
  const repeated = [{ ...rows[0] }, { ...rows[2], email: "ANA@example.com" }];
  assert.match(validatePrimarySelections(repeated, [
    { source_row: 2 }, { source_row: 4 },
  ]).error, /mismo correo/);
});

test("rechaza filas sin correo de columna G o sin nombre", () => {
  assert.match(validatePrimarySelections(rows, [
    { source_row: 2 }, { source_row: 99 },
  ]).error, /correo válido/);
  assert.deepEqual(validatePrimarySelections([{ ...rows[0], email: "" }], []).selections, []);
});

test("reconoce variantes claras y bloquea tipos ambiguos", () => {
  assert.equal(censusRelationship({ ...rows[0], user_type: "PROPIETÁRIA" }), "owner");
  assert.equal(censusRelationship({ ...rows[0], user_type: "arrendataria" }), "resident");
  assert.match(validatePrimarySelections([{ ...rows[0], user_type: "Familiar" }], [{ source_row: 2 }]).error, /Tipo de usuario/);
});

test("preselecciona la primera fila elegible con tipo de usuario reconocido", async () => {
  const { defaultPrimaryRow } = await import("../../src/lib/census/primary-selection.ts");
  assert.equal(defaultPrimaryRow([rows[1], rows[0]]).source_row, 2);
  assert.equal(defaultPrimaryRow([{ ...rows[0], user_type: "Familiar" }, rows[1]]).source_row, 3);
  assert.equal(defaultPrimaryRow([{ ...rows[0], user_type: "Familiar" }]).source_row, 2);
  assert.equal(defaultPrimaryRow([{ ...rows[0], email: "" }]), undefined);
});
