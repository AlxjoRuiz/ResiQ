import { strToU8, zipSync } from "fflate";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers = ["torre", "apartamento", "concepto", "valor", "fecha_emision", "fecha_vencimiento", "tipo"];
type Row = { concept: string; amount: number; issued_on: string; due_on: string; source: string; units: { code: string; buildings: { name: string } | { name: string }[] | null } | { code: string; buildings: { name: string } | { name: string }[] | null }[] | null };
const one = <T,>(value: T | T[] | null) => (Array.isArray(value) ? value[0] ?? null : value);
const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// «Descargar cartera»: las obligaciones vigentes del conjunto, ordenadas por torre y apartamento, con
// las mismas columnas que se importan. Sin obligaciones, el Excel sale solo con los encabezados.
export async function GET(_: Request, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  if (!uuidPattern.test(propertyId)) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data: member } = await supabase.from("property_members").select("roles").eq("property_id", propertyId).eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (!member || !(member.roles as string[]).includes("administrator")) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  const { data, error } = await supabase.from("accounts_receivable").select("concept,amount,issued_on,due_on,source,units(code,buildings(name))").eq("property_id", propertyId).eq("status", "active");
  if (error) return NextResponse.json({ error: "No disponible." }, { status: 500 });
  const rows = ((data ?? []) as unknown as Row[]).map((row) => { const unit = one(row.units); return { tower: one(unit?.buildings ?? null)?.name ?? "", unit: unit?.code ?? "", row }; })
    .sort((a, b) => a.tower.localeCompare(b.tower, "es", { numeric: true }) || a.unit.localeCompare(b.unit, "es", { numeric: true }) || a.row.issued_on.localeCompare(b.row.issued_on) || a.row.concept.localeCompare(b.row.concept, "es"));
  const cells = [headers, ...rows.map(({ tower, unit, row }) => [tower, unit, row.concept, Number(row.amount), row.issued_on, row.due_on, row.source === "opening_balance" ? "saldo_inicial" : "obligacion"])];
  const column = (n: number) => { let label = ""; for (n++; n > 0; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(65 + ((n - 1) % 26)) + label; return label; };
  const sheetData = cells.map((row, r) => `<row r="${r + 1}">${row.map((value, c) => typeof value === "number" ? `<c r="${column(c)}${r + 1}"><v>${value}</v></c>` : `<c r="${column(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${escape(String(value))}</t></is></c>`).join("")}</row>`).join("");
  const archive = zipSync({
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Cartera" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`),
    "xl/worksheets/sheet1.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetData}</sheetData></worksheet>`),
  });
  return new Response(Buffer.from(archive), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": "attachment; filename=cartera-resiq.xlsx", "cache-control": "no-store" } });
}
