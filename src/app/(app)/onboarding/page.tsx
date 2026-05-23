"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useCreateWallet, useWallets } from "@/hooks/use-wallets";
import { useCategories } from "@/hooks/use-categories";
import { useCreateTransaction } from "@/hooks/use-transactions";
import { formatCurrency } from "@/lib/format";
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
import { toast } from "sonner";
import { Wallet, Smartphone, Sparkles, Check, CheckCircle2, ArrowRight } from "lucide-react";
import type { WalletType } from "@/lib/supabase/types";

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = React.useState<1 | 2 | 3>(1);

  // Step 1: Wallet States
  const createWallet = useCreateWallet();
  const { data: wallets = [] } = useWallets();
  const [walletName, setWalletName] = React.useState("");
  const [walletType, setWalletType] = React.useState<WalletType>("cash");
  const [initialBalance, setInitialBalance] = React.useState("");

  // Step 2: PWA States
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [isIOS, setIsIOS] = React.useState(false);

  // Step 3: Transaction States
  const { data: categories = [] } = useCategories();
  const createTx = useCreateTransaction();
  const [trialSuccess, setTrialSuccess] = React.useState(false);
  const [particles, setParticles] = React.useState<{ id: number; left: number; top: number; color: string }[]>([]);

  // Check user agent for iOS & listen for PWA install prompt
  React.useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) {
      setIsIOS(true);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  // Step 1 Submit
  const handleWalletSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletName.trim()) return;

    try {
      await createWallet.mutateAsync({
        name: walletName,
        type: walletType,
        initial_balance: parseFloat(initialBalance) || 0,
        color: "#5FBF9A",
      });
      toast.success("Dompet baru berhasil dibuat!");
      setCurrentStep(2);
    } catch (err) {
      toast.error("Gagal membuat dompet. Silakan coba lagi.");
    }
  };

  // Step 2 Action
  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      toast.info("Gunakan opsi menu browser untuk menginstal.");
      setCurrentStep(3);
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      toast.success("Aplikasi diinstal!");
    }
    setDeferredPrompt(null);
    setCurrentStep(3);
  };

  // Step 3 Trial Transaction
  const handleTrialTransaction = async () => {
    const targetWallet = wallets[0]?.id;
    // Find "Makanan" category
    const flatCategories = categories.flatMap(p => [p, ...p.subcategories]);
    const foodCat = flatCategories.find(c => c.name === "Makanan" && c.kind === "expense");
    const targetCat = foodCat?.id || flatCategories.filter(c => c.kind === "expense")[0]?.id;

    if (!targetWallet) {
      toast.error("Silakan buat dompet di Langkah 1 terlebih dahulu.");
      setCurrentStep(1);
      return;
    }

    try {
      await createTx.mutateAsync({
        type: "expense",
        amount: 25000,
        occurred_at: new Date().toISOString(),
        wallet_id: targetWallet,
        category_id: targetCat || null,
        note: "Belanja makan siang pertama (Trial)",
      });

      // Confetti effect
      setTrialSuccess(true);
      const newParticles = Array.from({ length: 40 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 50 + 20,
        color: ["#B8E6D3", "#5FBF9A", "#E8A5A5", "#F4D2A6", "#C8A5E8"][Math.floor(Math.random() * 5)],
      }));
      setParticles(newParticles);

      toast.success("Transaksi pertamamu tersimpan!");
      setTimeout(() => {
        router.push("/dashboard");
      }, 2500);
    } catch (err) {
      toast.error("Gagal menyimpan transaksi trial.");
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10 bg-background text-foreground relative overflow-hidden">
      {/* Confetti particles */}
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute size-2 rounded-full animate-bounce z-50 pointer-events-none"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            backgroundColor: p.color,
            transform: `scale(${Math.random() * 1.5 + 0.5})`,
          }}
        />
      ))}

      <div className="w-full space-y-8">
        {/* Logo and Progress */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-mint text-lg font-bold text-foreground">
              S
            </span>
            <span className="text-xl font-semibold">Saku Kita</span>
          </div>

          <div className="flex justify-center items-center gap-4">
            <span
              className={`grid size-7 place-items-center rounded-full text-xs font-semibold border ${
                currentStep >= 1 ? "bg-mint text-foreground border-mint" : "text-muted-foreground"
              }`}
            >
              1
            </span>
            <span className="h-px w-8 bg-border" />
            <span
              className={`grid size-7 place-items-center rounded-full text-xs font-semibold border ${
                currentStep >= 2 ? "bg-mint text-foreground border-mint" : "text-muted-foreground border-border"
              }`}
            >
              2
            </span>
            <span className="h-px w-8 bg-border" />
            <span
              className={`grid size-7 place-items-center rounded-full text-xs font-semibold border ${
                currentStep >= 3 ? "bg-mint text-foreground border-mint" : "text-muted-foreground border-border"
              }`}
            >
              3
            </span>
          </div>
        </div>

        {/* STEP 1: CREATE WALLET */}
        {currentStep === 1 && (
          <div className="space-y-5 rounded-2xl border bg-card p-6">
            <div className="text-center space-y-1.5">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-mint-soft text-mint-strong">
                <Wallet className="size-6" />
              </div>
              <h1 className="text-lg font-semibold">Buat Dompet Pertama</h1>
              <p className="text-xs text-muted-foreground">
                Setiap transaksi keuangan butuh dompet sumber, misalnya Tunai, BCA, atau GoPay.
              </p>
            </div>

            <form onSubmit={handleWalletSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="walletName">Nama Dompet</Label>
                <Input
                  id="walletName"
                  placeholder="Contoh: Dompet Tunai, BCA Fahmi"
                  value={walletName}
                  onChange={(e) => setWalletName(e.target.value)}
                  className="h-11 rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="walletType">Tipe Dompet</Label>
                  <Select value={walletType} onValueChange={(val: WalletType) => setWalletType(val)}>
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Pilih tipe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Tunai (Cash)</SelectItem>
                      <SelectItem value="debit">Tabungan / Debit</SelectItem>
                      <SelectItem value="ewallet">Dompet Digital (E-Wallet)</SelectItem>
                      <SelectItem value="credit">Kartu Kredit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="balance">Saldo Awal (Rp)</Label>
                  <Input
                    id="balance"
                    type="number"
                    placeholder="0"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button type="submit" disabled={createWallet.isPending} className="h-11 rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90 font-semibold w-full">
                  {createWallet.isPending ? "Membuat..." : "Buat & Lanjut"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCurrentStep(2)}
                  className="h-10 text-xs text-muted-foreground"
                >
                  Lewati Langkah Ini
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 2: INSTALL PWA */}
        {currentStep === 2 && (
          <div className="space-y-5 rounded-2xl border bg-card p-6 animate-in fade-in duration-200">
            <div className="text-center space-y-1.5">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-mint-soft text-mint-strong">
                <Smartphone className="size-6" />
              </div>
              <h1 className="text-lg font-semibold">Pasang Aplikasi Saku</h1>
              <p className="text-xs text-muted-foreground">
                Saku Kita bekerja maksimal bila ditambahkan ke Home Screen layaknya aplikasi biasa.
              </p>
            </div>

            {isIOS ? (
              <div className="rounded-xl bg-muted p-4 space-y-2">
                <p className="text-xs font-semibold text-foreground">Instruksi Khusus iOS / Safari:</p>
                <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
                  <li>Tap tombol bagikan <span className="font-semibold text-foreground">Bagikan (Share)</span> di bagian bawah browser Safari.</li>
                  <li>Scroll ke bawah dan tap opsi <span className="font-semibold text-foreground">Add to Home Screen</span>.</li>
                  <li>Tap <span className="font-semibold text-foreground">Add</span> di sudut kanan atas.</li>
                </ol>
              </div>
            ) : (
              <div className="rounded-xl bg-muted p-4 text-center space-y-1">
                <p className="text-xs font-semibold text-foreground">Dukungan PWA Siap</p>
                <p className="text-[11px] text-muted-foreground">
                  Gunakan tombol di bawah ini atau tekan menu titik tiga browser dan pilih &quot;Instal aplikasi&quot;.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              {!isIOS && deferredPrompt ? (
                <Button onClick={handleInstallClick} className="h-11 rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90 font-semibold w-full">
                  Instal Aplikasi Saku
                </Button>
              ) : null}
              <Button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="h-11 rounded-xl font-semibold w-full gap-1.5"
                variant={isIOS || !deferredPrompt ? "default" : "outline"}
              >
                Sudah Terpasang / Lanjutkan
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: RECORD FIRST TRANSACTION */}
        {currentStep === 3 && (
          <div className="space-y-5 rounded-2xl border bg-card p-6 animate-in fade-in duration-200 relative">
            <div className="text-center space-y-1.5">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-mint-soft text-mint-strong">
                <Sparkles className="size-6" />
              </div>
              <h1 className="text-lg font-semibold">Coba Catat Transaksi Pertamamu</h1>
              <p className="text-xs text-muted-foreground">
                Mari lakukan simulasi cepat untuk merasakan mudahnya mencatat di Saku Kita!
              </p>
            </div>

            {trialSuccess ? (
              <div className="flex flex-col items-center gap-3 text-center py-6 animate-in zoom-in-95 duration-200">
                <CheckCircle2 className="size-12 text-mint-strong" />
                <div>
                  <p className="font-semibold">Sukses Menyimpan!</p>
                  <p className="text-xs text-muted-foreground">Mengarahkanmu ke dashboard utama...</p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border bg-muted p-4 space-y-3.5">
                <div className="space-y-0.5 text-center">
                  <span className="text-xs text-muted-foreground">Simulasi Pengeluaran</span>
                  <p className="text-xl font-bold text-expense">{formatCurrency(25000)}</p>
                </div>

                <div className="grid grid-cols-2 text-xs border-t pt-3 gap-2">
                  <div>
                    <span className="text-muted-foreground block">Kategori</span>
                    <span className="font-medium">🍔 Makanan</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Sumber Dana</span>
                    <span className="font-medium">{wallets[0]?.name || "Cash"}</span>
                  </div>
                </div>

                <Button
                  onClick={handleTrialTransaction}
                  disabled={createTx.isPending}
                  className="h-11 rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90 font-semibold w-full gap-2"
                >
                  <Check className="size-4" />
                  Simpan Transaksi Pertama
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
