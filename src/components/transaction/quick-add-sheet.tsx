"use client";

import * as React from "react";
import { useUIStore } from "@/stores/ui-store";
import { useWallets } from "@/hooks/use-wallets";
import { useCategories, useCategoryUsage } from "@/hooks/use-categories";
import { useCreateTransaction, useUpdateTransaction } from "@/hooks/use-transactions";
import { parseAmountExpression } from "@/lib/calculator";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  FileText,
  ArrowRightLeft,
  Check,
  Camera,
  Loader2,
  ChevronDown,
  ChevronUp,
  Trash2,
  Keyboard,
  Tag,
  X,
} from "lucide-react";
import type { TransactionType } from "@/lib/supabase/types";
import { compressImage } from "@/lib/image";
import {
  financialMonthDateRangeAsDates,
  financialMonthLabel,
  jakartaDateKey,
  occurredAtForDate,
  shiftMonth,
  todayJakarta,
} from "@/lib/financial-month";
import { db } from "@/lib/db/dexie";
import { computeBudgetUsage, findApplicableBudget } from "@/lib/budget-usage";
import { useHousehold } from "@/components/providers/household-provider";
import type { HierarchicalCategory } from "@/hooks/use-categories";

import { iconMap } from "@/lib/icons";

// 4x4 keypad. "÷" and parentheses are rare for entering amounts and stay
// available on a physical keyboard; the Save button replaces "OK".
const keypadKeys = [
  "7", "8", "9", "⌫",
  "4", "5", "6", "×",
  "1", "2", "3", "-",
  "000", "0", "C", "+",
];

/** A category's icon: a mapped lucide icon name, else the stored emoji. */
function CategoryIcon({
  icon,
  className,
  fallback = "🏷️",
}: {
  icon: string | null | undefined;
  className?: string;
  fallback?: string;
}) {
  const Icon = icon ? iconMap[icon] : undefined;
  if (Icon) return <Icon className={className} />;
  return <span className="text-sm select-none leading-none">{icon || fallback}</span>;
}

/**
 * Budget feedback for the toast after saving an expense, e.g. "Sisa budget
 * Makanan: Rp 320.000". Reads straight from Dexie, which already holds the
 * row just written. Returns null when the category has no budget that month.
 */
async function budgetFeedback(
  householdId: string,
  categoryId: string,
  occurredAtIso: string,
  tree: HierarchicalCategory[]
): Promise<{ text: string; over: boolean } | null> {
  const [y, m, d] = jakartaDateKey(occurredAtIso).split("-").map(Number);
  const month = financialMonthLabel(y, m - 1, d);
  const prevMonth = shiftMonth(month, -1);

  const budgets = await db.budgets
    .where("[household_id+period_month]")
    .anyOf([
      [householdId, month],
      [householdId, prevMonth],
    ])
    .toArray();
  const budget = findApplicableBudget(categoryId, tree, budgets, month);
  if (!budget) return null;
  const prevBudget = budgets.find(
    (b) => b.period_month === prevMonth && b.category_id === budget.category_id
  );

  // A day of slack on each side covers the WIB/UTC offset; rows outside the
  // two cycles are dropped by computeBudgetUsage.
  const from = financialMonthDateRangeAsDates(prevMonth).start;
  from.setDate(from.getDate() - 1);
  const to = financialMonthDateRangeAsDates(month).end;
  to.setDate(to.getDate() + 1);
  const txs = (
    await db.transactions
      .where("[household_id+occurred_at]")
      .between([householdId, from.toISOString()], [householdId, to.toISOString()], true, true)
      .toArray()
  ).filter((t) => !t.is_deleted && !t.is_scheduled);

  const usage = computeBudgetUsage(budget, prevBudget, tree, txs, prevMonth);
  const name =
    tree.flatMap((p) => [p, ...p.subcategories]).find((c) => c.id === budget.category_id)?.name ??
    "kategori ini";
  if (usage.remaining < 0) {
    return { text: `Budget ${name} terlewati ${formatCurrency(-usage.remaining)}`, over: true };
  }
  return {
    text: `Sisa budget ${name}: ${formatCurrency(usage.remaining)} (${usage.percent}% terpakai)`,
    over: false,
  };
}

