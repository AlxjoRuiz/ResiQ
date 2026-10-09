import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.RESIQ_TEST_BASE_URL;
if (!baseUrl) throw new Error("Set RESIQ_TEST_BASE_URL to the local ResiQ server URL before running this test.");

async function expectLoginRedirect(path, expectedNext) {
  const response = await fetch(new URL(path, baseUrl), { redirect: "manual", signal: AbortSignal.timeout(120000) });
  assert.equal(response.status, 307, `${path} should redirect without a session`);
  const destination = new URL(response.headers.get("location"), baseUrl);
  assert.equal(destination.origin, new URL(baseUrl).origin);
  assert.equal(destination.pathname, "/login");
  assert.equal(destination.searchParams.get("next"), expectedNext);
}

test("protected pages preserve a safe return path when there is no session", async () => {
  await expectLoginRedirect("/panel", "/panel");
  await expectLoginRedirect("/perfil", "/perfil");
  await expectLoginRedirect("/invitacion?token=stage17", "/invitacion?token=stage17");
  await expectLoginRedirect("/panel/propiedades/1bde3475-3ed2-4f57-bd13-39784b12d2a6/dashboard?tab=visitas", "/panel/propiedades/1bde3475-3ed2-4f57-bd13-39784b12d2a6/dashboard?tab=visitas");
});

test("platform administration is protected without a session", async () => {
  await expectLoginRedirect("/plataforma", "/plataforma");
});

test("OAuth callback without a code returns to login with an error", async () => {
  const response = await fetch(new URL("/auth/callback?next=%2Fpanel", baseUrl), { redirect: "manual", signal: AbortSignal.timeout(120000) });
  assert.equal(response.status, 307);
  const destination = new URL(response.headers.get("location"), baseUrl);
  assert.ok(["localhost", "127.0.0.1"].includes(destination.hostname));
  assert.equal(destination.port, new URL(baseUrl).port);
  assert.equal(destination.pathname, "/login");
  assert.equal(destination.searchParams.get("error"), "callback");
});

test("private document download endpoints reject requests without a session", async () => {
  const documentId = "a8d16b73-5b83-4b8e-9c22-a2e404541008";
  for (const area of ["pqrs", "assemblies", "attention-calls"]) {
    const response = await fetch(new URL(`/api/${area}/documents/${documentId}`, baseUrl), {
      redirect: "manual",
      signal: AbortSignal.timeout(120000),
    });
    assert.equal(response.status, 401, `${area} should reject an anonymous download`);
    assert.equal(response.headers.get("content-type")?.includes("application/json"), true);
  }
});

test("private document upload endpoints reject requests without a session", async () => {
  for (const area of ["pqrs", "assemblies", "attention-calls"]) {
    const response = await fetch(new URL(`/api/${area}/attachments`, baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "prepare" }),
      redirect: "manual",
      signal: AbortSignal.timeout(120000),
    });
    assert.equal(response.status, 401, `${area} should reject an anonymous upload`);
    assert.equal(response.headers.get("content-type")?.includes("application/json"), true);
  }
});
