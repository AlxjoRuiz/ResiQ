// Límites del censo compartidos por la vista previa, el servidor y el lector del Excel.
// La base de datos repite CENSUS_MAX_ROWS en 20261022120000_census_capacity_2000.sql.
export const CENSUS_MAX_ROWS = 2000;
export const CENSUS_MAX_FILE_BYTES = 4 * 1024 * 1024;
export const CENSUS_MAX_FILE_LABEL = "4 MB";
export const CENSUS_MAX_COLUMNS = 80;
export const censusXlsxLimits = {
  maxRows: CENSUS_MAX_ROWS,
  maxInputBytes: CENSUS_MAX_FILE_BYTES,
  maxEntryBytes: 12 * 1024 * 1024,
  maxExpandedBytes: 32 * 1024 * 1024,
};

export type CensusImportRow = {
  source_row: number;
  building_name: string;
  building_code: string;
  unit_code: string;
  full_name: string;
  user_type: string;
  email: string;
  phone: string;
  cells: (string | null)[];
};

export type CensusPreview = {
  headers: string[];
  rows: CensusImportRow[];
  errors: string[];
  duplicateRows: number[];
  towerCount: number;
  unitCount: number;
  residentCount: number;
  additionalHeaders: string[];
};

const expectedHeaders = [
  "torre", "apartamento", "tipo de usuario", "nombre completo", "cedula",
  "numero de telefono", "correo electronico", "cuantas personas viven con usted",
  "nombres y parentesco de las personas que viven con usted",
  "existe alguna persona con discapacidad", "tiene mascotas", "tipo de mascotas",
  "cuenta con vehiculo", "numero de parqueadero",
  "autoriza recibir las facturas de administracion por correo",
  "a que correo se le hace el envio de las facturas",
  "con cuantos vehiculos cuenta", "marca de vehiculo",
  "placa del vehiculo", "tipo de vehiculo", "placa del vehiculo 2",
  "si es arrendatario su contrato esta vinculado con", "nombre de la inmobiliaria",
  "cuantas mascotas tiene", "hay menores de edad en el apto",
  "cuantos menores de edad viven en su apto", "autoriacion autorizo a la administracion",
];

// «Tipo de vehículo con el que cuenta» pasó a llamarse «Marca de vehículo» (27/10/2026); los Excel
// con el nombre anterior se siguen aceptando como la misma columna.
const legacyHeaders: Record<string, string> = { "tipo de vehiculo con el que cuenta": "marca de vehiculo" };

