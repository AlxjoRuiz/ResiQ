import worker from "./index.ts";

async function runAuthorization(authorization: boolean | "error") {
  const settings = { EMAIL_WORKER_SECRET: "test-secret", SUPABASE_URL: "https://supabase.invalid", SUPABASE_SERVICE_ROLE_KEY: "test-service-key", RESEND_API_KEY: "test-provider-key", RESEND_FROM_EMAIL: "test@resiq.invalid" };
  const previous = Object.fromEntries(Object.keys(settings).map((name) => [name, Deno.env.get(name)]));
  for (const [name, value] of Object.entries(settings)) Deno.env.set(name, value);
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (input) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push(url);
    let body: unknown = null, status = 200;
    if (url.endsWith("claim_email_jobs")) body = [{ id: "test-job", recipient_email: "member@resiq.invalid", template_key: "receivable_created", template_data: { amount: 100 }, dedupe_key: "test" }];
    if (url.endsWith("authorize_email_job")) { body = authorization === "error" ? { message: "test database failure" } : authorization; status = authorization === "error" ? 500 : 200; }
    if (url.startsWith("https://api.resend.com")) body = { id: "test-message" };
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  };
  try {
    const response = await worker.fetch(new Request("https://worker.invalid", { method: "POST", headers: { "x-worker-secret": "test-secret" } }));
    const body = await response.json();
    if (response.status !== 200 || !calls.some((url) => url.endsWith("authorize_email_job"))) throw new Error("missing authorization");
    return { status: body.results[0]?.status, calls };
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of Object.entries(previous)) { if (value === undefined) Deno.env.delete(name); else Deno.env.set(name, value); }
  }
}
Deno.test("revoked recipient never reaches the email provider", async () => {
  const result = await runAuthorization(false);
  if (result.status !== "cancelled" || result.calls.some((url) => url.startsWith("https://api.resend.com"))) throw new Error("revoked recipient was sent to provider");
});
Deno.test("authorization outages fail closed and enter the retry path", async () => {
  const result = await runAuthorization("error");
  if (result.status !== "failed" || !result.calls.some((url) => url.endsWith("fail_email_job")) || result.calls.some((url) => url.startsWith("https://api.resend.com"))) throw new Error("authorization failure was not contained");
});
Deno.test("authorized recipients still receive their email", async () => {
  const result = await runAuthorization(true);
  if (result.status !== "accepted" || !result.calls.some((url) => url.startsWith("https://api.resend.com")) || !result.calls.some((url) => url.endsWith("complete_email_job"))) throw new Error("authorized email was not completed");
});
