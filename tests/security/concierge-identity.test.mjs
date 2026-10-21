import assert from "node:assert/strict";
import test from "node:test";
import { conciergeUsername, maskDocument } from "../../src/lib/concierge/identity.ts";

test("generates permanent-format username with accents removed", () => {
  assert.equal(conciergeUsername("Cárlos", "Martínez", "1234567845"), "carlosmartinez45");
  assert.equal(conciergeUsername("José", "Muñoz", "0012345600"), "josemunoz00");
});

test("keeps leading zero in the final document digits and rejects invalid identifiers", () => {
  assert.equal(conciergeUsername("Ana", "López", "123450"), "analopez50");
  assert.equal(conciergeUsername("Ana", "López", "123400"), "analopez00");
  assert.equal(conciergeUsername("Ana", "López", "1234"), null);
  assert.equal(conciergeUsername("Ana", "López", "1234X0"), null);
});

test("masks document number except final two digits", () => {
  assert.equal(maskDocument("1234567845"), "••••••••45");
});
