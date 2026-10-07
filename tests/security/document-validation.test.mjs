import assert from "node:assert/strict";
import test from "node:test";
import { isValidDocument } from "../../src/lib/documents/validation.ts";
test("declared types and sizes must match file bytes", () => {
 const pdf=new TextEncoder().encode('%PDF-test');
 assert.equal(isValidDocument(pdf,'application/pdf',pdf.length),true);
 assert.equal(isValidDocument(pdf,'image/png',pdf.length),false);
 assert.equal(isValidDocument(pdf,'application/pdf',1),false);
 assert.equal(isValidDocument(new TextEncoder().encode('<script>'),'application/pdf',8),false);
 assert.equal(isValidDocument(new Uint8Array(10*1024*1024+1),'application/pdf',10*1024*1024+1),false);
});
