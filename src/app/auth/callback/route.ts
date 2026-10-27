import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { accessErrorCode, getAppAccessStatus } from "@/lib/auth/app-access";
import { safeNext } from "@/lib/auth/safe-next";
import { logAuthFailure } from "@/lib/auth/log-auth-failure";


export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      if (next.startsWith("/invitacion?")) return NextResponse.redirect(new URL(next, request.url));
      const access = await getAppAccessStatus(supabase, data.user.id);
      if (access === "authorized") return NextResponse.redirect(new URL(next, request.url));
      logAuthFailure("access", { method: "google", reason: access });
      await supabase.auth.signOut({ scope: "local" });
      return NextResponse.redirect(new URL(`/login?error=${accessErrorCode(access)}`, request.url));
    }
    logAuthFailure("oauth_callback", { method: "google", reason: error?.code ?? "no_user", status: error?.status });
  } else {
    logAuthFailure("oauth_callback", { method: "google", reason: "missing_code" });
  }
  return NextResponse.redirect(new URL("/login?error=callback", request.url));
}
