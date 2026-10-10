import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnvironment } from "./env";
import { getAppAccessStatus } from "@/lib/auth/app-access";
import { safeNext } from "@/lib/auth/safe-next";

function redirectWithCookies(url: URL, response: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = getSupabaseEnvironment();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
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
    const access = await getAppAccessStatus(supabase, user.id);
    if (access !== "authorized") {
      await supabase.auth.signOut({ scope: "local" });
      const loginUrl = new URL(`/login?error=${access === "unauthorized" ? "no_invitation" : "access_check"}`, request.url);
      return redirectWithCookies(loginUrl, response);
    }
  }

  if (user && pathname === "/login" && !request.nextUrl.searchParams.has("error") && !safeNext(request.nextUrl.searchParams.get("next")).startsWith("/invitacion?")) {
    return redirectWithCookies(new URL("/panel", request.url), response);
  }

  return response;
}
