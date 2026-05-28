"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  User,
  Briefcase,
  ArrowRightLeft,
  Pencil,
  Trash2,
  Tag,
  Receipt,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { TransactionWithDetails } from "@/hooks/use-transactions";
import { formatCurrency } from "@/lib/format";
import { useCanEdit, viewOnlyToast } from "@/components/shared/edit-guard";

import { iconMap } from "@/lib/icons";

interface TransactionDetailDialogProps {
  tx: TransactionWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (tx: TransactionWithDetails) => void;
  onDelete?: (tx: TransactionWithDetails) => void;
}

export function TransactionDetailDialog({
  tx,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: TransactionDetailDialogProps) {
  const allowed = useCanEdit();
  const [receiptOpen, setReceiptOpen] = React.useState(false);

  if (!tx) return null;

  const isExpense = tx.type === "expense";
  const isIncome = tx.type === "income";
  const isTransfer = tx.type === "transfer";

  let bgColor = "#C4C4C4";
  const hasMappedIcon = !isTransfer && tx.category && iconMap[tx.category.icon || ""];
  const categoryIcon = tx.category?.icon || "🏷️";

  if (isTransfer) {
    bgColor = "#A8A29E";
  } else if (tx.category) {
    bgColor = tx.category.color || "#C4C4C4";
  }

  // Format exact occurred date
  const dateObj = new Date(tx.occurred_at);
  const formattedDay = dateObj.toLocaleDateString("id-ID", {
    weekday: "long",
  });
  const formattedDate = dateObj.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const formattedTime = dateObj.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl overflow-hidden p-6 max-w-[92dvw]">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-center text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Detail Transaksi
          </DialogTitle>
        </DialogHeader>

        <div className="py-5 space-y-6">
          {/* 1. Large Premium Amount Display */}
          <div className="text-center space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {isTransfer ? "Nominal Transfer" : isIncome ? "Pemasukan" : "Pengeluaran"}
            </span>
            <p
              className={`text-3xl font-extrabold tracking-tight ${
                isIncome ? "text-income" : isExpense ? "text-expense" : "text-foreground"
              }`}
            >
              {isIncome ? "+" : isExpense ? "-" : ""}
              {formatCurrency(tx.amount)}
            </p>
          </div>

          {/* 2. Transaction Category or Flow Pill */}
          <div className="flex justify-center">
            {isTransfer ? (
              <div className="flex items-center gap-2 bg-stone-100 dark:bg-stone-900 border px-4 py-2 rounded-2xl text-xs font-semibold text-stone-700 dark:text-stone-300">
                <ArrowRightLeft className="size-4 text-stone-500" />
                <span>Transfer Dana</span>
              </div>
            ) : tx.category ? (
              <div
                className="flex items-center gap-2 border px-4 py-2 rounded-2xl text-xs font-semibold"
                style={{
                  backgroundColor: `${bgColor}20`,
                  borderColor: `${bgColor}40`,
                  color: bgColor,
                }}
              >
                {hasMappedIcon ? (
                  React.createElement(iconMap[tx.category.icon || ""], { className: "size-4" })
                ) : (
                  <span className="text-sm leading-none">{categoryIcon}</span>
                )}
                <span>{tx.category.name}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-2xl text-xs font-semibold text-muted-foreground">
                <Tag className="size-4" />
                <span>Tanpa Kategori</span>
              </div>
            )}
          </div>

          {/* 3. Note Container: Elegant Memo/Index-Card Style */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Catatan
            </span>
            <div className="bg-muted/30 dark:bg-muted/10 border border-dashed border-border/80 rounded-2xl p-4 min-h-[4.5rem] flex items-center justify-start relative overflow-hidden group">
              <span className="absolute left-0 top-0 bottom-0 w-1 bg-mint-strong opacity-80" />
              <p className="text-sm font-medium text-foreground leading-relaxed break-words w-full pl-1">
                {tx.note ? tx.note : <span className="text-muted-foreground italic">Tidak ada catatan ditulis.</span>}
              </p>
            </div>
          </div>

          {/* 3b. Receipt Items (collapsible — only if receipt_items exists) */}
          {tx.receipt_items && tx.receipt_items.length > 0 && (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setReceiptOpen(!receiptOpen)}
                className="flex items-center justify-between w-full group"
              >
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="size-3 text-mint-strong" />
                  Detail Struk ({tx.receipt_items.length} item)
                </span>
                {receiptOpen ? (
                  <ChevronUp className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                ) : (
                  <ChevronDown className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                )}
              </button>
              {receiptOpen && (
                <div className="rounded-2xl border border-border bg-muted/20 dark:bg-muted/5 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="divide-y divide-border/60 max-h-52 overflow-y-auto">
                    {tx.receipt_items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between px-4 py-2.5 text-xs">
                        <span className="font-medium text-foreground truncate max-w-[65%]">
                          {item.name}
                        </span>
                        <span className="font-semibold text-muted-foreground shrink-0">
                          {formatCurrency(item.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 border-t bg-muted/30 dark:bg-muted/10 text-xs">
                    <span className="font-bold text-muted-foreground uppercase tracking-wider">Total</span>
                    <span className="font-bold text-foreground">
                      {formatCurrency(tx.receipt_items.reduce((sum, i) => sum + i.price, 0))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. Metadata Details Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs border-t pt-4">
            {/* Wallet Info */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                {isTransfer ? "Dompet Asal" : "Dompet"}
              </span>
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Briefcase className="size-3.5 text-muted-foreground" />
                <span className="truncate">{tx.wallet?.name}</span>
              </div>
            </div>

            {/* Target Wallet (Transfer only) */}
            {isTransfer && tx.to_wallet && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Dompet Tujuan
                </span>
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Briefcase className="size-3.5 text-mint-strong" />
                  <span className="truncate">{tx.to_wallet.name}</span>
                </div>
              </div>
            )}

            {/* Date Info */}
            <div className="space-y-1 col-span-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Waktu Transaksi
              </span>
              <div className="flex items-center gap-1.5 text-foreground font-semibold">
                <Calendar className="size-3.5 text-muted-foreground" />
                <span>
                  {formattedDay}, {formattedDate} · {formattedTime} WIB
                </span>
              </div>
            </div>

            {/* Actor Info (if available, e.g. from local profile or Supabase join) */}
            {tx.created_by && (
              <div className="space-y-1 col-span-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Dicatat Oleh
                </span>
                <div className="flex items-center gap-1.5 text-foreground font-semibold">
                  <User className="size-3.5 text-muted-foreground" />
                  <span className="truncate">
                    {tx.client_id ? "Sistem Otomatis" : "Anggota Keluarga"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 5. Footer Buttons for Edit / Delete */}
        <DialogFooter className="flex flex-row gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!allowed) {
                viewOnlyToast();
              } else {
                onOpenChange(false);
                if (onEdit) onEdit(tx);
              }
            }}
            className="flex-1 h-11 rounded-xl font-semibold gap-1.5 text-xs border-border/80"
          >
            <Pencil className="size-3.5 text-muted-foreground" />
            Ubah
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (!allowed) {
                viewOnlyToast();
              } else {
                onOpenChange(false);
                if (onDelete) onDelete(tx);
              }
            }}
            className="flex-1 h-11 rounded-xl font-semibold gap-1.5 text-xs text-expense hover:bg-red-50 dark:hover:bg-red-950/20"
          >
            <Trash2 className="size-3.5" />
            Hapus
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
