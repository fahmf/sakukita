"use client";

import Link from "next/link";
import {
  CalendarClock,
  Heart,
  ChevronRight,
  PiggyBank,
  Scale,
  Settings,
  Target,
  Tags,
  Trash2,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { PageHeading } from "@/components/shared/empty-state";
import { useHousehold } from "@/components/providers/household-provider";

type Tile = { href: string; label: string; hint: string; icon: LucideIcon; tone: string };

// Features first, grouped by what people come for; account housekeeping last.
// Kalender is deliberately absent: it is a view of Riwayat (reached from the
// Riwayat page and the Beranda month bar) and lights up that tab.
const FEATURES: Tile[] = [
  { href: "/pet", label: "Peliharaan", hint: "Beri makan tiap hari", icon: Heart, tone: "bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400" },
  { href: "/budgets", label: "Rencana & Budget", hint: "Batas per kategori", icon: Target, tone: "bg-mint-soft text-mint-strong" },
  { href: "/wallets", label: "Dompet", hint: "Saldo per akun", icon: Wallet, tone: "bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400" },
  { href: "/savings", label: "Tabungan", hint: "Target impian", icon: PiggyBank, tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" },
  { href: "/debts", label: "Utang & Piutang", hint: "Pinjaman keluarga", icon: Scale, tone: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400" },
  { href: "/scheduled", label: "Terjadwal", hint: "Tagihan & berulang", icon: CalendarClock, tone: "bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400" },
];

const MANAGE: Tile[] = [
  { href: "/settings#kategori", label: "Kategori", hint: "Tambah, ubah, gabung", icon: Tags, tone: "bg-muted text-muted-foreground" },
  { href: "/settings/household", label: "Anggota Keluarga", hint: "Undang & atur peran", icon: Users, tone: "bg-muted text-muted-foreground" },
  { href: "/settings/trash", label: "Tempat Sampah", hint: "Pulihkan dalam 30 hari", icon: Trash2, tone: "bg-muted text-muted-foreground" },
  { href: "/settings", label: "Pengaturan", hint: "Akun, tema, notifikasi", icon: Settings, tone: "bg-muted text-muted-foreground" },
];

export default function MorePage() {
  const { householdName } = useHousehold();

  return (
    <div className="space-y-6">
      <PageHeading title="Lainnya" subtitle={householdName} />

      <div className="grid grid-cols-2 gap-3">
        {FEATURES.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="flex flex-col gap-2.5 rounded-2xl border bg-card p-4 transition-colors hover:border-mint-strong/40 active:scale-[0.98]"
          >
            <span className={`grid size-10 place-items-center rounded-xl ${t.tone}`}>
              <t.icon className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">{t.label}</span>
              <span className="block text-xs text-muted-foreground">{t.hint}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Kelola
        </h2>
        <div className="divide-y overflow-hidden rounded-2xl border bg-card">
          {MANAGE.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="flex items-center justify-between gap-3 p-3.5 transition-colors hover:bg-muted/40"
            >
              <span className="flex items-center gap-3">
                <span className={`grid size-9 place-items-center rounded-xl ${t.tone}`}>
                  <t.icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-foreground">{t.label}</span>
                  <span className="block text-xs text-muted-foreground">{t.hint}</span>
                </span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
