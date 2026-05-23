import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Wallet, PieChart, Users, WifiOff } from "lucide-react";

const features = [
  { icon: Wallet, title: "Catat <5 detik", desc: "Buka app, ketik nominal, simpan." },
  { icon: Users, title: "Bareng keluarga", desc: "Sinkron real-time ke HP pasangan." },
  { icon: PieChart, title: "Laporan jelas", desc: "Lihat ke mana uang pergi tiap bulan." },
  { icon: WifiOff, title: "Jalan offline", desc: "Tetap bisa catat tanpa internet." },
];

export default function LandingPage() {
  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-mint text-base font-bold text-foreground">
            S
          </span>
          <span className="font-semibold">Saku Kita</span>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">Masuk</Link>
        </Button>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <h1 className="max-w-md text-3xl font-semibold leading-tight sm:text-4xl">
          Pencatat keuangan keluarga, simpel banget
        </h1>
        <p className="mt-3 max-w-sm text-muted-foreground">
          Saku Kita bantu kamu dan keluarga mencatat pemasukan, pengeluaran, dan
          budget — cepat, rapi, dan bisa diakses bersama.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-12 px-7">
            <Link href="/login">Mulai Gratis</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 px-7">
            <Link href="/login">Masuk</Link>
          </Button>
        </div>

        <div className="mt-14 grid w-full max-w-md grid-cols-2 gap-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="flex flex-col gap-1.5 rounded-xl border bg-card p-4 text-left"
            >
              <f.icon className="size-5 text-mint-strong" />
              <p className="text-sm font-medium">{f.title}</p>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="px-6 py-6 text-center text-xs text-muted-foreground">
        Gratis selamanya · Untuk keluarga · Data privat
      </footer>
    </main>
  );
}
