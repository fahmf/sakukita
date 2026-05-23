"use client";

import * as React from "react";
import { useWallets, useWalletBalances, useCreateWallet } from "@/hooks/use-wallets";
import { formatCurrency } from "@/lib/format";
import { PageHeading } from "@/components/shared/empty-state";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
} from "lucide-react";
import { toast } from "sonner";
import type { WalletType } from "@/lib/supabase/types";

const typeIcons: Record<WalletType, any> = {
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

export default function WalletsPage() {
  const { data: wallets = [], isLoading: loadingWallets } = useWallets();
  const { data: balances = [], isLoading: loadingBalances } = useWalletBalances();
  const createWallet = useCreateWallet();

  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<WalletType>("cash");
  const [initialBalance, setInitialBalance] = React.useState("");
  const [color, setColor] = React.useState("#5FBF9A");

  // Map balances by wallet_id
  const balanceMap = React.useMemo(() => {
    return new Map(balances.map((b) => [b.wallet_id, b.balance]));
  }, [balances]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await createWallet.mutateAsync({
        name,
        type,
        initial_balance: parseFloat(initialBalance) || 0,
        color,
      });

      toast.success("Dompet baru berhasil dibuat!");
      setName("");
      setInitialBalance("");
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Gagal membuat dompet. Coba lagi.");
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

  return (
    <div className="space-y-6">
      <PageHeading
        title="Dompetku"
        subtitle="Kelola aset dan rekening keluarga"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-mint-strong text-white hover:bg-mint-strong/90 rounded-xl gap-1.5">
                <Plus className="size-4" />
                Tambah
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle>Buat Dompet Baru</DialogTitle>
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

                <div className="flex flex-col gap-1.5">
                  <Label>Warna Aksen</Label>
                  <div className="flex gap-2.5">
                    {["#5FBF9A", "#B8E6D3", "#E8A5A5", "#F4D2A6", "#C8A5E8", "#A5C8E8"].map((c) => (
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

                <DialogFooter className="pt-2">
                  <Button
                    type="submit"
                    disabled={createWallet.isPending || !name}
                    className="h-11 rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90 font-semibold w-full"
                  >
                    {createWallet.isPending ? "Membuat..." : "Buat Dompet"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
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
              <div
                key={wallet.id}
                className="flex items-center justify-between rounded-2xl border bg-card p-4 transition-all hover:border-mint-strong/30"
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
                <div className="text-right">
                  <p className="font-semibold text-sm">{formatCurrency(balance)}</p>
                  {wallet.exclude_from_networth && (
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                      Bukan Kekayaan
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
