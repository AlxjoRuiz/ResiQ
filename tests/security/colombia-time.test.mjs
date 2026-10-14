import assert from "node:assert/strict";
import test from "node:test";
import { COLOMBIA_TIME_ZONE, dateInputValue, dateTimeFormatter, dateTimeInputValue } from "../../src/lib/time-zone.ts";
import { visitTimeToIso } from "../../src/lib/visitors/validation.ts";

test("Colombia forms and timestamps agree around UTC midnight", () => {
  const instant = new Date("2026-10-15T02:30:00.000Z");
  assert.equal(dateInputValue(instant, COLOMBIA_TIME_ZONE), "2026-10-14");
  assert.equal(dateTimeInputValue(instant, COLOMBIA_TIME_ZONE), "2026-10-14T21:30");
  assert.equal(visitTimeToIso("2026-10-14T21:30", COLOMBIA_TIME_ZONE), instant.toISOString());
  const parts = Object.fromEntries(dateTimeFormatter(COLOMBIA_TIME_ZONE).formatToParts(instant).map(({ type, value }) => [type, value]));
  assert.equal(parts.day, "14");
  assert.equal(parts.hour, "9");
  assert.equal(parts.minute, "30");
});
