import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Household, MemberRole, Profile } from "@/lib/supabase/types";

export interface ActiveContext {
  userId: string;
  profile: Profile;
  household: Household;
  role: MemberRole;
}

/**
 * Server-side: resolve the signed-in user and their active household.
 * Redirects to /login when unauthenticated.
 */
export async function requireHousehold(): Promise<ActiveContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = (await (supabase.from("profiles") as any)
    .select("*")
    .eq("id", user.id)
    .single()) as { data: Profile | null };
  if (!profile) redirect("/login");

  let householdId = profile.active_household_id;
  if (!householdId) {
    const { data: firstMembership } = (await (supabase.from("household_members") as any)
      .select("household_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()) as { data: { household_id: string } | null };
    householdId = firstMembership?.household_id ?? null;
  }
  if (!householdId) {
    // User is authenticated but has no household membership.
    // Sign out and redirect to prevent infinite loop.
    await supabase.auth.signOut();
    redirect("/login?error=no_household");
  }

  const { data: household } = (await (supabase.from("households") as any)
    .select("*")
    .eq("id", householdId)
    .single()) as { data: Household | null };
  if (!household) redirect("/login");

  const { data: membership } = (await (supabase.from("household_members") as any)
    .select("role")
    .eq("household_id", householdId)
    .eq("user_id", user.id)
    .single()) as { data: { role: MemberRole } | null };

  return {
    userId: user.id,
    profile,
    household,
    role: membership?.role ?? "viewer",
  };
}
