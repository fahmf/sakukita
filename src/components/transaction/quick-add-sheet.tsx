"use client";

import * as React from "react";
import { useUIStore } from "@/stores/ui-store";
import { useWallets } from "@/hooks/use-wallets";
import { useCategories } from "@/hooks/use-categories";
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
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Trash2,
  Utensils,
  Car,
  ShoppingBag,
  Gift,
  Heart,
  Receipt,
  CircleDot,
  Briefcase,
  Keyboard,
} from "lucide-react";
import type { TransactionType } from "@/lib/supabase/types";
import { compressImage } from "@/lib/image";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  utensils: Utensils,
  car: Car,
  "shopping-bag": ShoppingBag,
  "party-popper": Gift,
  "heart-pulse": Heart,
  receipt: Receipt,
  wallet: Briefcase,
  gift: Gift,
  "circle-dashed": CircleDot,
};

// 4x5 Keypad layout keys definition
const keypadKeys = [
  "7", "8", "9", "⌫",
  "4", "5", "6", "÷",
  "1", "2", "3", "×",
  "C", "0", "000", "-",
  "(", ")", "+", "OK"
];

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

  const { data: wallets = [] } = useWallets();
  const { data: categoriesTree = [] } = useCategories();
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
      ? editingTransaction.occurred_at.split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [note, setNote] = React.useState(() =>
    editingTransaction ? (editingTransaction.note || "") : ""
  );

  // Keypad open/close visibility state
  const [showKeypad, setShowKeypad] = React.useState(true);

  // AI receipt scanner states
  const [isScanning, setIsScanning] = React.useState(false);
  const [scannedItems, setScannedItems] = React.useState<{ name: string; price: number }[] | null>(null);
  const [scannedItemsOpen, setScannedItemsOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Gather categories for quick chips
  const activeCategories = React.useMemo(() => {
    if (type === "transfer") return [];
    return categoriesTree.filter((c) => c.kind === type);
  }, [type, categoriesTree]);

  // Compute active default selections purely during render — eliminates cascading render set-state-in-effect errors
  const activeWalletId = selectedWalletId || lastWalletId || wallets[0]?.id || "";

  const activeCategoryId = React.useMemo(() => {
    if (type === "transfer") return "";
    if (selectedCategoryId) return selectedCategoryId;
    const flatCategories = categoriesTree.flatMap((p) => [p, ...p.subcategories]);
    const available = flatCategories.filter((c) => c.kind === type);
    return lastCategoryId || available[0]?.id || "";
  }, [selectedCategoryId, categoriesTree, type, lastCategoryId]);

  // Handle keypad presses
  const handleKeypadPress = (key: string) => {
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

  // Capture physical keyboard inputs when amount input is focused or captured globally
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      // If user is actively typing in Note or Date fields, let the normal typing happen!
      if (activeEl?.tagName === "INPUT" && activeEl.id !== "amount-display-input") {
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
        e.preventDefault();
        setShowKeypad(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeQuickAdd]);

  // Adjust categories automatically when transaction type changes
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    if (newType !== "transfer") {
      const flatCategories = categoriesTree.flatMap((p) => [p, ...p.subcategories]);
      const available = flatCategories.filter((c) => c.kind === newType);
      if (available.length > 0) {
        setSelectedCategoryId(available[0].id);
      }
    }
  };

  // Pure dynamic render check for scheduled transaction check — completely removes set-state-in-effect warning
  const isFutureDate = React.useMemo(() => {
    if (!occurredAt) return false;
    // eslint-disable-next-line react-hooks/purity
    return new Date(occurredAt).getTime() > Date.now();
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

    try {
      const compressed = await compressImage(file, 1024, 1024, 0.75);

      const flatCategories = categoriesTree.flatMap((p) => [p, ...p.subcategories]);
      const activeCategoriesPayload = flatCategories.map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
      }));

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

  const isExpression = React.useMemo(() => {
    return /[+\-*/()]/.test(amountExpr);
  }, [amountExpr]);

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

    try {
      if (editingTransaction) {
        await updateTx.mutateAsync({
          id: editingTransaction.id,
          type,
          amount: parsedAmount,
          occurred_at: new Date(occurredAt).toISOString(),
          wallet_id: activeWalletId,
          to_wallet_id: type === "transfer" ? selectedToWalletId : null,
          category_id: type !== "transfer" ? activeCategoryId : null,
          note: note.trim() || null,
        });
        toast.success("Transaksi berhasil diubah ✓");
      } else {
        await createTx.mutateAsync({
          type,
          amount: parsedAmount,
          occurred_at: new Date(occurredAt).toISOString(),
          wallet_id: activeWalletId,
          to_wallet_id: type === "transfer" ? selectedToWalletId : null,
          category_id: type !== "transfer" ? activeCategoryId : null,
          note: note.trim() || null,
        });
        toast.success("Tersimpan ✓");
      }

      setLastWallet(activeWalletId);
      if (type !== "transfer" && activeCategoryId) {
        setLastCategory(activeCategoryId);
      }

      closeQuickAdd();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Gagal menyimpan transaksi. Coba lagi.";
      toast.error(errMsg);
    }
  };

  return (
    <>
      <DrawerHeader className="px-0 flex-shrink-0">
        <DrawerTitle className="text-center text-lg font-semibold">
          {editingTransaction ? "Ubah Catatan Keuangan" : "Tambah Catatan Keuangan"}
        </DrawerTitle>
      </DrawerHeader>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Scrollable area above keypad */}
        <div className="flex-1 overflow-y-auto pr-0.5 space-y-4 pb-4 scrollbar-thin">
          {/* Scan Struk AI Action Panel */}
          {!editingTransaction && (
            <div className="relative overflow-hidden rounded-2xl border border-mint-strong/20 bg-linear-to-r from-mint-soft/30 via-muted/40 to-mint-soft/20 p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint-soft text-mint-strong">
                  <Sparkles className="size-4 animate-pulse" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-semibold text-foreground">Scan Struk dengan AI</h4>
                  <p className="text-[10px] text-muted-foreground">Isi nominal, kategori & catatan otomatis</p>
                </div>
              </div>
              <Button
                type="button"
                disabled={isScanning}
                onClick={handleScanClick}
                size="sm"
                className="h-8.5 rounded-lg bg-mint-strong px-3 text-xs font-medium text-white hover:bg-mint-strong/90 active:scale-95 transition-transform"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="mr-1.5 size-3 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <Camera className="mr-1.5 size-3.5" />
                    Ambil Foto
                  </>
                )}
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                capture="environment"
                className="hidden"
              />
            </div>
          )}

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

          {/* Amount Display Input — readOnly on mobile, clickable to show Virtual Keypad */}
          <div className="space-y-1.5 rounded-2xl bg-card border px-4 py-3.5 text-center relative">
            <Label className="text-xs text-muted-foreground">Nominal (Rp)</Label>
            <div className="relative flex items-center justify-center gap-1">
              <span className="text-2xl font-bold text-muted-foreground select-none">Rp</span>
              <input
                id="amount-display-input"
                type="text"
                readOnly
                placeholder="0"
                value={amountExpr}
                onClick={() => setShowKeypad(true)}
                className="w-full text-center text-3xl font-bold focus:outline-none bg-transparent caret-mint-strong cursor-pointer"
                autoFocus
                required
              />
              <button
                type="button"
                onClick={() => setShowKeypad(!showKeypad)}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title={showKeypad ? "Sembunyikan Keypad" : "Tampilkan Keypad"}
              >
                <Keyboard className="size-4" />
              </button>
            </div>
            {/* Show real-time calculator evaluation */}
            {isExpression && parsedAmount > 0 && (
              <p className="text-xs font-medium text-mint-strong animate-in fade-in slide-in-from-top-1 duration-200">
                Hasil: {formatCurrency(parsedAmount)}
              </p>
            )}
            {isExpression && parsedAmount === 0 && amountExpr !== "" && (
              <p className="text-xs text-expense animate-pulse">
                Mengetik rumus...
              </p>
            )}
          </div>

          {/* Category Chips (Expense / Income only) */}
          {type !== "transfer" && activeCategories.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">Kategori Cepat</Label>
              <div className="flex flex-wrap gap-2">
                {activeCategories.slice(0, 6).map((cat) => {
                  const isActive = activeCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
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
                      ) : iconMap[cat.icon || ""] ? (
                        React.createElement(iconMap[cat.icon || ""], { className: "size-3" })
                      ) : (
                        <span className="text-sm select-none leading-none">{cat.icon || "🏷️"}</span>
                      )}
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dompet Picker & Category Dropdown Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Wallet Source Picker */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                {type === "transfer" ? "Dari Dompet" : "Dompet"}
              </Label>
              <Select
                value={activeWalletId}
                onValueChange={(val) => {
                  setSelectedWalletId(val);
                  setShowKeypad(false);
                }}
              >
                <SelectTrigger className="h-10 bg-card border rounded-xl">
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

            {/* Wallet Destination (Transfers) or Kategori Dropdown */}
            {type === "transfer" ? (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Ke Dompet</Label>
                <Select
                  value={selectedToWalletId}
                  onValueChange={(val) => {
                    setSelectedToWalletId(val);
                    setShowKeypad(false);
                  }}
                >
                  <SelectTrigger className="h-10 bg-card border rounded-xl">
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
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Semua Kategori</Label>
                <Select
                  value={activeCategoryId}
                  onValueChange={(val) => {
                    setSelectedCategoryId(val);
                    setShowKeypad(false);
                  }}
                >
                  <SelectTrigger className="h-10 bg-card border rounded-xl">
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriesTree
                      .filter((p) => p.kind === type)
                      .map((parent) => (
                        <React.Fragment key={parent.id}>
                          <SelectItem value={parent.id} className="font-semibold text-foreground">
                            <span className="flex items-center gap-1.5">
                              {iconMap[parent.icon || ""] ? (
                                React.createElement(iconMap[parent.icon || ""], { className: "size-4" })
                              ) : (
                                <span className="text-sm select-none leading-none">{parent.icon || "📁"}</span>
                              )}
                              <span>{parent.name}</span>
                            </span>
                          </SelectItem>
                          {parent.subcategories.map((child) => (
                            <SelectItem key={child.id} value={child.id} className="pl-6 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <span>↳</span>
                                {iconMap[child.icon || ""] ? (
                                  React.createElement(iconMap[child.icon || ""], { className: "size-3" })
                                ) : (
                                  <span className="text-xs select-none leading-none">{child.icon || "🏷️"}</span>
                                )}
                                <span>{child.name}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </React.Fragment>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Date & Note Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Occurred At Date Picker */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Tanggal
                {isFutureDate && (
                  <span className="ml-1 rounded-full bg-mint-soft px-1.5 py-0.5 text-[10px] font-semibold text-mint-strong">
                    Terjadwal
                  </span>
                )}
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                  onFocus={() => setShowKeypad(false)}
                  className="h-10 pl-9 bg-card border rounded-xl pr-2"
                  required
                />
              </div>
            </div>

            {/* Note text input */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Catatan</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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

        {/* Custom Fixed Virtual Keyboard Area */}
        {showKeypad && (
          <div className="grid grid-cols-4 gap-1.5 bg-muted/40 p-2.5 rounded-2xl border border-border animate-in slide-in-from-bottom duration-200 flex-shrink-0 mb-3 select-none">
            {keypadKeys.map((key) => {
              const isOperator = ["÷", "×", "-", "+", "(", ")"].includes(key);
              let btnClass = "h-11 rounded-xl font-bold text-sm transition-all active:scale-95 duration-75 flex items-center justify-center ";

              if (key === "OK") {
                btnClass += "bg-mint-strong text-white hover:bg-mint-strong/90";
              } else if (key === "⌫" || key === "C") {
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
                >
                  {key === "⌫" ? <span className="text-base select-none">⌫</span> : key}
                </button>
              );
            })}
          </div>
        )}

        {/* Action Trigger Buttons */}
        <DrawerFooter className="px-0 pt-3 pb-1 flex flex-row gap-2 flex-shrink-0 border-t bg-background">
          <DrawerClose asChild>
            <Button type="button" variant="outline" className="flex-1 h-12 rounded-xl">
              Batal
            </Button>
          </DrawerClose>
          <Button
            type="submit"
            disabled={createTx.isPending || updateTx.isPending || parsedAmount <= 0}
            className="flex-1 h-12 bg-mint-strong text-white hover:bg-mint-strong/90 rounded-xl font-semibold gap-1.5"
          >
            {createTx.isPending || updateTx.isPending ? (
              "Menyimpan..."
            ) : editingTransaction ? (
              "Simpan Perubahan"
            ) : (
              "Simpan Transaksi"
            )}
          </Button>
        </DrawerFooter>
      </form>
    </>
  );
}
