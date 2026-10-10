import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppAccessStatus } from "@/lib/auth/app-access";
import { safeNext } from "@/lib/auth/safe-next";


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
      await supabase.auth.signOut({ scope: "local" });
      return NextResponse.redirect(new URL(`/login?error=${access === "unauthorized" ? "no_invitation" : "access_check"}`, request.url));
    }
  }
  return NextResponse.redirect(new URL("/login?error=callback", request.url));
}
