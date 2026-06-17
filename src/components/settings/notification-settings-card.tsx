"use client";

import * as React from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNotificationPrefs } from "@/stores/notification-store";
import {
  notificationSupported,
  currentPermission,
  requestNotificationPermission,
  showLocalNotification,
  type NotificationPermissionState,
} from "@/lib/notifications";
import { formatCurrency } from "@/lib/format";

export function NotificationSettingsCard() {
  const {
    budgetAlerts,
    largeTxAlerts,
    largeTxThreshold,
    setBudgetAlerts,
    setLargeTxAlerts,
    setLargeTxThreshold,
  } = useNotificationPrefs();

  const [perm, setPerm] = React.useState<NotificationPermissionState>("default");
  const [thresholdInput, setThresholdInput] = React.useState(String(largeTxThreshold));

  // Read the live browser permission after mount (deferred to avoid a
  // synchronous setState-in-effect and any SSR/permission hydration mismatch).
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setPerm(currentPermission()));
    return () => cancelAnimationFrame(id);
  }, []);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setThresholdInput(String(largeTxThreshold)));
    return () => cancelAnimationFrame(id);
  }, [largeTxThreshold]);

  const granted = perm === "granted";
  const unsupported = perm === "unsupported" || !notificationSupported();

  const handleEnable = async () => {
    const result = await requestNotificationPermission();
    setPerm(result);
    if (result === "granted") {
      toast.success("Notifikasi diaktifkan");
      void showLocalNotification("Notifikasi aktif ✓", {
        body: "Saku Kita akan mengingatkan budget & transaksi besar.",
      });
    } else if (result === "denied") {
      toast.error("Izin notifikasi ditolak. Aktifkan lewat pengaturan browser.");
    }
  };

  const commitThreshold = () => {
    const parsed = Math.max(0, Math.round(Number(thresholdInput.replace(/[^\d]/g, "")) || 0));
    setLargeTxThreshold(parsed);
    setThresholdInput(String(parsed));
  };

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
            {granted ? (
              <BellRing className="size-5 text-mint-strong" />
            ) : unsupported ? (
              <BellOff className="size-5" />
            ) : (
              <Bell className="size-5" />
            )}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-sm">Notifikasi</p>
            <p className="text-xs text-muted-foreground">
              {unsupported
                ? "Tidak didukung di perangkat ini"
                : granted
                ? "Aktif di perangkat ini"
                : "Ingatkan budget & transaksi besar"}
            </p>
          </div>
        </div>
        {!unsupported && !granted && (
          <Button
            size="sm"
            onClick={handleEnable}
            className="rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90 shrink-0"
          >
            Aktifkan
          </Button>
        )}
      </div>

      {granted && (
        <div className="space-y-3 border-t pt-3">
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-sm">Peringatan budget (80% &amp; 100%)</span>
            <Switch checked={budgetAlerts} onCheckedChange={setBudgetAlerts} />
          </label>
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-sm">Peringatan transaksi besar</span>
            <Switch checked={largeTxAlerts} onCheckedChange={setLargeTxAlerts} />
          </label>
          {largeTxAlerts && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bigtx-threshold" className="text-xs text-muted-foreground">
                Ambang transaksi besar — saat ini {formatCurrency(largeTxThreshold)}
              </Label>
              <Input
                id="bigtx-threshold"
                inputMode="numeric"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                onBlur={commitThreshold}
                className="h-11 rounded-xl"
              />
            </div>
          )}
        </div>
      )}

      {perm === "denied" && !unsupported && (
        <p className="text-xs text-muted-foreground border-t pt-3">
          Izin notifikasi ditolak. Aktifkan kembali lewat pengaturan situs di browser, lalu muat
          ulang halaman.
        </p>
      )}
    </div>
  );
}
