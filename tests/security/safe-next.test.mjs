import assert from "node:assert/strict";
import test from "node:test";
import { safeNext } from "../../src/lib/auth/safe-next.ts";

test("authentication destinations stay on the app origin", () => {
  for (const value of [null, undefined, "", "https://example.org", "//example.org", "/\\example.org", "/\t/example.org", "/\n/example.org", "/\r/example.org"]) {
    assert.equal(safeNext(value), "/panel", `Rejected ${JSON.stringify(value)}`);
  }
  for (const value of ["/panel", "/invitacion?token=abc%2Fdef", "/perfil#nombre", "/panel/../perfil", "/%2Fexample.org", "/%5Cexample.org"]) {
    const result = safeNext(value);
    assert.equal(new URL(result, "https://resiq.invalid").origin, "https://resiq.invalid");
  }
  assert.equal(safeNext("/invitacion?token=abc%2Fdef"), "/invitacion?token=abc%2Fdef");
});
