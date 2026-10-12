import { requireHousehold } from "@/lib/auth";
import { HouseholdProvider } from "@/components/providers/household-provider";
import { AppShell } from "@/components/shell/app-shell";
import { SyncProvider } from "@/components/providers/sync-provider";
import { normalizeCycleStartDay } from "@/lib/financial-month";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireHousehold();

  return (
    <HouseholdProvider
      value={{
        userId: ctx.userId,
        householdId: ctx.household.id,
        householdName: ctx.household.name,
        displayName: ctx.profile.display_name ?? ctx.profile.email,
        role: ctx.role,
        isOwner: ctx.household.owner_id === ctx.userId,
        // Undefined until migration 0015 runs; the helper falls back to 25.
        cycleStartDay: normalizeCycleStartDay(ctx.household.cycle_start_day),
      }}
    >
      <SyncProvider>
        <AppShell>{children}</AppShell>
      </SyncProvider>
    </HouseholdProvider>
  );
}
