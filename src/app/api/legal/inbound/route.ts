import { isValidDocument } from "@/lib/documents/validation";
import { replyText, replyTokenFrom, verifyResendWebhook } from "@/lib/legal/inbound-email";
import { createAdminClient } from "@/lib/supabase/admin";

type ReceivedEvent = { type?: string; data?: { email_id?: string; from?: string; to?: unknown[]; received_for?: unknown[] } };
type ReceivedEmail = { from?: string; text?: string | null; html?: string | null };
type ReceivedAttachment = { id: string; filename?: string; size?: number; content_type?: string; content_disposition?: string; download_url?: string };
const allowedTypes: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
const maximumSize = 10 * 1024 * 1024;

// Webhook de Resend (31/10/2026): respuestas del residente al requerimiento de pago, desde su correo.
// Valida la firma, busca la conversación por el código de la dirección y guarda solo el texto nuevo.
// Desde el 05/11/2026 también guarda los archivos que adjunte (PDF, JPG o PNG, hasta 10 MB y 5 por correo);
// los demás se omiten y se avisa en el mensaje. Requiere RESEND_INBOUND_WEBHOOK_SECRET y RESEND_API_KEY en Vercel.
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
  const emailId = encodeURIComponent(event.data.email_id);
  const headers = { authorization: `Bearer ${apiKey}` };

  // El webhook solo trae los datos del correo; el texto y los adjuntos se piden a Resend.
  const [emailResponse, attachmentResponse] = await Promise.all([
    fetch(`https://api.resend.com/emails/receiving/${emailId}`, { headers }),
    fetch(`https://api.resend.com/emails/receiving/${emailId}/attachments?limit=20`, { headers }),
  ]);
  if (!emailResponse.ok) return new Response(null, { status: 502 });
  const email = await emailResponse.json() as ReceivedEmail;
  // Las imágenes pegadas dentro del texto (firmas, logos) no son adjuntos.
  const attachments = attachmentResponse.ok ? ((await attachmentResponse.json() as { data?: ReceivedAttachment[] }).data ?? []).filter((item) => item.content_disposition !== "inline") : [];
  const usable = attachments.filter((item) => item.download_url && item.content_type && allowedTypes[item.content_type] && (item.size ?? 0) > 0 && (item.size ?? 0) <= maximumSize).slice(0, 5);
  const skipped = attachments.length - usable.length;
  const text = replyText(email.text, email.html) || (usable.length ? "(Envió archivos adjuntos)" : "");
  if (!text) return new Response(null, { status: 204 });
  const note = skipped > 0 ? `\n\n(Se omitieron ${skipped} ${skipped === 1 ? "archivo adjunto" : "archivos adjuntos"}: solo se guardan PDF, JPG o PNG de hasta 10 MB, máximo 5.)` : "";
  const sender = (/<([^>]+)>/.exec(email.from ?? event.data.from ?? "")?.[1] ?? email.from ?? event.data.from ?? "").trim();
  const admin = createAdminClient();
  const { data: messageId, error } = await admin.rpc("legal_receive_reply", { reply_token: token, sender_email: sender, reply_body: text + note, provider_id: event.data.email_id });
  if (error) { console.error(JSON.stringify({ event: "legal_inbound_failed", code: error.code })); return new Response(null, { status: 500 }); }
  if (typeof messageId !== "string") return new Response(null, { status: 204 });

  // Archivos: se descargan del enlace temporal de Resend, se revisa que el contenido sea del tipo dicho y se guardan
  // en la carpeta del conjunto. Si uno falla, los demás siguen.
  const { data: message } = await admin.from("legal_notice_messages").select("property_id").eq("id", messageId).maybeSingle();
  if (!message) return new Response(null, { status: 204 });
  for (const item of usable) {
    try {
      const download = await fetch(item.download_url!);
      if (!download.ok) continue;
      const bytes = new Uint8Array(await download.arrayBuffer());
      if (bytes.length > maximumSize || !isValidDocument(bytes, item.content_type!, bytes.length)) continue;
      const path = `${message.property_id}/legal/in-${crypto.randomUUID()}.${allowedTypes[item.content_type!]}`;
      const upload = await admin.storage.from("private-documents").upload(path, bytes, { contentType: item.content_type!, upsert: false });
      if (upload.error) continue;
      const saved = await admin.rpc("legal_add_inbound_attachment", { target_message_id: messageId, target_path: path, target_name: (item.filename ?? "archivo").slice(0, 180), target_type: item.content_type!, target_size: bytes.length, target_provider_id: item.id });
      if (saved.error) await admin.storage.from("private-documents").remove([path]);
    } catch { /* El archivo se omite; el mensaje ya quedó guardado. */ }
  }
  return new Response(null, { status: 204 });
}
