"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readSheet } from "read-excel-file/node";
import { requirePropertyAdmin } from "@/lib/auth/require-property-admin";
import { CENSUS_MAX_COLUMNS, CENSUS_MAX_FILE_BYTES, CENSUS_MAX_FILE_LABEL, CENSUS_MAX_ROWS, censusXlsxLimits, normalizeCensusHeader, parseCensusRows } from "@/lib/census/parse";
import { validatePrimarySelections } from "@/lib/census/primary-selection";
import { boundedXlsx } from "@/lib/finance/bounded-xlsx";

export type CensusImportState = { error?: string } | undefined;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function importCensus(_: CensusImportState, form: FormData): Promise<CensusImportState> {
  const propertyId = String(form.get("propertyId") ?? "");
  const file = form.get("file");
  const rawSelections = form.get("primarySelections");
  if (!uuidPattern.test(propertyId) || !(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx") || file.size < 1 || file.size > CENSUS_MAX_FILE_BYTES) {
    return { error: `Selecciona un Excel .xlsx de máximo ${CENSUS_MAX_FILE_LABEL}.` };
  }
  const { supabase } = await requirePropertyAdmin(propertyId);
  try {
    const archive = boundedXlsx(new Uint8Array(await file.arrayBuffer()), CENSUS_MAX_COLUMNS, censusXlsxLimits);
    const sheet = await readSheet(Buffer.from(archive));
    const preview = parseCensusRows(sheet);
    if (preview.errors.length) return { error: preview.errors.slice(0, 3).join(" ") };
    let submitted: unknown;
    try { submitted = JSON.parse(String(rawSelections ?? "")); }
    catch { return { error: "Elige los residentes principales antes de importar." }; }
    const { selections, error: selectionError } = validatePrimarySelections(preview.rows, submitted);
    if (selectionError) return { error: selectionError };
    const { error } = await supabase.rpc("import_census_with_primary", {
      target_property_id: propertyId,
      target_file_name: file.name,
      target_headers: preview.headers,
      target_rows: preview.rows,
      target_selections: selections,
    });
    if (error) {
      if (error.message.includes("census_requires_empty_structure")) return { error: "Esta propiedad ya tiene torres o apartamentos. La primera importación requiere la estructura vacía para evitar cruces." };
      if (error.message.includes("duplicate_primary_unit_or_email")) return { error: "El mismo correo no puede ser principal de dos apartamentos." };
      if (error.message.includes("primary_selection_changed")) return { error: "Este Excel ya se importó con otra selección principal. No se modificó ningún dato." };
      return { error: "No se pudo confirmar el censo. No se guardó ninguna fila; revisa el archivo y vuelve a intentarlo." };
    }
    revalidatePath(`/panel/propiedades/${propertyId}`);
    redirect(`/panel/propiedades/${propertyId}?importado=1`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: `No pudimos leer el Excel. Verifica que sea un .xlsx válido de máximo ${CENSUS_MAX_FILE_LABEL} y ${CENSUS_MAX_ROWS.toLocaleString("es-CO")} filas.` };
  }
}

export type CensusUpdateChange = { source_row: number; building_name: string; unit_code: string; full_name: string | null; change: "updated" | "created"; invitation: "new" | "replaced" | "resident_replaced" | null };
export type CensusUpdateSummary = { updated: number; created: number; unchanged: number; towers_created: number; invitations: number; replaced_residents: string[]; changes?: CensusUpdateChange[]; preview: boolean };
export type CensusUpdateState = { error?: string; summary?: CensusUpdateSummary } | undefined;

function censusUpdateError(message: string) {
  const row = /fila (\d+)/.exec(message)?.[1];
  const prefix = row ? `Fila ${row}: ` : "";
  if (message.includes("headers_mismatch")) return "Las columnas del Excel no coinciden con las del censo existente.";
  if (message.includes("no_existing_census")) return "Esta propiedad no tiene un censo previo para actualizar.";
  if (message.includes("email_in_use")) return `${prefix}ese correo ya está invitado en otro apartamento.`;
  if (message.includes("invalid_user_type")) return `${prefix}«Tipo de usuario» debe ser Propietario, Residente o Arrendatario para invitar.`;
  if (message.includes("invalid_census_email")) return `${prefix}el correo electrónico no es válido.`;
  if (message.includes("invalid_census")) return `${prefix}revisa la torre, el apartamento y las columnas.`;
  return "No se pudo procesar la actualización. No se guardó ningún cambio.";
}

// Vista previa (dry_run) y aplicación comparten la misma lectura del Excel y la misma función.
async function runCensusUpdate(form: FormData, dryRun: boolean): Promise<CensusUpdateState> {
  const propertyId = String(form.get("propertyId") ?? "");
  const file = form.get("file");
  if (!uuidPattern.test(propertyId) || !(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx") || file.size < 1 || file.size > CENSUS_MAX_FILE_BYTES) {
    return { error: `Selecciona un Excel .xlsx de máximo ${CENSUS_MAX_FILE_LABEL}.` };
  }
  const { supabase } = await requirePropertyAdmin(propertyId);
  let preview;
  try {
    const archive = boundedXlsx(new Uint8Array(await file.arrayBuffer()), CENSUS_MAX_COLUMNS, censusXlsxLimits);
    preview = parseCensusRows(await readSheet(Buffer.from(archive)));
  } catch {
    return { error: `No pudimos leer el Excel. Verifica que sea un .xlsx válido de máximo ${CENSUS_MAX_FILE_LABEL} y ${CENSUS_MAX_ROWS.toLocaleString("es-CO")} filas.` };
  }
  if (preview.errors.length) return { error: preview.errors.slice(0, 3).join(" ") };

  // Las columnas se comparan por nombre, no por posición; la de autorización se reconoce
  // aunque su texto cambie. Las celdas se reordenan al orden del censo existente.
  const { data: existing } = await supabase.from("census_imports").select("headers").eq("property_id", propertyId).order("created_at").limit(1).maybeSingle();
  const existingHeaders = Array.isArray(existing?.headers) ? existing.headers.map(String) : [];
  if (!existingHeaders.length) return { error: "Esta propiedad no tiene un censo previo para actualizar." };
  const columnKey = (header: string) => { const key = normalizeCensusHeader(header); return key.startsWith("autoriacion autorizo") ? "autoriacion autorizo" : key; };
  const existingKeys = existingHeaders.map(columnKey);
  const newKeys = preview.headers.map(columnKey);
  const missing = existingHeaders.filter((_, index) => !newKeys.includes(existingKeys[index]));
  const extra = preview.headers.filter((_, index) => !existingKeys.includes(newKeys[index]));
  if (missing.length || extra.length) {
    return { error: ["Las columnas del Excel no coinciden con las del censo existente.", missing.length ? `Faltan: ${missing.slice(0, 5).join(", ")}.` : "", extra.length ? `Sobran: ${extra.slice(0, 5).join(", ")}.` : ""].filter(Boolean).join(" ") };
  }
  const positions = existingKeys.map((key) => newKeys.indexOf(key));
  const rows = preview.rows.map((row) => ({ ...row, cells: positions.map((position) => row.cells[position] ?? null) }));

  const { data, error } = await supabase.rpc("update_census_from_excel", {
    target_property_id: propertyId, target_file_name: file.name, target_headers: existingHeaders, target_rows: rows, dry_run: dryRun,
  });
  if (error) return { error: censusUpdateError(error.message) };
  return { summary: data as CensusUpdateSummary };
}

export async function previewCensusUpdate(_: CensusUpdateState, form: FormData): Promise<CensusUpdateState> {
  return runCensusUpdate(form, true);
}

export async function applyCensusUpdate(_: CensusUpdateState, form: FormData): Promise<CensusUpdateState> {
  const result = await runCensusUpdate(form, false);
  if (result?.summary) revalidatePath(`/panel/propiedades/${String(form.get("propertyId"))}`);
  return result;
}
