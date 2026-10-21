"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readSheet } from "read-excel-file/node";
import { requirePropertyAdmin } from "@/lib/auth/require-property-admin";
import { parseCensusRows } from "@/lib/census/parse";
import { validatePrimarySelections } from "@/lib/census/primary-selection";
import { boundedXlsx } from "@/lib/finance/bounded-xlsx";

export type CensusImportState = { error?: string } | undefined;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function importCensus(_: CensusImportState, form: FormData): Promise<CensusImportState> {
  const propertyId = String(form.get("propertyId") ?? "");
  const file = form.get("file");
  const rawSelections = form.get("primarySelections");
  if (!uuidPattern.test(propertyId) || !(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx") || file.size < 1 || file.size > 2 * 1024 * 1024) {
    return { error: "Selecciona un Excel .xlsx de máximo 2 MB." };
  }
  const { supabase } = await requirePropertyAdmin(propertyId);
  try {
    const archive = boundedXlsx(new Uint8Array(await file.arrayBuffer()), 80);
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
    return { error: "No pudimos leer el Excel. Verifica que sea un .xlsx válido y menor de 2 MB." };
  }
}
