import { strToU8, zipSync } from "fflate";
import { NextResponse } from "next/server";
import { normalizeCensusHeader } from "@/lib/census/parse";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type UnitRelation = { code: string; buildings: { name: string } | { name: string }[] | null } | { code: string; buildings: { name: string } | { name: string }[] | null }[] | null;
type CensusRow = { import_id: string; source_row: number; cells: unknown; units: UnitRelation };
const one = <T,>(value: T | T[] | null) => (Array.isArray(value) ? value[0] ?? null : value);
const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const columnKey = (header: string) => { const key = normalizeCensusHeader(header); return key.startsWith("autoriacion autorizo") ? "autoriacion autorizo" : key; };

// «Descargar censo»: el censo actual con los mismos encabezados que se importan, ordenado por torre
// y apartamento, para editarlo y volver a subirlo con «Actualizar censo». Solo administración.
export async function GET(_: Request, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  if (!uuidPattern.test(propertyId)) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data: member } = await supabase.from("property_members").select("roles").eq("property_id", propertyId).eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (!member || !(member.roles as string[]).includes("administrator")) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  const { data: imports, error: importError } = await supabase.from("census_imports").select("id,headers").eq("property_id", propertyId).order("created_at");
  if (importError) return NextResponse.json({ error: "No disponible." }, { status: 500 });
  if (!imports?.length) return NextResponse.json({ error: "Este conjunto todavía no tiene censo." }, { status: 404 });
  // Encabezados del primer censo; las filas de actualizaciones se acomodan a ellos por nombre.
  const headers = (Array.isArray(imports[0].headers) ? imports[0].headers : []).map(String);
  const keys = headers.map(columnKey);
  const positionsByImport = new Map(imports.map((item) => { const own = (Array.isArray(item.headers) ? item.headers : []).map((header) => columnKey(String(header))); return [item.id, keys.map((key) => own.indexOf(key))]; }));
  const records: CensusRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("census_records").select("import_id,source_row,cells,units(code,buildings(name))").eq("property_id", propertyId).order("id").range(from, from + 999);
    if (error) return NextResponse.json({ error: "No disponible." }, { status: 500 });
    records.push(...((data ?? []) as unknown as CensusRow[]));
    if (!data || data.length < 1000) break;
  }
  const rows = records.map((record) => { const unit = one(record.units); return { tower: one(unit?.buildings ?? null)?.name ?? "", unit: unit?.code ?? "", record }; })
    .sort((a, b) => a.tower.localeCompare(b.tower, "es", { numeric: true }) || a.unit.localeCompare(b.unit, "es", { numeric: true }) || a.record.source_row - b.record.source_row)
    .map(({ record }) => { const cells = Array.isArray(record.cells) ? record.cells : []; return (positionsByImport.get(record.import_id) ?? []).map((position) => position < 0 || cells[position] === null || cells[position] === undefined ? "" : String(cells[position])); });
  const column = (n: number) => { let label = ""; for (n++; n > 0; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(65 + ((n - 1) % 26)) + label; return label; };
  const sheetData = [headers, ...rows].map((row, r) => `<row r="${r + 1}">${row.map((value, c) => value === "" ? "" : `<c r="${column(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${escape(value)}</t></is></c>`).join("")}</row>`).join("");
  const archive = zipSync({
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Censo" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`),
    "xl/worksheets/sheet1.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetData}</sheetData></worksheet>`),
  });
  return new Response(Buffer.from(archive), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": "attachment; filename=censo-resiq.xlsx", "cache-control": "no-store" } });
}
