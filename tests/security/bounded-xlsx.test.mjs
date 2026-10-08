import assert from "node:assert/strict";
import test from "node:test";
import { zipSync, strToU8, unzipSync } from "fflate";
import { boundedXlsx } from "../../src/lib/finance/bounded-xlsx.ts";
const workbook = strToU8('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets/></workbook>');
const archive = (sheet, extras = {}) => zipSync({ "xl/workbook.xml": workbook, "xl/worksheets/sheet1.xml": strToU8(sheet), ...extras });
test("a bounded worksheet survives sanitization", () => {
  const xml = '<worksheet><sheetData><row r="1"><c t="inlineStr"><is><t>Valor</t></is></c></row></sheetData></worksheet>';
  assert.deepEqual(unzipSync(boundedXlsx(archive(xml)))["xl/worksheets/sheet1.xml"], strToU8(xml));
});
test("reject expansion bombs, entities, excessive rows and archive entries", () => {
  assert.throws(() => boundedXlsx(archive("x".repeat(2 * 1024 * 1024 + 1))), /expansion_limit/);
  assert.throws(() => boundedXlsx(archive('<!DOCTYPE x [<!ENTITY y "z">]><worksheet/>')), /invalid_xlsx_xml/);
  assert.throws(() => boundedXlsx(archive('<worksheet>' + '<row/>'.repeat(502) + '</worksheet>')), /row_limit/);
  assert.throws(() => boundedXlsx(archive('<worksheet><row r="999999999"/></worksheet>')), /row_limit/);
  assert.throws(() => boundedXlsx(archive('<worksheet><row r="1"><c r="XFD1"/></row></worksheet>')), /cell_limit/);
  assert.throws(() => boundedXlsx(archive('<worksheet><row r="&#49;9999999"/></worksheet>')), /row_limit/);
  const extras = Object.fromEntries(Array.from({length:64}, (_,i) => [`extra${i}.xml`, strToU8('<x/>')]));
  assert.throws(() => boundedXlsx(archive('<worksheet/>', extras)), /invalid_xlsx_archive/);
});

test("the app template remains readable by the spreadsheet parser", async () => {
  const { readSheet } = await import("read-excel-file/node");
  const sheet = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Valor</t></is></c></row></sheetData></worksheet>';
  const input = zipSync({
    "xl/workbook.xml": strToU8('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Cartera" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    "xl/_rels/workbook.xml.rels": strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
  });
  assert.deepEqual(await readSheet(Buffer.from(boundedXlsx(input))), [["Valor"]]);
});
