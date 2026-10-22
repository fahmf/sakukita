"use client";

import * as React from "react";
import { ArrowRightLeft, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatGrouped, formatRelative } from "@/lib/format";
import { iconMap } from "@/lib/icons";
import type { TransactionWithDetails } from "@/hooks/use-transactions";

/**
 * One transaction in a list (Beranda preview, Riwayat). The main area is a
 * real button that opens the detail dialog; edit/delete sit beside it as
 * their own buttons so nothing interactive is nested.
 */
export function TransactionRow({
  tx,
  onOpen,
  onEdit,
  onDelete,
}: {
  tx: TransactionWithDetails;
  onOpen: (tx: TransactionWithDetails) => void;
  onEdit: (tx: TransactionWithDetails) => void;
  onDelete: (tx: TransactionWithDetails) => void;
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
    <div className="flex items-center justify-between rounded-2xl border bg-card p-3.5 transition-all hover:border-mint-strong/20 min-w-0">
      <button
        type="button"
        onClick={() => onOpen(tx)}
        className="flex items-center gap-3 min-w-0 flex-1 text-left select-none rounded-xl active:opacity-70 transition-opacity"
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
      <div className="flex items-center gap-1 flex-shrink-0 pl-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(tx)}
          className="size-9 rounded-lg text-muted-foreground hover:text-mint-strong hover:bg-mint-soft/50 transition-colors"
          aria-label={`Ubah transaksi ${title}`}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(tx)}
          className="size-9 rounded-lg text-muted-foreground hover:text-expense hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
          aria-label={`Hapus transaksi ${title}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
