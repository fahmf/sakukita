"use client";

import * as React from "react";
import { ArrowRightLeft } from "lucide-react";
import { formatGrouped, formatRelative } from "@/lib/format";
import { iconMap } from "@/lib/icons";
import type { TransactionWithDetails } from "@/hooks/use-transactions";

/**
 * One transaction in a list (Beranda preview, Riwayat). The whole row is a
 * single button that opens the detail dialog, where edit and delete live —
 * per-row icon buttons were too small to tap safely and crowded the list.
 */
export function TransactionRow({
  tx,
  onOpen,
}: {
  tx: TransactionWithDetails;
  onOpen: (tx: TransactionWithDetails) => void;
}) {
  const isExpense = tx.type === "expense";
  const isIncome = tx.type === "income";
  const isTransfer = tx.type === "transfer";

  const CategoryIcon = !isTransfer && tx.category ? iconMap[tx.category.icon || ""] : undefined;
  const bgColor = isTransfer ? "#A8A29E" : tx.category?.color || "#C4C4C4";
  const title = isTransfer
    ? `Transfer ke ${tx.to_wallet?.name}`
    : tx.note || tx.category?.name || "Lain-lain";

  return (
    <button
      type="button"
      onClick={() => onOpen(tx)}
      className="flex w-full min-w-0 items-center gap-3 rounded-2xl border bg-card p-3.5 text-left select-none transition-all hover:border-mint-strong/20 active:opacity-70"
    >
      <span
        className="grid size-9 shrink-0 place-items-center rounded-xl text-white font-semibold"
        style={{ backgroundColor: bgColor }}
      >
        {isTransfer ? (
          <ArrowRightLeft className="size-4" />
        ) : CategoryIcon ? (
          <CategoryIcon className="size-4" />
        ) : (
          <span className="text-base select-none leading-none">{tx.category?.icon || "🏷️"}</span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm text-foreground truncate">{title}</p>
        <p className="text-xs text-muted-foreground font-medium">
          {tx.wallet?.name} · {formatRelative(tx.occurred_at)}
        </p>
      </div>
      <p
        className={`shrink-0 pl-1 text-right font-bold text-sm tracking-tight ${
          isIncome ? "text-income" : isExpense ? "text-expense" : "text-foreground"
        }`}
      >
        {isIncome ? "+" : isExpense ? "-" : ""}
        {formatGrouped(tx.amount)}
      </p>
    </button>
  );
}
