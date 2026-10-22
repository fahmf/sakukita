"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ReceiptText, BarChart3, LayoutGrid, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import { useCanEdit, viewOnlyToast } from "@/components/shared/edit-guard";

// Each tab also owns the sub-pages reached from it, so the bar keeps showing
// where the user is (e.g. Tabungan lights up "Lainnya").
const tabs = [
  { href: "/dashboard", label: "Beranda", icon: Home, match: ["/dashboard"] },
  { href: "/transactions", label: "Riwayat", icon: ReceiptText, match: ["/transactions", "/calendar"] },
  { href: "/reports", label: "Laporan", icon: BarChart3, match: ["/reports"] },
  {
    href: "/more",
    label: "Lainnya",
    icon: LayoutGrid,
    match: ["/more", "/budgets", "/savings", "/debts", "/wallets", "/scheduled", "/settings"],
  },
];

function isActive(pathname: string, match: string[]): boolean {
  return match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

export function BottomNav() {
  const pathname = usePathname();
  const openQuickAdd = useUIStore((s) => s.openQuickAdd);
  const allowed = useCanEdit();

  return (
    <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t bg-background/95 backdrop-blur">
      <div className="relative grid grid-cols-5 items-center px-2 pb-[env(safe-area-inset-bottom)]">
        {tabs.slice(0, 2).map((tab) => (
          <NavItem key={tab.href} {...tab} active={isActive(pathname, tab.match)} />
        ))}

        <div className="flex justify-center">
          <button
            type="button"
            aria-label="Tambah transaksi"
            aria-disabled={!allowed}
            onClick={() => (allowed ? openQuickAdd("expense") : viewOnlyToast())}
            className={cn(
              "-mt-6 grid size-14 place-items-center rounded-full bg-mint-strong text-on-mint shadow-lg shadow-mint-strong/30 transition-transform active:scale-95",
              !allowed && "opacity-60"
            )}
          >
            <Plus className="size-7" strokeWidth={2.5} aria-hidden />
          </button>
        </div>

        {tabs.slice(2).map((tab) => (
          <NavItem key={tab.href} {...tab} active={isActive(pathname, tab.match)} />
        ))}
      </div>
    </nav>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors",
        active ? "text-mint-strong" : "text-muted-foreground",
      )}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  );
}
