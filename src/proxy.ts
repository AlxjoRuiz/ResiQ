import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { buildContentSecurityPolicy, createNonce, CSP_HEADER } from "@/lib/security/csp";

export async function proxy(request: NextRequest) {
  // Nonce nuevo por solicitud: Next lo lee de la cabecera CSP y lo aplica a sus scripts.
  const nonce = createNonce();
  const policy = buildContentSecurityPolicy(nonce, process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://invalid.supabase.co", process.env.NODE_ENV === "development");
  const response = await updateSession(request, { [CSP_HEADER.toLowerCase()]: policy, "x-nonce": nonce });
  response.headers.set(CSP_HEADER, policy);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
