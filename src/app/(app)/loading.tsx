import { Loader2 } from "lucide-react";

export default function AppLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-md transition-all">
      <div className="space-y-4 text-center animate-in fade-in zoom-in duration-300">
        <div className="relative mx-auto size-16 flex items-center justify-center rounded-2xl bg-mint text-xl font-bold text-foreground shadow-sm">
          S
          <div className="absolute -inset-1 rounded-2xl border border-mint-strong/30 animate-pulse" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground tracking-wide">Saku Kita</p>
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin text-mint-strong" />
            <span>Memuat data keuangan...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
