"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, Check, Plus, Loader2 } from "lucide-react";
import { useHousehold } from "@/components/providers/household-provider";
import {
  useMyHouseholds,
  useSwitchHousehold,
  useCreateHousehold,
} from "@/hooks/use-households";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function HouseholdSwitcher() {
  const { householdId, householdName } = useHousehold();
  const { data: memberships = [], isLoading } = useMyHouseholds();
  const switchHousehold = useSwitchHousehold();
  const createHousehold = useCreateHousehold();

  const [open, setOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const handleSwitch = async (id: string) => {
    if (id === householdId) {
      setOpen(false);
      return;
    }
    try {
      await switchHousehold.mutateAsync(id);
      setOpen(false);
    } catch {
      toast.error("Gagal mengganti household");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const newHousehold = await createHousehold.mutateAsync({ name: name.trim() });
      toast.success("Household dibuat");
      setCreateOpen(false);
      setName("");
      await switchHousehold.mutateAsync(newHousehold.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal membuat household";
      toast.error(message);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-w-0 items-center gap-1 rounded-lg px-1 py-1 hover:bg-muted transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Ganti household"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-mint text-sm font-bold text-foreground">
          S
        </span>
        <span className="truncate text-sm font-semibold">{householdName}</span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-40 mt-1 w-64 rounded-2xl border bg-card p-1 shadow-lg"
        >
          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                Household saya
              </div>
              {memberships.map((m) => {
                const isActive = m.household_id === householdId;
                return (
                  <button
                    key={m.household_id}
                    type="button"
                    onClick={() => handleSwitch(m.household_id)}
                    className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm hover:bg-muted transition-colors"
                    role="menuitem"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{m.household.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {m.role}
                      </p>
                    </div>
                    {isActive && <Check className="size-4 text-mint-strong" aria-hidden />}
                  </button>
                );
              })}
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setCreateOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm hover:bg-muted transition-colors"
                role="menuitem"
              >
                <Plus className="size-4" aria-hidden />
                Buat household baru
              </button>
              <Link
                href="/settings/household"
                onClick={() => setOpen(false)}
                className="flex w-full items-center rounded-xl px-2 py-2 text-left text-sm hover:bg-muted transition-colors"
                role="menuitem"
              >
                Kelola anggota & undangan
              </Link>
            </>
          )}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Buat household baru</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hhName">Nama</Label>
              <Input
                id="hhName"
                placeholder="Contoh: Keluarga Budi"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 rounded-xl"
                required
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="submit"
                className="h-11 w-full rounded-xl bg-mint-strong font-semibold text-white hover:bg-mint-strong/90"
                disabled={createHousehold.isPending || switchHousehold.isPending}
              >
                {createHousehold.isPending ? "Membuat..." : "Buat & beralih"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
