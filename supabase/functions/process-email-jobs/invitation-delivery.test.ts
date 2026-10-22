import worker from "./index.ts";

type Call = { url: string; body: string };

async function runInvitation(issued: Record<string, string> | null) {
  const settings = { EMAIL_WORKER_SECRET: "test-secret", SUPABASE_URL: "https://supabase.invalid", SUPABASE_SERVICE_ROLE_KEY: "test-service-key", RESEND_API_KEY: "test-provider-key", RESEND_FROM_EMAIL: "test@resiq.invalid", APP_URL: "https://app.resiq.invalid" };
  const previous = Object.fromEntries(Object.keys(settings).map((name) => [name, Deno.env.get(name)]));
  for (const [name, value] of Object.entries(settings)) Deno.env.set(name, value);
  const originalFetch = globalThis.fetch;
  const calls: Call[] = [];
  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: typeof init?.body === "string" ? init.body : "" });
    let body: unknown = null;
    if (url.endsWith("claim_email_jobs")) body = [{ id: "invitation-job", recipient_email: "residente@resiq.invalid", template_key: "resident_invitation", template_data: {}, dedupe_key: "invitation:test", attempt_count: 1 }];
    if (url.endsWith("issue_invitation_for_job")) body = issued;
    if (url.startsWith("https://api.resend.com")) body = { id: "test-message" };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const response = await worker.fetch(new Request("https://worker.invalid", { method: "POST", headers: { "x-worker-secret": "test-secret" } }));
    const body = await response.json();
    return { status: body.results[0]?.status as string, calls };
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of Object.entries(previous)) { if (value === undefined) Deno.env.delete(name); else Deno.env.set(name, value); }
  }
}

const details = { token: "secret-test-token", property_name: "Conjunto de prueba", building_name: "Torre A", unit_code: "101", relationship: "owner", expires_at: "2026-10-26T12:00:00Z" };

Deno.test("invitation email carries the link but the log never stores the token", async () => {
  const result = await runInvitation(details);
  const provider = result.calls.find((call) => call.url.startsWith("https://api.resend.com"));
  const completed = result.calls.find((call) => call.url.endsWith("complete_email_job"));
  if (result.status !== "accepted" || !provider || !completed) throw new Error("invitation was not sent and completed");
  if (!provider.body.includes("secret-test-token")) throw new Error("the email does not include the invitation link");
  if (completed.body.includes("secret-test-token") || !completed.body.includes("enlace de invitación omitido")) throw new Error("the token reached email_logs");
});

Deno.test("an invitation that is no longer valid never reaches the provider", async () => {
  const result = await runInvitation(null);
  if (result.status !== "skipped" || result.calls.some((call) => call.url.startsWith("https://api.resend.com"))) throw new Error("invalid invitation was sent");
});

Deno.test("invitations do not use the notification authorization path", async () => {
  const result = await runInvitation(details);
  if (result.calls.some((call) => call.url.endsWith("authorize_email_job"))) throw new Error("invitation used authorize_email_job");
});

async function runBilling(authorized: boolean) {
  const settings = { EMAIL_WORKER_SECRET: "test-secret", SUPABASE_URL: "https://supabase.invalid", SUPABASE_SERVICE_ROLE_KEY: "test-service-key", RESEND_API_KEY: "test-provider-key", RESEND_FROM_EMAIL: "test@resiq.invalid" };
  const previous = Object.fromEntries(Object.keys(settings).map((name) => [name, Deno.env.get(name)]));
  for (const [name, value] of Object.entries(settings)) Deno.env.set(name, value);
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (input) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push(url);
    let body: unknown = null;
    if (url.endsWith("claim_email_jobs")) body = [{ id: "billing-job", recipient_email: "facturas@resiq.invalid", template_key: "receivable_created", template_data: { amount: 100 }, dedupe_key: "billing:test", attempt_count: 1, census_record_id: "census-record" }];
    if (url.endsWith("authorize_billing_email_job")) body = authorized;
    if (url.startsWith("https://api.resend.com")) body = { id: "test-message" };
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }));
  };
  try {
    const response = await worker.fetch(new Request("https://worker.invalid", { method: "POST", headers: { "x-worker-secret": "test-secret" } }));
    const body = await response.json();
    return { status: body.results[0]?.status as string, calls };
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of Object.entries(previous)) { if (value === undefined) Deno.env.delete(name); else Deno.env.set(name, value); }
  }
}

Deno.test("billing emails use the census authorization and stop when it is withdrawn", async () => {
  const denied = await runBilling(false);
  if (denied.status !== "cancelled" || denied.calls.some((url) => url.startsWith("https://api.resend.com") || url.endsWith("authorize_email_job"))) throw new Error("unauthorized billing email was sent");
  const allowed = await runBilling(true);
  if (allowed.status !== "accepted" || !allowed.calls.some((url) => url.startsWith("https://api.resend.com"))) throw new Error("authorized billing email was not sent");
});
