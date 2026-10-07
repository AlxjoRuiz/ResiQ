import assert from "node:assert/strict";
import test from "node:test";
import { readJsonObject } from "../../src/lib/documents/request-body.ts";

const request = (body) => new Request("https://resiq.invalid/api/pqrs/attachments", {
  method: "POST", headers: { "content-type": "application/json" }, body,
});

test("attachment bodies reject null, arrays, primitives and malformed JSON", async () => {
  for (const body of ["null", "[]", '[{"action":"prepare"}]', '"prepare"', "1", "true", "", "{"]) {
    await assert.rejects(readJsonObject(request(body)), undefined, body);
  }
});

test("attachment object bodies retain fields for route validation", async () => {
  assert.deepEqual(await readJsonObject(request('{"action":"finalize","documentId":"example"}')),
    { action: "finalize", documentId: "example" });
  assert.deepEqual(await readJsonObject(request("{}")), {});
});
