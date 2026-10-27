import assert from "node:assert/strict";
import test from "node:test";
import { parseCensusRows } from "../../src/lib/census/parse.ts";

const headers = [
  "TORRE", "APARTAMENTO ", "TIPO DE USUARIO", "NOMBRE COMPLETO", "CEDULA",
  "NUMERO DE TELEFONO", "CORREO ELECTRONICO", "¿CUANTAS PERSONAS VIVEN CON USTED?",
  "NOMBRES Y PARENTESCO DE LAS PERSONAS QUE VIVEN CON USTED",
  "¿EXISTE ALGUNA PERSONA CON DISCAPACIDAD?", "¿TIENE MASCOTAS?", "¿TIPO DE MASCOTAS?",
  "¿CUENTA CON VEHICULO?", "NUMERO DE PARQUEADERO",
  "¿AUTORIZA RECIBIR LAS FACTURAS DE ADMINISTRACION POR CORREO?",
  "¿A QUE CORREO SE LE HACE EL ENVIO DE LAS FACTURAS?", "¿CON CUANTOS VEHICULOS CUENTA?",
  "MARCA DE VEHICULO", "PLACA DEL VEHICULO", "TIPO DE VEHICULO",
  "PLACA DEL VEHICULO 2", "SI ES ARRENDATARIO ¿SU CONTRATO ESTA VINCULADO CON?",
  "NOMBRE DE LA INMOBILIARIA", "¿CUANTAS MASCOTAS TIENE?", "¿HAY MENORES DE EDAD EN EL APTO?",
  "¿CUANTOS MENORES DE EDAD VIVEN EN SU APTO?",
  "AUTORIACION: Autorizo a la administración del CONJUNTO LA PLAZUELA a tratar mis datos conforme en la ley 1581 de 2012",
];
const row = (tower, apartment, name, email) => {
  const result = Array(27).fill(null);
  result[0] = tower; result[1] = apartment; result[2] = "Propietario";
  result[3] = name; result[6] = email;
  return result;
};

test("reconoce 27 columnas, conserva vacíos y crea una respuesta por apartamento", () => {
  const result = parseCensusRows([headers, row("1", "101", "Persona Uno", "uno@example.invalid"), row("Torre 1", "102", "Persona Dos", "dos@example.invalid")]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.headers.length, 27);
  assert.equal(result.headers[1], "APARTAMENTO ");
  assert.equal(result.rows.length, 2);
  assert.equal(result.towerCount, 1);
  assert.equal(result.unitCount, 2);
  assert.equal(result.rows[0].cells[4], null);
  assert.equal(result.rows[0].building_name, "Torre 1");
});

test("bloquea un apartamento repetido aunque la torre esté escrita distinto", () => {
  const result = parseCensusRows([headers, row("1", "101", "Persona Uno", "uno@example.invalid"), row("torre 1", "101", "Persona Dos", "dos@example.invalid")]);
  assert.deepEqual(result.duplicateRows, [3]);
  assert.ok(result.errors.some((error) => error.includes("Torre 1 · Apto 101 está repetido en las filas 2, 3")));
});

test("detecta filas repetidas y preserva columnas adicionales", () => {
  const original = row("2", "201", "Persona Uno", "uno@example.invalid");
  const result = parseCensusRows([[...headers, "Color del vehículo"], [...original, "Color ficticio"], [...original, "Color ficticio"]]);
  assert.equal(result.additionalHeaders.length, 1);
  assert.equal(result.rows[0].cells[27], "Color ficticio");
  assert.deepEqual(result.duplicateRows, [3]);
  assert.ok(result.errors.some((error) => error.includes("más de una fila")));
});

test("rechaza columnas obligatorias ausentes", () => {
  const result = parseCensusRows([[...headers.slice(0, 6), ...headers.slice(7)], row("1", "101", "Persona", "uno@example.invalid")]);
  assert.ok(result.errors.some((error) => error.includes("correo electronico")));
});

test("accepts 2,000 responses across towers and rejects one more", async () => {
  const { CENSUS_MAX_ROWS } = await import("../../src/lib/census/parse.ts");
  const data = Array.from({ length: CENSUS_MAX_ROWS }, (_, i) => row(["Torre A", "B", "torre c"][i % 3], String(100 + Math.floor(i / 3)), `Persona ${i}`, `p${i}@resiq.invalid`));
  const preview = parseCensusRows([headers, ...data]);
  assert.deepEqual(preview.errors, []);
  assert.equal(preview.towerCount, 3);
  const over = parseCensusRows([headers, ...data, row("Torre A", "999", "Extra", "extra@resiq.invalid")]);
  assert.ok(over.errors.some((error) => error.includes("2.000")));
});

test("la columna anterior «tipo de vehiculo con el que cuenta» se acepta como «marca de vehiculo»", () => {
  const legacy = headers.map((header) => header === "MARCA DE VEHICULO" ? "TIPO DE VEHICULO CON EL QUE CUENTA" : header);
  const result = parseCensusRows([legacy, row("Torre A", "101", "Persona Uno", "uno@resiq.invalid")]);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.additionalHeaders, []);
});
