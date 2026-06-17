"use client";

import { TopBar } from "./top-bar";
import { BottomNav } from "./bottom-nav";
import { QuickAddSheet } from "@/components/transaction/quick-add-sheet";
import { useFinanceAlerts } from "@/hooks/use-finance-alerts";

export function AppShell({ children }: { children: React.ReactNode }) {
  // App-wide watcher: budget threshold + large-transaction local notifications.
  useFinanceAlerts();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <TopBar />
      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
      <BottomNav />
      <QuickAddSheet />
    </div>
  );
}
