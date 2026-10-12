"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useCreateWallet } from "@/hooks/use-wallets";
import { useUIStore } from "@/stores/ui-store";
import { markOnboarded } from "@/lib/onboarding";
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
import { Wallet, Smartphone, Sparkles, Check, ArrowRight } from "lucide-react";
import type { WalletType } from "@/lib/supabase/types";

/** Chromium's install-prompt event (not in the standard DOM typings). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = React.useState<1 | 2 | 3>(1);

  // Step 1: Wallet States
  const createWallet = useCreateWallet();
  const [walletName, setWalletName] = React.useState("");
  const [walletType, setWalletType] = React.useState<WalletType>("cash");
  const [initialBalance, setInitialBalance] = React.useState("");

  // Step 2: PWA States
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  // Only read on step 2, which never renders on the server, so the
  // client-only user agent can't cause a hydration mismatch.
  const [isIOS] = React.useState(
    () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent)
  );

  // Step 3
  const openQuickAdd = useUIStore((s) => s.openQuickAdd);

  // Listen for the PWA install prompt
  React.useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
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
    } catch {
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

  // Step 3: open the real quick-add form on the dashboard rather than saving
  // a demo row — a "trial" expense would land in the family's actual books.
  const finish = (recordFirst: boolean) => {
    markOnboarded();
    router.replace("/dashboard");
    if (recordFirst) openQuickAdd("expense");
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10 bg-background text-foreground relative overflow-hidden">
      <div className="w-full space-y-8">
        {/* Logo and Progress */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-mint text-lg font-bold text-foreground">
              S
            </span>
            <span className="text-xl font-semibold">Saku Kita</span>
          </div>
          <button
            type="button"
            onClick={() => finish(false)}
            className="absolute right-5 top-5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Lewati
          </button>

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
                Ketik nominal, pilih kategori, simpan — biasanya kurang dari 5 detik.
              </p>
            </div>

            <div className="space-y-2.5">
              <Button
                onClick={() => finish(true)}
                className="h-11 rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90 font-semibold w-full gap-2"
              >
                <Check className="size-4" />
                Catat Transaksi Pertama
              </Button>
              <Button
                variant="ghost"
                onClick={() => finish(false)}
                className="h-10 w-full rounded-xl text-xs text-muted-foreground"
              >
                Nanti saja, langsung ke Beranda
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