export function normalizeCensusHeader(value: string) {
  const key = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  // «AUTORIZACION» bien escrita equivale a «AUTORIACION», como venía en el formulario original (28/10/2026).
  const authorization = key.startsWith("autorizacion ") ? `autoriacion ${key.slice("autorizacion ".length)}` : key;
  return legacyHeaders[authorization] ?? authorization;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function originalCell(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function canonicalTower(value: string): { name: string; code: string } | null {
  const raw = value.trim().replace(/\s+/g, " ");
  const match = /^(?:(?:torre|bloque)\s*)?([a-z0-9][a-z0-9 -]{0,17})$/i.exec(raw);
  if (!match) return null;
  const suffix = match[1].trim().toUpperCase();
  const code = `T${suffix.replace(/[^A-Z0-9]/g, "")}`;
  if (code.length > 20) return null;
  return { name: `Torre ${suffix}`, code };
}

export function parseCensusRows(sheetRows: readonly (readonly unknown[])[]): CensusPreview {
  const errors: string[] = [];
  const duplicateRows: number[] = [];
  if (!sheetRows.length) return { headers: [], rows: [], errors: ["El Excel está vacío."], duplicateRows, towerCount: 0, unitCount: 0, residentCount: 0, additionalHeaders: [] };
  const width = Math.max(...sheetRows.map((row) => row.length));
  let lastUsedColumn = width - 1;
  while (lastUsedColumn >= 0 && sheetRows.every((row) => !cellText(row[lastUsedColumn]))) lastUsedColumn--;
  const headers = Array.from({ length: lastUsedColumn + 1 }, (_, index) => originalCell(sheetRows[0][index]) ?? "");
  if (headers.length > CENSUS_MAX_COLUMNS) errors.push(`El Excel tiene más de ${CENSUS_MAX_COLUMNS} columnas con datos.`);
  if (headers.some((header) => !header.trim())) errors.push("Todas las columnas con datos necesitan encabezado.");
  const normalized = headers.map(normalizeCensusHeader);
  if (new Set(normalized).size !== normalized.length) errors.push("Hay encabezados repetidos.");
  const required = ["torre", "apartamento", "tipo de usuario", "nombre completo", "correo electronico"];
  for (const name of required) if (!normalized.includes(name)) errors.push(`Falta la columna ${name}.`);
  if (expectedHeaders.some((name) => !normalized.some((header) => header === name || (name.startsWith("autoriacion") && header.startsWith("autoriacion autorizo"))))) {
    errors.push("Este archivo no contiene los 27 encabezados del censo acordado.");
  }
  const index = (name: string) => normalized.indexOf(name);
  const rows: CensusImportRow[] = [];
  // Una sola respuesta por apartamento: la de quien vive ahí (decisión de Alejandro, 23/10/2026).
  const rowsByUnit = new Map<string, { label: string; sources: number[] }>();
  const towers = new Set<string>();
  for (const [offset, raw] of sheetRows.slice(1).entries()) {
    if (!raw.some((value) => cellText(value))) continue;
    const sourceRow = offset + 2;
    const cells = headers.map((_, position) => originalCell(raw[position]));
    const tower = canonicalTower(cellText(raw[index("torre")]));
    const unitCode = cellText(raw[index("apartamento")]);
    const fullName = cellText(raw[index("nombre completo")]);
    const userType = cellText(raw[index("tipo de usuario")]);
    const email = cellText(raw[index("correo electronico")]).toLowerCase();
    const phone = cellText(raw[index("numero de telefono")]);
    if (!tower || !unitCode || unitCode.length > 30) { errors.push(`Fila ${sourceRow}: torre o apartamento inválido.`); continue; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push(`Fila ${sourceRow}: correo inválido.`);
    const unitKey = `${tower.code}|${unitCode.toLocaleLowerCase("es")}`;
    const unit = rowsByUnit.get(unitKey) ?? { label: `${tower.name} · Apto ${unitCode}`, sources: [] };
    if (unit.sources.length) duplicateRows.push(sourceRow);
    unit.sources.push(sourceRow);
    rowsByUnit.set(unitKey, unit);
    towers.add(tower.code);
    rows.push({ source_row: sourceRow, building_name: tower.name, building_code: tower.code,
      unit_code: unitCode, full_name: fullName, user_type: userType, email, phone, cells });
  }
  if (!rows.length) errors.push("El Excel no contiene respuestas con torre y apartamento.");
  if (rows.length > CENSUS_MAX_ROWS) errors.push(`El Excel supera el máximo de ${CENSUS_MAX_ROWS.toLocaleString("es-CO")} respuestas.`);
  const repeatedUnits = [...rowsByUnit.values()].filter((unit) => unit.sources.length > 1);
  if (repeatedUnits.length) {
    errors.push(`Hay ${repeatedUnits.length} apartamentos con más de una fila. Deja una sola fila por apartamento: la de quien vive ahí.`);
    for (const unit of repeatedUnits.slice(0, 20)) errors.push(`${unit.label} está repetido en las filas ${unit.sources.join(", ")}.`);
    if (repeatedUnits.length > 20) errors.push(`Y ${repeatedUnits.length - 20} apartamentos repetidos más.`);
  }
  const additionalHeaders = headers.filter((_, position) => !expectedHeaders.includes(normalized[position]) && !normalized[position].startsWith("autoriacion autorizo"));
  return { headers, rows, errors, duplicateRows, towerCount: towers.size, unitCount: rowsByUnit.size,
    residentCount: rows.filter((row) => row.full_name || row.email).length, additionalHeaders };
}
