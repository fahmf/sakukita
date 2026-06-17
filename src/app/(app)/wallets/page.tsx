"use client";

import * as React from "react";
import {
  useWallets,
  useWalletBalances,
  useCreateWallet,
  useUpdateWallet,
  useArchiveWallet,
} from "@/hooks/use-wallets";
import { formatCurrency } from "@/lib/format";
import { PageHeading } from "@/components/shared/empty-state";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Banknote,
  Landmark,
  Smartphone,
  CreditCard,
  PiggyBank,
  TrendingUp,
  Plus,
  Loader2,
  Pencil,
  Archive,
} from "lucide-react";
import { toast } from "sonner";
import type { Wallet, WalletType } from "@/lib/supabase/types";

const typeIcons: Record<WalletType, React.ComponentType<{ className?: string }>> = {
  cash: Banknote,
  debit: Landmark,
  ewallet: Smartphone,
  credit: CreditCard,
  savings: PiggyBank,
  investment: TrendingUp,
  receivable: Banknote,
  payable: CreditCard,
};

const typeLabels: Record<WalletType, string> = {
  cash: "Tunai (Cash)",
  debit: "Rekening Bank / Debit",
  ewallet: "Dompet Digital (E-Wallet)",
  credit: "Kartu Kredit",
  savings: "Tabungan",
  investment: "Investasi",
  receivable: "Piutang",
  payable: "Utang",
};

const WALLET_COLORS = ["#5FBF9A", "#B8E6D3", "#E8A5A5", "#F4D2A6", "#C8A5E8", "#A5C8E8"];

