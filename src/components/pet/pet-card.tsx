"use client";

import Link from "next/link";
import { ChevronRight, Flame } from "lucide-react";
import { usePet } from "@/hooks/use-pet";
import { usePetPrefs } from "@/hooks/use-pet-prefs";
import { MOOD_TEXT, PET_REWARDS, type AccessoryId, type PetState } from "@/lib/pet";
import { PetAvatar } from "./pet-avatar";
import { useUIStore } from "@/stores/ui-store";
import { useCanEdit } from "@/components/shared/edit-guard";

/** The accessory actually worn: the explicit choice if still unlocked, else the best one earned. */
export function wornAccessory(state: PetState, choice: AccessoryId | null | undefined): AccessoryId | null {
  if (choice === null) return null;
  if (choice && state.unlocked.includes(choice)) return choice;
  const earned = PET_REWARDS.filter((r) => state.unlocked.includes(r.id));
  return earned.length ? earned[earned.length - 1].id : null;
}

/** Beranda widget: the pet's mood, streak and the next reward. */
export function PetCard() {
  const { data: pet } = usePet();
  const [prefs] = usePetPrefs();
  const openQuickAdd = useUIStore((s) => s.openQuickAdd);
  const allowed = useCanEdit();

  if (!pet) return null;

  const mood = MOOD_TEXT[pet.mood];
  const next = pet.nextReward;
  const nextPct = next ? Math.min(100, Math.round((next.current / next.reward.target) * 100)) : 100;

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-amber-50 via-rose-50 to-violet-100 p-4 dark:from-amber-950/40 dark:via-rose-950/30 dark:to-violet-950/50">
      <Link href="/pet" className="flex items-center gap-3" aria-label={`Buka halaman ${prefs.name}`}>
        <PetAvatar
          mood={pet.mood}
          stage={pet.stage}
          accessory={wornAccessory(pet, prefs.accessory)}
          className="size-20 shrink-0"
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold text-foreground">
              {prefs.name} {mood.title}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">{mood.hint}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700 dark:bg-orange-950/60 dark:text-orange-300">
              <Flame className="size-3.5" aria-hidden />
              {pet.streak} hari
            </span>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
              Lv {pet.level}
            </span>
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>

      {next && (
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-xs font-medium text-muted-foreground">
            <span>
              Hadiah berikutnya: {next.reward.emoji} {next.reward.name}
            </span>
            <span className="tabular-nums">
              {Math.min(next.current, next.reward.target)}/{next.reward.target}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/70 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 via-rose-400 to-violet-500 transition-all duration-500"
              style={{ width: `${nextPct}%` }}
            />
          </div>
        </div>
      )}

      {!pet.fedToday && allowed && (
        <button
          type="button"
          onClick={() => openQuickAdd("expense")}
          className="mt-3 h-10 w-full rounded-xl bg-mint-strong text-sm font-semibold text-on-mint transition-colors hover:bg-mint-strong/90"
        >
          🍙 Beri makan — catat transaksi
        </button>
      )}
    </div>
  );
}