export function QuickAddSheet() {
  const { quickAddOpen, closeQuickAdd, editingTransaction } = useUIStore();

  return (
    <Drawer open={quickAddOpen} onOpenChange={(open) => !open && closeQuickAdd()}>
      <DrawerContent className="px-4 pb-4 max-h-[94dvh] flex flex-col">
        {quickAddOpen && (
          <QuickAddForm key={editingTransaction?.id || "new-tx"} />
        )}
      </DrawerContent>
    </Drawer>
  );
}

function QuickAddForm() {
  const {
    quickAddType,
    lastWalletId,
    lastCategoryId,
    editingTransaction,
    closeQuickAdd,
    setLastWallet,
    setLastCategory,
  } = useUIStore();

  const { householdId } = useHousehold();
  const { data: wallets = [] } = useWallets();
  const { data: categoriesTree = [] } = useCategories();
  const { data: categoryUsage } = useCategoryUsage();
  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();

  // Local form states initialized directly on mount
  const [type, setType] = React.useState<TransactionType>(() =>
    editingTransaction ? editingTransaction.type : quickAddType
  );
  const [amountExpr, setAmountExpr] = React.useState(() =>
    editingTransaction ? String(editingTransaction.amount) : ""
  );
  const [selectedWalletId, setSelectedWalletId] = React.useState(() =>
    editingTransaction ? editingTransaction.wallet_id : ""
  );
  const [selectedToWalletId, setSelectedToWalletId] = React.useState(() =>
    editingTransaction ? (editingTransaction.to_wallet_id || "") : ""
  );
  const [selectedCategoryId, setSelectedCategoryId] = React.useState(() =>
    editingTransaction ? (editingTransaction.category_id || "") : ""
  );
  const [occurredAt, setOccurredAt] = React.useState(() =>
    editingTransaction
      ? jakartaDateKey(editingTransaction.occurred_at)
      : todayJakarta()
  );
  const [note, setNote] = React.useState(() =>
    editingTransaction ? (editingTransaction.note || "") : ""
  );
  const [tags, setTags] = React.useState<string[]>(() =>
    editingTransaction ? (editingTransaction.tags ?? []) : []
  );
  const [tagInput, setTagInput] = React.useState("");

  // "Simpan & tambah lagi" — keeps the drawer open after saving for fast batch entry.
  const [keepOpen, setKeepOpen] = React.useState(false);

  // Keypad open/close visibility state
  const [showKeypad, setShowKeypad] = React.useState(true);

  // AI receipt scanner states
  const [isScanning, setIsScanning] = React.useState(false);
  const [scannedItems, setScannedItems] = React.useState<{ name: string; price: number }[] | null>(() =>
    editingTransaction?.receipt_items ?? null
  );
  const [scannedItemsOpen, setScannedItemsOpen] = React.useState(() =>
    !!(editingTransaction?.receipt_items && editingTransaction.receipt_items.length > 0)
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const amountInputRef = React.useRef<HTMLInputElement>(null);



  // Quick chips: the categories this household actually uses most (last 90
  // days, subcategories included), topped up with parents in catalog order.
  // Previously these were just the first six parents, so the most common
  // picks (e.g. "Belanja Dapur", "Jajan & Kopi") always needed the dropdown.
  const QUICK_CHIP_COUNT = 8;
  const rankedCategories = React.useMemo(() => {
    if (type === "transfer") return [];
    const flat = categoriesTree
      .filter((c) => c.kind === type)
      .flatMap((p) => [p, ...p.subcategories]);
    const usage = categoryUsage ?? new Map<string, number>();
    return flat
      .filter((c) => (usage.get(c.id) ?? 0) > 0)
      .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0));
  }, [type, categoriesTree, categoryUsage]);

  const activeCategories = React.useMemo(() => {
    if (type === "transfer") return [];
    const picked = rankedCategories.slice(0, QUICK_CHIP_COUNT);
    const pickedIds = new Set(picked.map((c) => c.id));
    for (const parent of categoriesTree) {
      if (picked.length >= QUICK_CHIP_COUNT) break;
      if (parent.kind === type && !pickedIds.has(parent.id)) picked.push(parent);
    }
    return picked;
  }, [type, categoriesTree, rankedCategories]);

  // Compute active default selections purely during render — eliminates cascading render set-state-in-effect errors
  const activeWalletId = selectedWalletId || lastWalletId || wallets[0]?.id || "";

  const activeCategoryId = React.useMemo(() => {
    if (type === "transfer") return "";
    if (selectedCategoryId) return selectedCategoryId;
    const flatCategories = categoriesTree.flatMap((p) => [p, ...p.subcategories]);
    const available = flatCategories.filter((c) => c.kind === type);
    // The remembered category may belong to the other type (last entry was
    // income, this one is expense) — only reuse it when the kind matches.
    const last = available.find((c) => c.id === lastCategoryId);
    return last?.id || rankedCategories[0]?.id || available[0]?.id || "";
  }, [selectedCategoryId, categoriesTree, type, lastCategoryId, rankedCategories]);

  // The chips only list the most-used categories; when the pick came from
  // the full list, the "Lainnya" chip shows it instead.
  const activeCategory = React.useMemo(
    () =>
      categoriesTree
        .flatMap((p) => [p, ...p.subcategories])
        .find((c) => c.id === activeCategoryId),
    [categoriesTree, activeCategoryId]
  );
  const activeIsChip = activeCategories.some((c) => c.id === activeCategoryId);

  // Date shortcuts (Jakarta calendar days).
  const todayKey = todayJakarta();
  const yesterdayKey = React.useMemo(() => {
    const d = new Date(`${todayKey}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }, [todayKey]);

  // Handle keypad presses
  const handleKeypadPress = (key: string) => {
    // Subtle haptic tick on supported devices (mobile). No-op elsewhere.
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(8);
    }
    if (key === "C") {
      setAmountExpr("");
    } else if (key === "⌫") {
      setAmountExpr((prev) => prev.slice(0, -1));
    } else if (key === "000") {
      if (!amountExpr) return;
      const lastChar = amountExpr[amountExpr.length - 1];
      if (/[+\-*/(]/.test(lastChar)) return;
      setAmountExpr((prev) => prev + "000");
    } else if (key === "OK") {
      setShowKeypad(false);
    } else if (key === "÷") {
      setAmountExpr((prev) => prev + "/");
    } else if (key === "×") {
      setAmountExpr((prev) => prev + "*");
    } else {
      setAmountExpr((prev) => prev + key);
    }
  };

  // The amount field is readOnly and driven entirely by keypad taps, so the
  // browser never moves its native text selection or scroll position on its
  // own. Left alone, a readOnly input keeps whatever selection it had when
  // it was last focused (often the whole value, auto-selected on the
  // initial autoFocus) — so newly appended digits land past the end of that
  // selection, unhighlighted. And once the expression is wider than the
  // box, nothing scrolls it into view either, so the most recently typed
  // digits render past the right edge and are invisible. Font size stays
  // fixed (shrinking made long numbers hard to read); instead we keep the
  // caret and scroll position pinned to the end after every change, so the
  // box always shows the tail — the digits just typed — same as a normal
  // calculator display, with older leading digits scrolled out of view.
  React.useEffect(() => {
    const el = amountInputRef.current;
    if (el) {
      el.setSelectionRange(el.value.length, el.value.length);
      el.scrollLeft = el.scrollWidth;
    }
  }, [amountExpr]);

  // Capture physical keyboard inputs when amount input is focused or captured globally
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const activeTag = activeEl?.tagName;
      // If focus is on another interactive control (a text field, a Select
      // trigger, a Switch, any <button>, etc.), let it handle the keystroke
      // normally instead of hijacking it for the amount calculator.
      const isOtherInteractiveTarget =
        activeEl?.id !== "amount-display-input" &&
        (activeTag === "INPUT" ||
          activeTag === "TEXTAREA" ||
          activeTag === "SELECT" ||
          activeTag === "BUTTON" ||
          activeEl?.isContentEditable);
      if (isOtherInteractiveTarget) {
        return;
      }

      const key = e.key;
      if (/[0-9+\-*/().]/.test(key)) {
        e.preventDefault();
        setAmountExpr((prev) => prev + key);
      } else if (key === "Backspace") {
        e.preventDefault();
        setAmountExpr((prev) => prev.slice(0, -1));
      } else if (key === "Escape") {
        e.preventDefault();
        closeQuickAdd();
      } else if (key === "Enter") {
        // Enter saves, like any form.
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeQuickAdd]);

  // Adjust categories automatically when transaction type changes
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    // Clear the explicit pick so the default logic chooses for the new type:
    // the last-used category of that kind, else the most-used one.
    setSelectedCategoryId("");
  };

  // State to track if the selected date is in the future (scheduled)
  const [isFutureDate, setIsFutureDate] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    if (!occurredAt) {
      const reset = () => {
        if (active) setIsFutureDate(false);
      };
      const frame = requestAnimationFrame(reset);
      return () => {
        active = false;
        cancelAnimationFrame(frame);
      };
    }
    const checkFuture = () => {
      if (!active) return;
      // Compare Jakarta calendar dates: a date-only string parses as 07:00 WIB,
      // which made "today" look like a future date before 7 in the morning.
      setIsFutureDate(occurredAt > todayJakarta());
    };
    const frame = requestAnimationFrame(checkFuture);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [occurredAt]);

  // AI Scanner handler
  const handleScanClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScannedItems(null);
    const toastId = toast.loading("Mengompres & men-scan struk dengan AI...");

    // Time each phase so we can tell where slow scans come from: on-device
    // image compression vs the network/AI round-trip.
    const scanStart = performance.now();

    try {
      const compressStart = performance.now();
      // 900px keeps receipts readable for the AI while cutting canvas decode
      // work on high-megapixel phone photos (compression scales with source
      // resolution, not receipt length).
      const compressed = await compressImage(file, 900, 900, 0.75);
      const compressMs = Math.round(performance.now() - compressStart);
      console.log(
        `[scan-receipt] compress=${compressMs}ms source=${(file.size / 1024).toFixed(0)}KB ` +
          `-> payload=${((compressed.base64.length * 3) / 4 / 1024).toFixed(0)}KB`
      );

      const flatCategories = categoriesTree.flatMap((p) => [p, ...p.subcategories]);
      const activeCategoriesPayload = flatCategories.map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
      }));

      const requestStart = performance.now();
      const response = await fetch("/api/scan-receipt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: compressed.base64,
          mimeType: compressed.mimeType,
          categories: activeCategoriesPayload,
        }),
      });
      console.log(
        `[scan-receipt] request(network+ai)=${Math.round(performance.now() - requestStart)}ms ` +
          `total=${Math.round(performance.now() - scanStart)}ms`
      );

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || "Gagal memproses gambar");
      }

      const resData = await response.json();

      if (resData.amount) {
        setAmountExpr(String(resData.amount));
      }
      if (resData.note) {
        setNote(resData.note);
      }
      if (resData.category_id) {
        const matched = flatCategories.find((c) => c.id === resData.category_id);
        if (matched) {
          setSelectedCategoryId(matched.id);
        }
      }
      if (resData.items) {
        setScannedItems(resData.items);
        setScannedItemsOpen(true);
      }

      toast.success("Struk berhasil di-scan dengan AI!", { id: toastId });
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : "Gagal men-scan struk dengan AI. Silakan coba lagi.";
      toast.error(errMsg, { id: toastId });
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Calculate parsed mathematical amount expression
  const parsedAmount = React.useMemo(() => {
    if (!amountExpr) return 0;
    if (/^\d+$/.test(amountExpr)) {
      return parseInt(amountExpr, 10);
    }
    const result = parseAmountExpression(amountExpr);
    return result !== null && result > 0 ? result : 0;
  }, [amountExpr]);

  // What the amount box shows: digit groups formatted ("25.000"), operators
  // as typed symbols. The raw expression stays in state for parsing.
  const amountDisplay = React.useMemo(
    () =>
      amountExpr
        .replace(/\d+/g, (run) =>
          // Keep leading zeros the user typed ("0" before "000") visible.
          /^0\d/.test(run) ? run : Number(run).toLocaleString("id-ID")
        )
        .replace(/\*/g, "×")
        .replace(/\//g, "÷")
        .replace(/-/g, "−"),
    [amountExpr]
  );

  const isExpression = React.useMemo(() => {
    return /[+\-*/()]/.test(amountExpr);
  }, [amountExpr]);

  // Tag helpers — normalise (lowercase, strip leading '#', collapse spaces) and dedupe.
  const commitTag = (raw: string) => {
    const cleaned = raw.trim().replace(/^#+/, "").replace(/\s+/g, " ").toLowerCase();
    if (!cleaned) return;
    setTags((prev) => (prev.includes(cleaned) ? prev : [...prev, cleaned]));
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      // Prevent the surrounding <form> from submitting on Enter.
      e.preventDefault();
      commitTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      // Quick-remove the last chip when the field is empty.
      e.preventDefault();
      removeTag(tags[tags.length - 1]);
    }
  };

  // Reset only the transient fields so the next entry can reuse wallet/category/date.
  const resetForFastEntry = () => {
    setAmountExpr("");
    setNote("");
    setTags([]);
    setTagInput("");
    setScannedItems(null);
    setScannedItemsOpen(false);
    setShowKeypad(true);
    requestAnimationFrame(() => {
      document.getElementById("amount-display-input")?.focus();
    });
  };

  // Submit transaction
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (parsedAmount <= 0) {
      toast.error("Nominal transaksi harus lebih dari Rp 0");
      return;
    }

    if (!activeWalletId) {
      toast.error("Pilih dompet sumber");
      return;
    }

    if (type === "transfer" && !selectedToWalletId) {
      toast.error("Pilih dompet tujuan transfer");
      return;
    }

    if (type === "transfer" && activeWalletId === selectedToWalletId) {
      toast.error("Dompet asal dan tujuan tidak boleh sama");
      return;
    }

    if (type !== "transfer" && !activeCategoryId) {
      toast.error("Pilih kategori transaksi");
      return;
    }

    // Fold any still-typed tag into the list so it isn't lost on submit.
    const pending = tagInput.trim().replace(/^#+/, "").replace(/\s+/g, " ").toLowerCase();
    const finalTags = pending && !tags.includes(pending) ? [...tags, pending] : tags;

    // Editing without touching the date keeps the original timestamp (and so
    // its time of day and position in the list).
    const occurredAtIso =
      editingTransaction && occurredAt === jakartaDateKey(editingTransaction.occurred_at)
        ? editingTransaction.occurred_at
        : occurredAtForDate(occurredAt);

    try {
      if (editingTransaction) {
        await updateTx.mutateAsync({
          id: editingTransaction.id,
          type,
          amount: parsedAmount,
          occurred_at: occurredAtIso,
          wallet_id: activeWalletId,
          to_wallet_id: type === "transfer" ? selectedToWalletId : null,
          category_id: type !== "transfer" ? activeCategoryId : null,
          note: note.trim() || null,
          tags: finalTags,
          receipt_items: scannedItems,
        });
        toast.success("Transaksi berhasil diubah ✓");
      } else {
        await createTx.mutateAsync({
          type,
          amount: parsedAmount,
          occurred_at: occurredAtIso,
          wallet_id: activeWalletId,
          to_wallet_id: type === "transfer" ? selectedToWalletId : null,
          category_id: type !== "transfer" ? activeCategoryId : null,
          note: note.trim() || null,
          tags: finalTags,
          receipt_items: scannedItems,
        });
        const title = keepOpen ? "Tersimpan ✓ — lanjut catat berikutnya" : "Tersimpan ✓";
        const feedback =
          type === "expense" && householdId && activeCategoryId && !isFutureDate
            ? await budgetFeedback(householdId, activeCategoryId, occurredAtIso, categoriesTree).catch(
                () => null
              )
            : null;
        if (feedback?.over) {
          toast.warning(title, { description: feedback.text });
        } else {
          toast.success(title, feedback ? { description: feedback.text } : undefined);
        }
      }

      setLastWallet(activeWalletId);
      if (type !== "transfer" && activeCategoryId) {
        setLastCategory(activeCategoryId);
      }

      // Fast batch entry: keep the drawer open and clear only transient fields.
      if (keepOpen && !editingTransaction) {
        resetForFastEntry();
      } else {
        closeQuickAdd();
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Gagal menyimpan transaksi. Coba lagi.";
      toast.error(errMsg);
    }
  };

  return (
    <>
      <DrawerHeader className="relative px-0 flex-shrink-0">
        <DrawerTitle className="text-center text-lg font-semibold">
          {editingTransaction ? "Ubah Catatan Keuangan" : "Tambah Catatan Keuangan"}
        </DrawerTitle>
        <DrawerClose asChild>
          <button
            type="button"
            aria-label="Tutup"
            className="absolute right-0 top-1/2 -translate-y-1/2 grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </DrawerClose>
      </DrawerHeader>

      <form ref={formRef} onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Scrollable area above keypad */}
        <div className="flex-1 overflow-y-auto pr-0.5 space-y-4 pb-4 scrollbar-thin">
          {/* Quick-toggle Type Buttons */}
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => handleTypeChange("expense")}
              className={`rounded-lg py-2 text-xs font-semibold transition-all ${
                type === "expense"
                  ? "bg-card text-expense shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pengeluaran
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange("income")}
              className={`rounded-lg py-2 text-xs font-semibold transition-all ${
                type === "income"
                  ? "bg-card text-income shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pemasukan
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange("transfer")}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                type === "transfer"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ArrowRightLeft className="size-3.5" />
              Transfer
            </button>
          </div>

          {/* Amount display — readOnly, driven by the keypad. Receipt scan sits
              beside it as a shortcut rather than a banner above everything. */}
          <div className="space-y-1.5 rounded-2xl bg-card border px-4 py-3.5 text-center relative">
            <Label className="text-xs text-muted-foreground">Nominal (Rp)</Label>
            <div className="relative flex items-center justify-center gap-1 px-9">
              {!editingTransaction && (
                <button
                  type="button"
                  disabled={isScanning}
                  onClick={handleScanClick}
                  className="absolute left-0 top-1/2 -translate-y-1/2 grid size-8 place-items-center rounded-lg text-mint-strong hover:bg-mint-soft/60 transition-colors disabled:opacity-60"
                  title="Scan struk dengan AI"
                  aria-label="Scan struk dengan AI"
                >
                  {isScanning ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                </button>
              )}
              <span className="text-2xl font-bold text-muted-foreground select-none">Rp</span>
              <input
                id="amount-display-input"
                ref={amountInputRef}
                type="text"
                readOnly
                placeholder="0"
                value={amountDisplay}
                onClick={() => setShowKeypad(true)}
                onFocus={(e) => {
                  const end = e.currentTarget.value.length;
                  e.currentTarget.setSelectionRange(end, end);
                }}
                className="w-full text-center text-3xl font-bold focus:outline-none bg-transparent caret-mint-strong cursor-pointer"
                autoFocus
                required
              />
              <button
                type="button"
                onClick={() => setShowKeypad(!showKeypad)}
                className="absolute right-0 top-1/2 -translate-y-1/2 grid size-8 place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title={showKeypad ? "Sembunyikan keypad" : "Tampilkan keypad"}
                aria-label={showKeypad ? "Sembunyikan keypad" : "Tampilkan keypad"}
              >
                <Keyboard className="size-4" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                capture="environment"
                className="hidden"
              />
            </div>
            {/* Show real-time calculator evaluation */}
            {isExpression && parsedAmount > 0 && (
              <p className="text-xs font-medium text-mint-strong animate-in fade-in slide-in-from-top-1 duration-200">
                Hasil: {formatCurrency(parsedAmount)}
              </p>
            )}
            {isExpression && parsedAmount === 0 && amountExpr !== "" && (
              <p className="text-xs text-muted-foreground">
                Lanjutkan rumus…
              </p>
            )}
            {isScanning && (
              <p className="text-xs text-muted-foreground">Membaca struk…</p>
            )}
          </div>

          {/* Category chips — the most-used ones, plus a "Lainnya" chip that
              opens the full list (one picker instead of chips + a dropdown). */}
          {type !== "transfer" && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">Kategori</Label>
              <div className="flex flex-wrap gap-2">
                {activeCategories.map((cat) => {
                  const isActive = activeCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => {
                        setSelectedCategoryId(cat.id);
                        setShowKeypad(false);
                      }}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 ${
                        isActive
                          ? "bg-mint-soft text-mint-strong border-mint-strong/30"
                          : "bg-card text-foreground hover:bg-muted"
                      }`}
                    >
                      {isActive ? (
                        <Check className="size-3" />
                      ) : (
                        <CategoryIcon icon={cat.icon} className="size-3" />
                      )}
                      <span>{cat.name}</span>
                    </button>
                  );
                })}

                <Select
                  value={activeCategoryId}
                  onValueChange={(val) => {
                    // Radix fires onValueChange("") on mount (its hidden native
                    // <select>); no item has an empty value, so ignore it.
                    if (!val) return;
                    setSelectedCategoryId(val);
                    setShowKeypad(false);
                  }}
                >
                  <SelectTrigger
                    aria-label="Pilih kategori lain"
                    className={`h-auto! rounded-full px-3 py-1.5 text-xs font-medium ${
                      activeCategory && !activeIsChip
                        ? "bg-mint-soft text-mint-strong border-mint-strong/30"
                        : "bg-card text-foreground border-dashed"
                    }`}
                  >
                    {activeCategory && !activeIsChip ? (
                      <span className="flex items-center gap-1.5">
                        <Check className="size-3" />
                        {activeCategory.name}
                      </span>
                    ) : (
                      <span>Lainnya…</span>
                    )}
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-72">
                    {categoriesTree
                      .filter((p) => p.kind === type)
                      .map((parent) => (
                        <React.Fragment key={parent.id}>
                          <SelectItem value={parent.id} className="font-semibold text-foreground">
                            <span className="flex items-center gap-1.5">
                              <CategoryIcon icon={parent.icon} className="size-4" fallback="📁" />
                              <span>{parent.name}</span>
                            </span>
                          </SelectItem>
                          {parent.subcategories.map((child) => (
                            <SelectItem key={child.id} value={child.id} className="pl-6 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <span>↳</span>
                                <CategoryIcon icon={child.icon} className="size-3" />
                                <span>{child.name}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </React.Fragment>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Wallet(s) */}
          <div className={type === "transfer" ? "grid grid-cols-2 gap-3" : ""}>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                {type === "transfer" ? "Dari Dompet" : "Dompet"}
              </Label>
              <Select
                value={activeWalletId}
                onValueChange={(val) => {
                  // Radix fires onValueChange("") on mount (its hidden native
                  // <select>); no item has an empty value, so ignore it.
                  if (!val) return;
                  setSelectedWalletId(val);
                  // The destination list hides the source wallet; drop a
                  // destination that just became the source.
                  if (val === selectedToWalletId) setSelectedToWalletId("");
                  setShowKeypad(false);
                }}
              >
                <SelectTrigger className="h-10 w-full bg-card border rounded-xl">
                  <SelectValue placeholder="Pilih dompet" />
                </SelectTrigger>
                <SelectContent>
                  {wallets.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {type === "transfer" && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Ke Dompet</Label>
                <Select
                  value={selectedToWalletId}
                  onValueChange={(val) => {
                    // Radix fires onValueChange("") on mount (its hidden native
                    // <select>); no item has an empty value, so ignore it.
                    if (!val) return;
                    setSelectedToWalletId(val);
                    setShowKeypad(false);
                  }}
                >
                  <SelectTrigger className="h-10 w-full bg-card border rounded-xl">
                    <SelectValue placeholder="Pilih dompet" />
                  </SelectTrigger>
                  <SelectContent>
                    {wallets
                      .filter((w) => w.id !== activeWalletId)
                      .map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Date: one-tap Hari ini / Kemarin, or any date */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              Tanggal
              {isFutureDate && (
                <span className="ml-1 rounded-full bg-mint-soft px-1.5 py-0.5 text-[10px] font-semibold text-mint-strong">
                  Terjadwal
                </span>
              )}
            </Label>
            <div className="flex items-center gap-2">
              {[
                { label: "Hari ini", value: todayKey },
                { label: "Kemarin", value: yesterdayKey },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  aria-pressed={occurredAt === opt.value}
                  onClick={() => {
                    setOccurredAt(opt.value);
                    setShowKeypad(false);
                  }}
                  className={`h-10 shrink-0 rounded-xl border px-3 text-xs font-medium transition-all active:scale-95 ${
                    occurredAt === opt.value
                      ? "bg-mint-soft text-mint-strong border-mint-strong/30"
                      : "bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <div className="relative min-w-0 flex-1">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  aria-label="Pilih tanggal"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                  onFocus={() => setShowKeypad(false)}
                  className={`h-10 pl-9 pr-2 bg-card border rounded-xl ${
                    occurredAt !== todayKey && occurredAt !== yesterdayKey
                      ? "border-mint-strong/40 text-mint-strong"
                      : "text-muted-foreground"
                  }`}
                  required
                />
              </div>
            </div>
          </div>

          {/* Note — full width so a real description fits */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              Catatan <span className="font-normal text-muted-foreground/70">(opsional)</span>
            </Label>
            <div className="relative">
              <FileText className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Beli sayur, susu, dsb."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onFocus={() => setShowKeypad(false)}
                className="h-10 pl-9 bg-card border rounded-xl"
              />
            </div>
          </div>

          {/* Tags input */}
          <div className="flex flex-col gap-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Tag className="size-3.5" />
              Tag <span className="font-normal text-muted-foreground/70">(opsional)</span>
            </Label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-card px-2.5 py-2 focus-within:border-mint-strong/40">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded-full bg-mint-soft px-2 py-0.5 text-xs font-medium text-mint-strong"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="rounded-full p-0.5 hover:bg-mint-strong/15"
                    aria-label={`Hapus tag ${tag}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => commitTag(tagInput)}
                onFocus={() => setShowKeypad(false)}
                placeholder={tags.length === 0 ? "mis. liburan, anak — Enter untuk tambah" : "tambah tag…"}
                className="min-w-[7rem] flex-1 bg-transparent py-0.5 text-sm focus:outline-none"
              />
            </div>
          </div>

          {/* Collapsible Scanned Items Breakdown */}
          {scannedItems && scannedItems.length > 0 && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="flex w-full items-center justify-between p-3.5 text-left">
                <div
                  onClick={() => setScannedItemsOpen(!scannedItemsOpen)}
                  className="flex flex-1 items-center gap-2 cursor-pointer select-none"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-mint-soft/50 text-mint-strong">
                    <FileText className="size-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-foreground">Detail Struk Terdeteksi</span>
                    <p className="text-[10px] text-muted-foreground">{scannedItems.length} item terdaftar</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setScannedItems(null);
                      setScannedItemsOpen(false);
                      toast.info("Data struk direset");
                    }}
                    className="p-1 text-muted-foreground hover:text-expense rounded-md hover:bg-destructive/10 transition-colors"
                    title="Hapus data struk"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setScannedItemsOpen(!scannedItemsOpen)}
                    className="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                    title={scannedItemsOpen ? "Tutup detail" : "Buka detail"}
                  >
                    {scannedItemsOpen ? (
                      <ChevronUp className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              {scannedItemsOpen && (
                <div className="border-t border-border divide-y divide-border/60 max-h-48 overflow-y-auto bg-muted/20 animate-in fade-in duration-200">
                  {scannedItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 px-3.5 text-xs">
                      <span className="font-medium text-foreground truncate max-w-[65%]">
                        {item.name}
                      </span>
                      <span className="font-semibold text-muted-foreground">
                        {formatCurrency(item.price)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Virtual keypad (4×4). Parentheses and ÷ stay available on a
            physical keyboard; a hidden keypad is reopened by tapping the amount. */}
        {showKeypad && (
          <div className="grid grid-cols-4 gap-1.5 bg-muted/40 p-2.5 rounded-2xl border border-border animate-in slide-in-from-bottom duration-200 flex-shrink-0 mb-3 select-none">
            {keypadKeys.map((key) => {
              const isOperator = ["×", "-", "+"].includes(key);
              let btnClass = "h-11 rounded-xl font-bold text-sm transition-all active:scale-95 duration-75 flex items-center justify-center ";

              if (key === "⌫" || key === "C") {
                btnClass += "bg-red-50 text-expense dark:bg-red-950/20 dark:text-red-400 hover:bg-red-100/50";
              } else if (isOperator) {
                btnClass += "bg-muted text-foreground hover:bg-muted/80";
              } else {
                btnClass += "bg-card text-foreground border hover:bg-muted/50";
              }

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleKeypadPress(key)}
                  className={btnClass}
                  aria-label={key === "⌫" ? "Hapus satu digit" : key === "C" ? "Hapus semua" : undefined}
                >
                  {key === "⌫" ? <span className="text-base select-none">⌫</span> : key === "-" ? "−" : key}
                </button>
              );
            })}
          </div>
        )}

        {/* Action row: batch-entry toggle + one full-width save. Closing is the
            X in the header or a swipe down. */}
        <DrawerFooter className="px-0 pt-3 pb-1 flex flex-row items-center gap-3 flex-shrink-0 border-t bg-background">
          {!editingTransaction && (
            <label className="flex shrink-0 cursor-pointer select-none flex-col items-center gap-1">
              <Switch checked={keepOpen} onCheckedChange={setKeepOpen} aria-label="Simpan lalu tambah lagi" />
              <span className="text-[10px] font-medium leading-none text-muted-foreground">Tambah lagi</span>
            </label>
          )}
          <Button
            type="submit"
            disabled={createTx.isPending || updateTx.isPending || parsedAmount <= 0}
            className="flex-1 h-12 bg-mint-strong text-white hover:bg-mint-strong/90 rounded-xl font-semibold gap-1.5"
          >
            {createTx.isPending || updateTx.isPending ? (
              "Menyimpan..."
            ) : editingTransaction ? (
              "Simpan Perubahan"
            ) : parsedAmount > 0 ? (
              `Simpan ${formatCurrency(parsedAmount)}`
            ) : (
              "Simpan Transaksi"
            )}
          </Button>
        </DrawerFooter>
      </form>
    </>
  );
}
