import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion, Home } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-6 text-center bg-background">
      <div className="space-y-6 max-w-md w-full animate-in fade-in slide-in-from-bottom-8 duration-500">
        <div className="relative mx-auto w-24 h-24 flex items-center justify-center rounded-3xl bg-mint-soft text-mint-strong border border-mint/20 shadow-xs">
          <FileQuestion className="size-12" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mint-strong opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-mint-strong"></span>
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            404
          </h1>
          <h2 className="text-lg font-bold text-foreground">
            Halaman Tidak Ditemukan
          </h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Aduh! Halaman yang kamu cari tidak dapat ditemukan atau telah dipindahkan. Yuk, kembali ke jalan yang benar!
          </p>
        </div>

        <div className="flex flex-col gap-2.5 pt-4">
          <Button asChild className="h-11 rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90 w-full transition-all shadow-sm">
            <Link href="/dashboard" className="flex items-center justify-center gap-2 font-medium">
              <Home className="size-4" />
              Kembali ke Dashboard
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 rounded-xl w-full transition-all">
            <Link href="/" className="flex items-center justify-center gap-2">
              Kembali ke Beranda
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
