"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-red-100 dark:bg-red-900/30">
        <AlertTriangle className="size-7 text-red-500" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-bold text-foreground">Terjadi Kesalahan</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Halaman mengalami masalah. Coba muat ulang atau kembali ke beranda.
        </p>
      </div>
      {error.digest && (
        <p className="text-[10px] text-muted-foreground/50 font-mono">
          Kode: {error.digest}
        </p>
      )}
      <div className="flex gap-3">
        <Button
          onClick={reset}
          variant="outline"
          className="gap-2 rounded-xl"
        >
          <RotateCcw className="size-4" />
          Coba Lagi
        </Button>
        <Button
          onClick={() => window.location.href = "/dashboard"}
          className="gap-2 rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90"
        >
          Ke Beranda
        </Button>
      </div>
    </div>
  );
}
