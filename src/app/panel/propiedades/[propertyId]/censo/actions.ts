"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readSheet } from "read-excel-file/node";
import { requirePropertyAdmin } from "@/lib/auth/require-property-admin";
import { parseCensusRows } from "@/lib/census/parse";
import { boundedXlsx } from "@/lib/finance/bounded-xlsx";

export type CensusImportState = { error?: string } | undefined;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function importCensus(_: CensusImportState, form: FormData): Promise<CensusImportState> {
  const propertyId = String(form.get("propertyId") ?? "");
  const file = form.get("file");
  if (!uuidPattern.test(propertyId) || !(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx") || file.size < 1 || file.size > 2 * 1024 * 1024) {
    return { error: "Selecciona un Excel .xlsx de máximo 2 MB." };
  }
  const { supabase } = await requirePropertyAdmin(propertyId);
  try {
    const archive = boundedXlsx(new Uint8Array(await file.arrayBuffer()), 80);
    const sheet = await readSheet(Buffer.from(archive));
    const preview = parseCensusRows(sheet);
    if (preview.errors.length) return { error: preview.errors.slice(0, 3).join(" ") };
    const { error } = await supabase.rpc("import_census", {
      target_property_id: propertyId,
      target_file_name: file.name,
      target_headers: preview.headers,
      target_rows: preview.rows,
    });
    if (error) {
      if (error.message.includes("census_requires_empty_structure")) return { error: "Esta propiedad ya tiene torres o apartamentos. La primera importación requiere la estructura vacía para evitar cruces." };
      return { error: "No se pudo confirmar el censo. No se guardó ninguna fila; revisa el archivo y vuelve a intentarlo." };
    }
    revalidatePath(`/panel/propiedades/${propertyId}`);
    revalidatePath(`/panel/propiedades/${propertyId}/censo`);
    redirect(`/panel/propiedades/${propertyId}/censo?importado=1`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: "No pudimos leer el Excel. Verifica que sea un .xlsx válido y menor de 2 MB." };
  }
}
