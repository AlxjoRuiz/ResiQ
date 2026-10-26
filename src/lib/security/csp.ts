// Política de seguridad de contenido (CSP) con nonce por solicitud. Ver
// node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md.
// Primero se envió en modo observación (Report-Only) sin infracciones en los tres perfiles.
// Bloqueo activado el 25/10/2026 a pedido de Alejandro; las infracciones siguen llegando a
// /api/csp-report. Para volver a solo observar, poner false.
export const CSP_ENFORCED = true;
export const CSP_HEADER = CSP_ENFORCED ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";

export function createNonce() {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

export function buildContentSecurityPolicy(nonce: string, supabaseUrl: string, isDevelopment: boolean) {
  const supabase = new URL(supabaseUrl).origin;
  const supabaseRealtime = supabase.replace(/^https:/, "wss:");
  return [
    "default-src 'self'",
    // strict-dynamic: solo corren los scripts de ResiQ (con nonce) y los que ellos carguen.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    // Estilos: hoja propia y estilos en línea de los componentes de interfaz.
    "style-src 'self' 'unsafe-inline'",
    // Fotos y adjuntos firmados de Supabase Storage.
    `img-src 'self' blob: data: ${supabase}`,
    "font-src 'self'",
    // Subidas y lecturas de Supabase desde el navegador.
    `connect-src 'self' ${supabase} ${supabaseRealtime}`,
    "object-src 'none'",
    "base-uri 'self'",
    // El inicio con Google redirige a Supabase y a Google.
    `form-action 'self' ${supabase} https://accounts.google.com`,
    "frame-ancestors 'none'",
    // El navegador ignora esta directiva en modo observación; solo se envía al activar el bloqueo.
    ...(CSP_ENFORCED ? ["upgrade-insecure-requests"] : []),
    "report-uri /api/csp-report",
  ].join("; ");
}
