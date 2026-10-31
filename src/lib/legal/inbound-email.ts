import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Respuestas por correo al requerimiento de pago (31/10/2026). Resend recibe el correo en
// respuesta+<código>@<dominio> y avisa con un webhook firmado (Svix): firma HMAC-SHA256 en base64 de
// «id.timestamp.cuerpo» con el secreto whsec_… decodificado.
export function verifyResendWebhook(body: string, headers: Headers, secret: string, now = Date.now()) {
  const id = headers.get("svix-id"), timestamp = headers.get("svix-timestamp"), signatures = headers.get("svix-signature");
  if (!id || !timestamp || !signatures || !secret.startsWith("whsec_")) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(now / 1000 - seconds) > 300) return false;
  const expected = createHmac("sha256", Buffer.from(secret.slice(6), "base64")).update(`${id}.${timestamp}.${body}`).digest();
  return signatures.split(" ").some((entry) => {
    const [version, value] = entry.split(",");
    if (version !== "v1" || !value) return false;
    const received = Buffer.from(value, "base64");
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
}

// El código de la conversación viene en la dirección a la que respondió el residente.
export function replyTokenFrom(addresses: unknown[]) {
  for (const address of addresses) {
    const match = typeof address === "string" ? /respuesta\+([0-9a-f]{36})@/i.exec(address) : null;
    if (match) return match[1].toLowerCase();
  }
  return null;
}

// Solo lo que escribió el residente: sin el mensaje citado («El … escribió:», «On … wrote:», líneas con «>»).
export function replyText(text: string | null | undefined, html: string | null | undefined) {
  const source = text?.trim() ? text : (html ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div)>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'");
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    const joined = `${line} ${lines[index + 1]?.trim() ?? ""}`;
    if (/(escribió|wrote):?$/i.test(line) || (/^(El|On) /.test(line) && /(escribió|wrote):?$/i.test(joined))) break;
    if (/^-{2,}\s*(Mensaje original|Original Message)/i.test(line) || /^(De|From):\s/.test(line)) break;
    if (line.startsWith(">")) continue;
    kept.push(lines[index]);
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 20000);
}
