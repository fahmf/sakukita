"use client";

import { usePathname } from "next/navigation";
import { TopBar } from "./top-bar";
import { BottomNav } from "./bottom-nav";
import { QuickAddSheet } from "@/components/transaction/quick-add-sheet";
import { useFinanceAlerts } from "@/hooks/use-finance-alerts";

export function AppShell({ children }: { children: React.ReactNode }) {
  // App-wide watcher: budget threshold + large-transaction local notifications.
  useFinanceAlerts();
  const pathname = usePathname();

  // Onboarding is a focused full-screen flow: no tabs or top bar to wander
  // off through. The quick-add sheet stays mounted so its last step can open
  // it on the way to the dashboard.
  if (pathname === "/onboarding") {
    return (
      <>
        {children}
        <QuickAddSheet />
      </>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <TopBar />
      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
      <BottomNav />
      <QuickAddSheet />
    </div>
  );
}
