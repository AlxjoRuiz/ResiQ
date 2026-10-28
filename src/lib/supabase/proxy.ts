import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnvironment } from "./env";
import { accessErrorCode, getAppAccessStatus } from "@/lib/auth/app-access";
import { safeNext } from "@/lib/auth/safe-next";

// Acceso a ResiQ recordado 60 s en una cookie firmada (HMAC con la clave secreta del servidor), para
// no repetir las consultas de acceso en cada clic (28/10/2026, prueba de carga). Las páginas y la base
// de datos siguen validando la membresía en cada solicitud; esto solo evita repetir este filtro.
const ACCESS_COOKIE = "resiq_access";
const ACCESS_SECONDS = 60;
async function accessSignature(userId: string, expires: number) {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return null;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${userId}.${expires}`));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function hasRecentAccess(request: NextRequest, userId: string) {
  const [cookieUser, expiresText, signature] = (request.cookies.get(ACCESS_COOKIE)?.value ?? "").split(".");
  const expires = Number(expiresText);
  if (cookieUser !== userId || !Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000) || !signature) return false;
  return signature === await accessSignature(userId, expires);
}

function redirectWithCookies(url: URL, response: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

// extraRequestHeaders (por ejemplo, la CSP con nonce) viaja junto con las cookies de sesión
// renovadas, que se copian de request.headers cada vez que Supabase las actualiza.
export async function updateSession(request: NextRequest, extraRequestHeaders: Record<string, string> = {}) {
  const { url, publishableKey } = getSupabaseEnvironment();
  const next = () => {
    const headers = new Headers(request.headers);
    for (const [name, value] of Object.entries(extraRequestHeaders)) headers.set(name, value);
    return NextResponse.next({ request: { headers } });
  };
  let response = next();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = next();
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getClaims valida el token con las llaves públicas de Supabase (en memoria) y renueva la sesión si
  // venció, sin llamar al servidor de Auth en cada visita.
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = typeof claimsData?.claims?.sub === "string" ? { id: claimsData.claims.sub } : null;
  const pathname = request.nextUrl.pathname;
  const isProtected = pathname.startsWith("/panel") || pathname.startsWith("/perfil") || pathname.startsWith("/invitacion") || pathname.startsWith("/plataforma");

  if (!user && isProtected) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return redirectWithCookies(loginUrl, response);
  }

  if (user && (pathname.startsWith("/panel") || pathname.startsWith("/perfil") || pathname.startsWith("/plataforma"))) {
    if (!(await hasRecentAccess(request, user.id))) {
      const access = await getAppAccessStatus(supabase, user.id);
      if (access !== "authorized") {
        await supabase.auth.signOut({ scope: "local" });
        const loginUrl = new URL(`/login?error=${accessErrorCode(access)}`, request.url);
        const redirect = redirectWithCookies(loginUrl, response);
        redirect.cookies.delete(ACCESS_COOKIE);
        return redirect;
      }
      const expires = Math.floor(Date.now() / 1000) + ACCESS_SECONDS;
      const signature = await accessSignature(user.id, expires);
      if (signature) response.cookies.set(ACCESS_COOKIE, `${user.id}.${expires}.${signature}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: ACCESS_SECONDS });
    }
  }

  if (user && pathname === "/login" && !request.nextUrl.searchParams.has("error") && !safeNext(request.nextUrl.searchParams.get("next")).startsWith("/invitacion?")) {
    return redirectWithCookies(new URL("/panel", request.url), response);
  }

  return response;
}
