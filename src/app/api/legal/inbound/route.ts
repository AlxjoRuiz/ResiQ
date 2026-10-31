import { replyText, replyTokenFrom, verifyResendWebhook } from "@/lib/legal/inbound-email";
import { createAdminClient } from "@/lib/supabase/admin";

type ReceivedEvent = { type?: string; data?: { email_id?: string; from?: string; to?: unknown[]; received_for?: unknown[] } };
type ReceivedEmail = { from?: string; text?: string | null; html?: string | null };

// Webhook de Resend (31/10/2026): respuestas del residente al requerimiento de pago, desde su correo.
// Valida la firma, busca la conversación por el código de la dirección y guarda solo el texto nuevo.
// Requiere RESEND_INBOUND_WEBHOOK_SECRET y RESEND_API_KEY en Vercel.
export async function POST(request: Request) {
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET, apiKey = process.env.RESEND_API_KEY;
  if (!secret || !apiKey) return new Response(null, { status: 503 });
  const body = await request.text();
  if (body.length > 256_000 || !verifyResendWebhook(body, request.headers, secret)) return new Response(null, { status: 401 });
  let event: ReceivedEvent;
  try { event = JSON.parse(body) as ReceivedEvent; } catch { return new Response(null, { status: 400 }); }
  if (event.type !== "email.received" || !event.data?.email_id) return new Response(null, { status: 204 });
  const token = replyTokenFrom([...(event.data.to ?? []), ...(event.data.received_for ?? [])]);
  if (!token) return new Response(null, { status: 204 });

  // El webhook solo trae los datos del correo; el texto se pide a Resend.
  const response = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(event.data.email_id)}`, { headers: { authorization: `Bearer ${apiKey}` } });
  if (!response.ok) return new Response(null, { status: 502 });
  const email = await response.json() as ReceivedEmail;
  const text = replyText(email.text, email.html);
  if (!text) return new Response(null, { status: 204 });
  const sender = (/<([^>]+)>/.exec(email.from ?? event.data.from ?? "")?.[1] ?? email.from ?? event.data.from ?? "").trim();
  const { error } = await createAdminClient().rpc("legal_receive_reply", { reply_token: token, sender_email: sender, reply_body: text, provider_id: event.data.email_id });
  if (error) { console.error(JSON.stringify({ event: "legal_inbound_failed", code: error.code })); return new Response(null, { status: 500 }); }
  return new Response(null, { status: 204 });
}
