import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ONBOARDED_COOKIE } from "@/lib/onboarding";

/**
 * Post-login landing. OAuth / magic links arrive with a `code` to exchange;
 * password logins already hold a session and come here without one, so both
 * paths share the onboarding check below.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/dashboard";

  // Prevent open redirect vulnerabilities by validating the redirect path
  if (!next.startsWith("/") || next.startsWith("//")) {
    next = "/dashboard";
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(`${origin}/login?error=auth`);
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  // A brand-new user (no transactions in any household they can see) gets the
  // guided setup instead of an empty dashboard. Deep links such as invites
  // keep their own destination.
  if (next === "/dashboard" && !(await cookies()).get(ONBOARDED_COOKIE)) {
    const { count, error } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true });
    if (!error && count === 0) next = "/onboarding";
  }

  return NextResponse.redirect(`${origin}${next}`);
}
