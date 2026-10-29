import assert from "node:assert/strict";
import test from "node:test";
import { accessErrorCode, getAppAccessStatus } from "../../src/lib/auth/app-access.ts";

function client(results) {
  const queries = [];
  return {
    queries,
    from(table) {
      const query = { table, filters: [] };
      queries.push(query);
      const builder = {
        select() { return builder; },
        eq(column, value) { query.filters.push([column, value]); return builder; },
        limit() { return Promise.resolve(results[table]); },
        then(resolve, reject) { return Promise.resolve(results[table]).then(resolve, reject); },
      };
      return builder;
    },
    rpc(name) { return Promise.resolve(results[name] ?? { data: [], error: null }); },
  };
}

const active = (id, roles = ["member"]) => ({ property_id: id, property_status: "active", roles });
const suspended = (id, roles = ["member"]) => ({ property_id: id, property_status: "suspended", roles });

test("only active property members or platform admins may enter ResiQ", async () => {
  const member = client({ property_members: { data: [{ property_id: "p1", roles: ["member"] }], error: null }, platform_admins: { data: [], error: null }, get_my_property_statuses: { data: [active("p1")], error: null } });
  assert.equal(await getAppAccessStatus(member, "user-1"), "authorized");
  const platform = client({ property_members: { data: [], error: null }, platform_admins: { data: [{ id: "admin" }], error: null } });
  assert.equal(await getAppAccessStatus(platform, "user-1"), "authorized");
  const uninvited = client({ property_members: { data: [], error: null }, platform_admins: { data: [], error: null } });
  assert.equal(await getAppAccessStatus(uninvited, "user-1"), "unauthorized");
  // Toda consulta filtra por la cuenta y por estado activo; la única excepción es la que busca un
  // trabajador de mantenimiento suspendido, para mostrarle su propio aviso.
  for (const query of uninvited.queries) {
    const suspendedMaintenance = query.table === "maintenance_staff" && query.filters.some(([column, value]) => column === "status" && value === "suspended");
    assert.deepEqual(query.filters, [["user_id", "user-1"], ["status", suspendedMaintenance ? "suspended" : "active"]]);
  }
  const suspendedOnly = client({ platform_admins: { data: [], error: null }, get_my_property_statuses: { data: [suspended("p1")], error: null } });
  assert.notEqual(await getAppAccessStatus(suspendedOnly, "user-1"), "unauthorized");
});

test("a suspended property blocks its members; admins get the payment notice", async () => {
  const resident = client({ property_members: { data: [{ property_id: "p1", roles: ["member"] }], error: null }, platform_admins: { data: [], error: null }, get_my_property_statuses: { data: [suspended("p1")], error: null } });
  assert.equal(await getAppAccessStatus(resident, "user-1"), "suspended");
  assert.equal(accessErrorCode("suspended"), "suspended");
  const admin = client({ property_members: { data: [{ property_id: "p1", roles: ["administrator"] }], error: null }, platform_admins: { data: [], error: null }, get_my_property_statuses: { data: [suspended("p1", ["administrator"])], error: null } });
  assert.equal(await getAppAccessStatus(admin, "user-1"), "suspended_admin");
  const mixed = client({ property_members: { data: [{ property_id: "p1", roles: ["administrator"] }, { property_id: "p2", roles: ["member"] }], error: null }, platform_admins: { data: [], error: null }, get_my_property_statuses: { data: [suspended("p1", ["administrator"]), active("p2")], error: null } });
  assert.equal(await getAppAccessStatus(mixed, "user-1"), "authorized");
});

test("a suspended admin assistant gets its own notice, not the uninvited one", async () => {
  const assistant = client({ platform_admins: { data: [], error: null }, get_my_property_statuses: { data: [], error: null }, has_suspended_assistant_access: { data: true, error: null } });
  assert.equal(await getAppAccessStatus(assistant, "user-1"), "assistant_suspended");
  assert.equal(accessErrorCode("assistant_suspended"), "assistant_suspended");
  const uninvited = client({ platform_admins: { data: [], error: null }, get_my_property_statuses: { data: [], error: null }, has_suspended_assistant_access: { data: false, error: null } });
  assert.equal(await getAppAccessStatus(uninvited, "user-1"), "unauthorized");
});

test("a suspended concierge gets its own notice", async () => {
  const concierge = client({ platform_admins: { data: [], error: null }, get_my_property_statuses: { data: [], error: null }, has_suspended_assistant_access: { data: false, error: null }, has_suspended_concierge_access: { data: true, error: null } });
  assert.equal(await getAppAccessStatus(concierge, "user-1"), "concierge_suspended");
  assert.equal(accessErrorCode("concierge_suspended"), "concierge_suspended");
});

test("a failed access lookup does not turn into an authorization", async () => {
  const unavailable = client({ platform_admins: { data: null, error: new Error("unavailable") } });
  assert.equal(await getAppAccessStatus(unavailable, "user-1"), "error");
  const statusUnavailable = client({ property_members: { data: [{ property_id: "p1", roles: ["member"] }], error: null }, platform_admins: { data: [], error: null }, get_my_property_statuses: { data: null, error: new Error("unavailable") } });
  assert.equal(await getAppAccessStatus(statusUnavailable, "user-1"), "error");
});
