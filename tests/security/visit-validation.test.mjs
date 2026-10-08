import assert from "node:assert/strict";
import test from "node:test";
import { validVisitDocument, visitTimeToIso, visitWindowError, visitErrorMessage, visitDateFormatter } from "../../src/lib/visitors/validation.ts";

test("visit display retains Colombia's date and time across UTC midnight", () => {
  const formatter = visitDateFormatter("America/Bogota");
  for (const [local, hour, minute] of [["2026-10-08T16:45", "4", "45"], ["2026-10-08T22:00", "10", "00"]]) {
    const stored = visitTimeToIso(local, "America/Bogota");
    const parts = Object.fromEntries(formatter.formatToParts(new Date(stored)).map(({ type, value }) => [type, value]));
    assert.equal(parts.day, "8");
    assert.equal(parts.hour, hour);
    assert.equal(parts.minute, minute);
    assert.match(parts.dayPeriod, /p/);
  }
});

test("visit document suffixes accept repeated digits and retain leading zeros", () => {
  for (const value of ["", "11", "1111", "5050", "000000"]) assert.equal(validVisitDocument(value), true, value);
  for (const value of ["1", "1234567", "12a4", "12 34"]) assert.equal(validVisitDocument(value), false, value);
});

test("visit wall-clock times use the property's zone regardless of server TZ", () => {
  assert.equal(visitTimeToIso("2026-10-08T14:00", "America/Bogota"), "2026-10-08T19:00:00.000Z");
  assert.equal(visitTimeToIso("2026-10-08T14:00", "UTC"), "2026-10-08T14:00:00.000Z");
  assert.equal(visitTimeToIso("2026-02-30T14:00", "America/Bogota"), null);
  assert.equal(visitTimeToIso("2026-10-08T14:00", "Invalid/Zone"), null);
  assert.equal(visitTimeToIso("2026-10-08T14:00-05:00", "America/Bogota"), null);
});

test("nonexistent and ambiguous local times cannot silently shift a visit", () => {
  assert.equal(visitTimeToIso("2026-03-08T02:30", "America/New_York"), null);
  assert.equal(visitTimeToIso("2026-11-01T01:30", "America/New_York"), null);
  assert.equal(visitTimeToIso("2026-07-08T14:00", "America/New_York"), "2026-07-08T18:00:00.000Z");
});

test("visit windows allow exactly 24 hours and the 15-minute past boundary", () => {
  const now = Date.parse("2026-10-08T19:00:00Z");
  assert.equal(visitWindowError("2026-10-08T18:45:00Z", "2026-10-09T18:45:00Z", now), null);
  assert.match(visitWindowError("2026-10-08T18:44:59Z", "2026-10-08T20:00:00Z", now), /15 minutos/);
  assert.match(visitWindowError("2026-10-08T19:00:00Z", "2026-10-09T19:00:01Z", now), /24 horas/);
  assert.match(visitWindowError("2026-10-08T19:00:00Z", "2026-10-08T19:00:00Z", now), /posterior/);
  assert.match(visitErrorMessage("invalid_window"), /horario/);
  assert.match(visitErrorMessage("invalid_document"), /repetidos/);
});
