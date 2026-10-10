import assert from "node:assert/strict";
import test from "node:test";
import { getAppAccessStatus } from "../../src/lib/auth/app-access.ts";

function client(results) {
  const queries = [];
  return {
    queries,
    from(table) {
      const query = { table, filters: [] };
      queries.push(query);
      return {
        select() { return this; },
        eq(column, value) { query.filters.push([column, value]); return this; },
        limit() { return Promise.resolve(results[table]); },
      };
    },
  };
}

test("only active property members or platform admins may enter ResiQ", async () => {
  const member = client({ property_members: { data: [{ id: "member" }], error: null }, platform_admins: { data: [], error: null } });
  assert.equal(await getAppAccessStatus(member, "user-1"), "authorized");
  const platform = client({ property_members: { data: [], error: null }, platform_admins: { data: [{ id: "admin" }], error: null } });
  assert.equal(await getAppAccessStatus(platform, "user-1"), "authorized");
  const uninvited = client({ property_members: { data: [], error: null }, platform_admins: { data: [], error: null } });
  assert.equal(await getAppAccessStatus(uninvited, "user-1"), "unauthorized");
  for (const query of uninvited.queries) {
    assert.deepEqual(query.filters, [["user_id", "user-1"], ["status", "active"]]);
  }
});

test("a failed access lookup does not turn into an authorization", async () => {
  const unavailable = client({ property_members: { data: null, error: new Error("unavailable") }, platform_admins: { data: [], error: null } });
  assert.equal(await getAppAccessStatus(unavailable, "user-1"), "error");
});
