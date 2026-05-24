"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary caught:", error);
  }, [error]);

  return (
    <html lang="id">
      <body className="min-h-dvh flex flex-col items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4 px-6 text-center max-w-sm">
          <div className="grid size-16 place-items-center rounded-2xl bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="size-8 text-red-500" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold">Kesalahan Fatal</h2>
            <p className="text-sm text-muted-foreground">
              Aplikasi mengalami masalah serius. Silakan muat ulang halaman.
            </p>
          </div>
          {error.digest && (
            <p className="text-[10px] text-muted-foreground/50 font-mono">
              Kode: {error.digest}
            </p>
          )}
          <Button
            onClick={reset}
            className="gap-2 rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90"
          >
            <RotateCcw className="size-4" />
            Muat Ulang
          </Button>
        </div>
      </body>
    </html>
  );
}