export default function WalletsPage() {
  const { data: wallets = [], isLoading: loadingWallets } = useWallets();
  const { data: balances = [], isLoading: loadingBalances } = useWalletBalances();
  const createWallet = useCreateWallet();
  const updateWallet = useUpdateWallet();
  const archiveWallet = useArchiveWallet();

  const [open, setOpen] = React.useState(false);
  // null = create mode, Wallet = edit mode
  const [editingWallet, setEditingWallet] = React.useState<Wallet | null>(null);
  const [confirmArchive, setConfirmArchive] = React.useState<Wallet | null>(null);

  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<WalletType>("cash");
  const [initialBalance, setInitialBalance] = React.useState("");
  const [color, setColor] = React.useState(WALLET_COLORS[0]);
  const [excludeFromNetworth, setExcludeFromNetworth] = React.useState(false);

  // Map balances by wallet_id
  const balanceMap = React.useMemo(() => {
    return new Map(balances.map((b) => [b.wallet_id, b.balance]));
  }, [balances]);

  const openCreate = () => {
    setEditingWallet(null);
    setName("");
    setType("cash");
    setInitialBalance("");
    setColor(WALLET_COLORS[0]);
    setExcludeFromNetworth(false);
    setOpen(true);
  };

  const openEdit = (wallet: Wallet) => {
    setEditingWallet(wallet);
    setName(wallet.name);
    setType(wallet.type);
    setInitialBalance(String(wallet.initial_balance ?? 0));
    setColor(wallet.color || WALLET_COLORS[0]);
    setExcludeFromNetworth(wallet.exclude_from_networth);
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      if (editingWallet) {
        await updateWallet.mutateAsync({
          id: editingWallet.id,
          name: name.trim(),
          type,
          initial_balance: parseFloat(initialBalance) || 0,
          color,
          exclude_from_networth: excludeFromNetworth,
        });
        toast.success("Dompet berhasil diperbarui!");
      } else {
        await createWallet.mutateAsync({
          name: name.trim(),
          type,
          initial_balance: parseFloat(initialBalance) || 0,
          color,
        });
        toast.success("Dompet baru berhasil dibuat!");
      }
      setOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menyimpan dompet. Coba lagi.";
      toast.error(message);
    }
  };

  const handleArchive = async () => {
    if (!confirmArchive) return;
    try {
      await archiveWallet.mutateAsync(confirmArchive.id);
      toast.success("Dompet diarsipkan. Saldo & riwayat transaksi tetap tersimpan.");
      // If the archived wallet was open in the edit dialog, close it.
      if (editingWallet?.id === confirmArchive.id) setOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal mengarsipkan dompet.";
      toast.error(message);
    } finally {
      setConfirmArchive(null);
    }
  };

  const totalWealth = React.useMemo(() => {
    let sum = 0;
    wallets.forEach((w) => {
      if (!w.exclude_from_networth) {
        sum += balanceMap.get(w.id) ?? w.initial_balance;
      }
    });
    return sum;
  }, [wallets, balanceMap]);

  const isSaving = createWallet.isPending || updateWallet.isPending;

  return (
    <div className="space-y-6">
      <PageHeading
        title="Dompetku"
        subtitle="Kelola aset dan rekening keluarga"
        action={
          <Button
            size="sm"
            onClick={openCreate}
            className="bg-mint-strong text-white hover:bg-mint-strong/90 rounded-xl gap-1.5"
          >
            <Plus className="size-4" />
            Tambah
          </Button>
        }
      />

      {/* Net Worth Summary */}
      <div className="rounded-2xl border bg-card p-5 text-center space-y-1">
        <span className="text-xs text-muted-foreground font-medium">Total Kekayaan Bersih</span>
        {loadingWallets || loadingBalances ? (
          <div className="h-8 flex items-center justify-center">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <p className="text-2xl font-bold text-foreground">{formatCurrency(totalWealth)}</p>
        )}
      </div>

      {/* Wallets Grid List */}
      {loadingWallets ? (
        <div className="space-y-3">
          <div className="h-20 bg-muted animate-pulse rounded-2xl" />
          <div className="h-20 bg-muted animate-pulse rounded-2xl" />
        </div>
      ) : wallets.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-2xl space-y-2">
          <p className="font-semibold text-muted-foreground">Belum ada dompet aktif</p>
          <p className="text-xs text-muted-foreground">Pencatatan keuangan Anda membutuhkan minimal 1 dompet aktif.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {wallets.map((wallet) => {
            const IconComponent = typeIcons[wallet.type] || Banknote;
            const balance = balanceMap.get(wallet.id) ?? wallet.initial_balance;
            return (
              <button
                key={wallet.id}
                type="button"
                onClick={() => openEdit(wallet)}
                className="flex w-full items-center justify-between rounded-2xl border bg-card p-4 text-left transition-all hover:border-mint-strong/30 active:scale-[0.99]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="grid size-11 shrink-0 place-items-center rounded-xl text-white font-semibold"
                    style={{ backgroundColor: wallet.color || "#5FBF9A" }}
                  >
                    <IconComponent className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium truncate text-sm text-foreground">{wallet.name}</p>
                    <p className="text-xs text-muted-foreground">{typeLabels[wallet.type]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="font-semibold text-sm">{formatCurrency(balance)}</p>
                    {wallet.exclude_from_networth && (
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        Bukan Kekayaan
                      </span>
                    )}
                  </div>
                  <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingWallet ? "Ubah Dompet" : "Buat Dompet Baru"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nama Dompet</Label>
              <Input
                id="name"
                placeholder="Contoh: BCA Tabungan, LinkAja"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 rounded-xl"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="type">Tipe</Label>
                <Select value={type} onValueChange={(val: WalletType) => setType(val)}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="Pilih tipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="initial_balance">Saldo Awal (Rp)</Label>
                <Input
                  id="initial_balance"
                  type="number"
                  placeholder="0"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>

            {editingWallet && (
              <p className="-mt-2 text-[11px] text-muted-foreground">
                Saldo awal adalah titik mula dompet. Saldo berjalan dihitung dari saldo awal + seluruh transaksi.
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <Label>Warna Aksen</Label>
              <div className="flex gap-2.5">
                {WALLET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`size-8 rounded-full border-2 transition-all ${
                      color === c ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Pilih warna ${c}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 px-3.5 py-3">
              <div className="min-w-0">
                <Label htmlFor="exclude-networth" className="text-sm">
                  Kecualikan dari Kekayaan Bersih
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Saldo dompet ini tidak ikut dihitung dalam total kekayaan.
                </p>
              </div>
              <Switch
                id="exclude-networth"
                checked={excludeFromNetworth}
                onCheckedChange={setExcludeFromNetworth}
              />
            </div>

            <DialogFooter className="flex-col gap-2 pt-2 sm:flex-col">
              <Button
                type="submit"
                disabled={isSaving || !name.trim()}
                className="h-11 rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90 font-semibold w-full"
              >
                {isSaving ? "Menyimpan..." : editingWallet ? "Simpan Perubahan" : "Buat Dompet"}
              </Button>
              {editingWallet && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmArchive(editingWallet)}
                  className="h-11 w-full rounded-xl text-expense hover:bg-red-50 hover:text-expense dark:hover:bg-red-950/20 gap-1.5"
                >
                  <Archive className="size-4" />
                  Arsipkan Dompet
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Archive confirm */}
      <Dialog open={confirmArchive !== null} onOpenChange={(o) => !o && setConfirmArchive(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Arsipkan dompet ini?</DialogTitle>
            <DialogDescription>
              Dompet &ldquo;{confirmArchive?.name}&rdquo; akan disembunyikan dari daftar dan tidak
              bisa dipilih untuk transaksi baru. Riwayat transaksi yang sudah ada tetap tersimpan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              className="rounded-xl h-11"
              onClick={() => setConfirmArchive(null)}
            >
              Batal
            </Button>
            <Button
              className="rounded-xl h-11 bg-expense text-white hover:bg-expense/90"
              onClick={handleArchive}
              disabled={archiveWallet.isPending}
            >
              {archiveWallet.isPending ? "Mengarsipkan..." : "Arsipkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
