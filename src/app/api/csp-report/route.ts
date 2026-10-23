// Recibe los reportes de la CSP (src/lib/security/csp.ts) y los deja en los logs del servidor.
// Solo registra la directiva y el origen bloqueado; no guarda URLs completas ni datos del usuario.
export async function POST(request: Request) {
  const text = (await request.text()).slice(0, 8192);
  try {
    const body: unknown = JSON.parse(text);
    const reports = Array.isArray(body) ? body.map((item) => item?.body) : [(body as { "csp-report"?: unknown })?.["csp-report"]];
    for (const report of reports.slice(0, 10)) {
      if (!report || typeof report !== "object") continue;
      const value = report as Record<string, unknown>;
      const blocked = String(value["blocked-uri"] ?? value.blockedURL ?? "");
      const page = String(value["document-uri"] ?? value.documentURL ?? "");
      console.warn(JSON.stringify({
        event: "csp_violation",
        directive: String(value["effective-directive"] ?? value.effectiveDirective ?? value["violated-directive"] ?? ""),
        blocked: /^https?:/.test(blocked) ? new URL(blocked).origin : blocked.slice(0, 40),
        path: /^https?:/.test(page) ? new URL(page).pathname : "",
      }));
    }
  } catch {
    // Reporte con formato inesperado: se ignora.
  }
  return new Response(null, { status: 204 });
}
