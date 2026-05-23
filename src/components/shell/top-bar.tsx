"use client";

import { Bell } from "lucide-react";
import { HouseholdSwitcher } from "./household-switcher";
import { toast } from "sonner";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur">
      <div className="min-w-0">
        <HouseholdSwitcher />
      </div>
      <button
        type="button"
        aria-label="Notifikasi"
        onClick={() => toast("Notifikasi akan hadir di update berikutnya.")}
        className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
      >
        <Bell className="size-5" />
      </button>
    </header>
  );
}
