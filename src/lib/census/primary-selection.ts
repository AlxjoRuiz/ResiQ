import type { CensusImportRow } from "./parse";

export type PrimarySelection = { source_row: number; relationship: "owner" | "resident" };

export function censusUnitKey(row: CensusImportRow): string {
  return `${row.building_code}|${row.unit_code.toLocaleLowerCase("es")}`;
}

export function eligiblePrimary(row: CensusImportRow): boolean {
  return Boolean(row.full_name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email));
}

export function validatePrimarySelections(rows: CensusImportRow[], input: unknown): { selections: PrimarySelection[]; error?: string } {
  if (!Array.isArray(input) || input.length > rows.length) return { selections: [], error: "La selección de principales no es válida." };
  const bySource = new Map(rows.map((row) => [row.source_row, row]));
  const eligibleUnits = new Set(rows.filter(eligiblePrimary).map(censusUnitKey));
  const selectedUnits = new Set<string>();
  const selectedEmails = new Set<string>();
  const selections: PrimarySelection[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return { selections: [], error: "La selección de principales no es válida." };
    const source = (item as Record<string, unknown>).source_row;
    const relationship = (item as Record<string, unknown>).relationship;
    if (!Number.isInteger(source) || typeof source !== "number" || !["owner", "resident"].includes(String(relationship))) {
      return { selections: [], error: "Selecciona el tipo de acceso de cada principal." };
    }
    const row = bySource.get(source);
    if (!row || !eligiblePrimary(row)) return { selections: [], error: "El principal necesita nombre y correo válido en la columna G." };
    const unit = censusUnitKey(row);
    const email = row.email.toLowerCase();
    if (selectedUnits.has(unit)) return { selections: [], error: "Selecciona solo un principal por apartamento." };
    if (selectedEmails.has(email)) return { selections: [], error: "Un mismo correo no puede ser principal de dos apartamentos. Corrige el Excel antes de continuar." };
    selectedUnits.add(unit);
    selectedEmails.add(email);
    selections.push({ source_row: source, relationship: relationship as PrimarySelection["relationship"] });
  }
  if ([...eligibleUnits].some((unit) => !selectedUnits.has(unit))) {
    return { selections: [], error: "Elige un residente principal para cada apartamento que tenga nombre y correo válido." };
  }
  return { selections };
}
