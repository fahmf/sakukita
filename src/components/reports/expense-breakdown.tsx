"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, ListFilter } from "lucide-react";
import { formatCurrency } from "@/lib/format";

export interface BreakdownSub {
  id: string;
  name: string;
  amount: number;
  count: number;
}

export interface BreakdownItem {
  id: string;
  name: string;
  amount: number;
  count: number;
  subs: BreakdownSub[];
}

interface ExpenseBreakdownProps {
  /** Top-level categories, sorted largest first. */
  items: BreakdownItem[];
  total: number;
  openId: string | null;
  onToggle: (id: string) => void;
  /** Transaction-list link for a category, or null when there is none. */
  hrefFor: (id: string) => string | null;
}

function formatShare(amount: number, total: number): string {
  if (total <= 0) return "0%";
  const pct = (amount / total) * 100;
  return `${(pct < 1 ? pct.toFixed(1) : Math.round(pct).toString()).replace(".", ",")}%`;
}

/**
 * Spending by category as a ranked list of bars, replacing the donut.
 *
 * With 6–10 categories a donut makes close shares hard to compare (18% vs 16%
 * look alike), needs a separate legend that truncates long names on phones,
 * and its floating tooltip covered the centre total. Here every row carries
 * its own name, amount, share and bar; one accent marks the open row, and its
 * subcategories plus a "Lihat transaksi" link open right underneath it.
 */
export function ExpenseBreakdown({ items, total, openId, onToggle, hrefFor }: ExpenseBreakdownProps) {
  const txCount = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-2xl font-bold tabular-nums text-foreground">{formatCurrency(total)}</p>
        <p className="text-xs text-muted-foreground">
          Total pengeluaran · {items.length} kategori · {txCount} transaksi
        </p>
      </div>

      {/* Proportion strip: one segment per category, same order as the list.
          Bars use foreground at partial opacity (not muted-foreground) so they
          keep ≥3:1 against the muted track in both themes. */}
      <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-md" aria-label="Porsi tiap kategori">
        {items.map((item, index) => {
          const isOpen = openId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              aria-pressed={isOpen}
              aria-label={`${item.name} ${formatShare(item.amount, total)}`}
              title={`${item.name} · ${formatShare(item.amount, total)}`}
              style={{ flexGrow: item.amount, flexBasis: 0 }}
              className={`h-full min-w-[3px] transition-colors ${
                isOpen
                  ? "bg-mint-strong"
                  : index % 2 === 0
                  ? "bg-foreground/45"
                  : "bg-foreground/65"
              }`}
            />
          );
        })}
      </div>

      <div className="space-y-1">
        {items.map((item) => {
          const isOpen = openId === item.id;
          const href = hrefFor(item.id);
          return (
            <div key={item.id}>
              <button
                type="button"
                onClick={() => onToggle(item.id)}
                aria-expanded={isOpen}
                className={`grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 rounded-xl border px-2.5 py-2.5 text-left transition-colors ${
                  isOpen
                    ? "border-mint-strong/30 bg-mint-strong/10"
                    : "border-transparent hover:bg-muted/50"
                }`}
              >
                <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
                  <ChevronRight
                    className={`size-4 shrink-0 transition-transform ${
                      isOpen ? "rotate-90 text-mint-strong" : "text-muted-foreground"
                    }`}
                  />
                  <span className="break-words">{item.name}</span>
                </span>
                <span className="text-right text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrency(item.amount)}
                  <span className="ml-1.5 text-xs font-medium text-muted-foreground">
                    {formatShare(item.amount, total)}
                  </span>
                </span>
                <span className="col-span-2 h-2 overflow-hidden rounded bg-muted" aria-hidden>
                  <span
                    className={`block h-full rounded ${isOpen ? "bg-mint-strong" : "bg-foreground/50"}`}
                    style={{ width: `${total > 0 ? (item.amount / total) * 100 : 0}%` }}
                  />
                </span>
              </button>

              {isOpen && (
                <div className="mb-2 ml-4 mt-1 space-y-2.5 border-l-2 border-mint-strong py-1 pl-3 animate-in fade-in slide-in-from-top-1 duration-200">
                  {item.subs.map((sub) => (
                    <div key={sub.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
                      <span className="min-w-0 break-words text-foreground">
                        {sub.name}
                        <span className="block text-[11px] text-muted-foreground">{sub.count} transaksi</span>
                      </span>
                      <span className="text-right font-semibold tabular-nums text-foreground">
                        {formatCurrency(sub.amount)}
                      </span>
                      <span className="col-span-2 h-1.5 overflow-hidden rounded bg-muted" aria-hidden>
                        <span
                          className="block h-full rounded bg-mint-strong/70"
                          style={{ width: `${item.amount > 0 ? (sub.amount / item.amount) * 100 : 0}%` }}
                        />
                      </span>
                    </div>
                  ))}
                  {href && (
                    <Link
                      href={href}
                      className="inline-flex items-center gap-1.5 py-1 text-sm font-semibold text-mint-strong hover:underline"
                    >
                      <ListFilter className="size-3.5" />
                      Lihat {item.count} transaksi {item.name}
                    </Link>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
