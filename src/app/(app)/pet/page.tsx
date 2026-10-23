"use client";

import * as React from "react";
import { Check, Flame, Lock, Pencil, Sparkles, Trophy, CalendarCheck } from "lucide-react";
import { PageHeading } from "@/components/shared/empty-state";
import { PetAvatar } from "@/components/pet/pet-avatar";
import { wornAccessory } from "@/components/pet/pet-card";
import { usePet } from "@/hooks/use-pet";
import { usePetPrefs } from "@/hooks/use-pet-prefs";
import { MOOD_TEXT, PET_REWARDS, STAGE_LABEL } from "@/lib/pet";
import { useUIStore } from "@/stores/ui-store";
import { useCanEdit } from "@/components/shared/edit-guard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEEKDAY = new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: "UTC" });

export default function PetPage() {
  const { data: pet, isLoading } = usePet();
  const [prefs, setPrefs] = usePetPrefs();
  const openQuickAdd = useUIStore((s) => s.openQuickAdd);
  const allowed = useCanEdit();
  const [editingName, setEditingName] = React.useState(false);
  const [draftName, setDraftName] = React.useState("");

  if (isLoading || !pet) {
    return (
      <div className="space-y-4">
        <PageHeading back="/dashboard" title="Peliharaan" />
        <div className="h-64 animate-pulse rounded-3xl bg-muted" />
      </div>
    );
  }

  const mood = MOOD_TEXT[pet.mood];
  const worn = wornAccessory(pet, prefs.accessory);

  const saveName = () => {
    const name = draftName.trim().slice(0, 20);
    if (name) setPrefs({ name });
    setEditingName(false);
  };

  return (
    <div className="space-y-5">
      <PageHeading back="/dashboard" title="Peliharaan Keluarga" subtitle="Rutin mencatat, Saku tumbuh" />

      {/* Hero */}
      <section className="rounded-3xl border bg-gradient-to-br from-amber-50 via-rose-50 to-violet-100 p-5 text-center dark:from-amber-950/40 dark:via-rose-950/30 dark:to-violet-950/50">
        <PetAvatar mood={pet.mood} stage={pet.stage} accessory={worn} className="mx-auto size-44" />

        <div className="mt-2 flex items-center justify-center gap-2">
          {editingName ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                saveName();
              }}
            >
              <Input
                autoFocus
                value={draftName}
                maxLength={20}
                onChange={(e) => setDraftName(e.target.value)}
                aria-label="Nama peliharaan"
                className="h-10 w-40 rounded-xl bg-background text-center"
              />
              <Button type="submit" size="sm" className="h-10 rounded-xl bg-mint-strong text-on-mint hover:bg-mint-strong/90">
                Simpan
              </Button>
            </form>
          ) : (
            <>
              <h2 className="text-2xl font-extrabold tracking-tight">{prefs.name}</h2>
              <button
                type="button"
                onClick={() => {
                  setDraftName(prefs.name);
                  setEditingName(true);
                }}
                className="relative hit-area-44 grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-white/60 hover:text-foreground dark:hover:bg-white/10"
                aria-label="Ganti nama peliharaan"
              >
                <Pencil className="size-4" />
              </button>
            </>
          )}
        </div>
        <p className="text-sm font-semibold text-foreground">
          {STAGE_LABEL[pet.stage]} · {mood.title}
        </p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">{mood.hint}</p>

        {!pet.fedToday && allowed && (
          <Button
            onClick={() => openQuickAdd("expense")}
            className="mt-4 h-11 rounded-xl bg-mint-strong px-5 font-semibold text-on-mint hover:bg-mint-strong/90"
          >
            🍙 Beri makan — catat transaksi
          </Button>
        )}
        {pet.fedToday && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-mint-soft px-3 py-1 text-xs font-semibold text-mint-strong">
            <Check className="size-3.5" aria-hidden /> {pet.todayCount} catatan hari ini
          </p>
        )}
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3">
        <StatTile
          icon={<Flame className="size-4" />}
          tone="bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300"
          label="Streak"
          value={`${pet.streak} hari`}
        />
        <StatTile
          icon={<Trophy className="size-4" />}
          tone="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
          label="Rekor"
          value={`${pet.bestStreak} hari`}
        />
        <StatTile
          icon={<CalendarCheck className="size-4" />}
          tone="bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300"
          label="Total hari mencatat"
          value={`${pet.totalDays} hari`}
        />
        <div className="rounded-2xl border bg-card p-3.5">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
              <Sparkles className="size-4" />
            </span>
            <span className="text-xs font-medium text-muted-foreground">Level</span>
          </div>
          <p className="mt-2 text-lg font-bold">Lv {pet.level}</p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-violet-500"
              style={{ width: `${(pet.levelXp / pet.levelSize) * 100}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {pet.levelXp}/{pet.levelSize} XP
          </p>
        </div>
      </section>

      {/* Last 7 days */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">7 Hari Terakhir</h2>
        <div className="grid grid-cols-7 gap-1.5 rounded-2xl border bg-card p-3">
          {pet.week.map((d, i) => {
            const [y, m, day] = d.key.split("-").map(Number);
            const isToday = i === pet.week.length - 1;
            return (
              <div key={d.key} className="flex flex-col items-center gap-1.5">
                <span className={cn("text-xs", isToday ? "font-bold text-mint-strong" : "font-medium text-muted-foreground")}>
                  {WEEKDAY.format(new Date(Date.UTC(y, m - 1, day)))}
                </span>
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-full text-sm",
                    d.fed
                      ? "bg-mint-strong text-on-mint"
                      : isToday
                      ? "border-2 border-dashed border-mint-strong/50"
                      : "bg-muted text-muted-foreground"
                  )}
                  aria-label={`${d.key}: ${d.fed ? "diberi makan" : "tidak mencatat"}`}
                >
                  {d.fed ? "🍙" : ""}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Rewards */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hadiah Aksesori</h2>
        <div className="grid grid-cols-2 gap-3">
          {PET_REWARDS.map((r) => {
            const unlocked = pet.unlocked.includes(r.id);
            const current = r.metric === "bestStreak" ? pet.bestStreak : pet.totalDays;
            const isWorn = worn === r.id;
            return (
              <div
                key={r.id}
                className={cn(
                  "flex flex-col gap-2 rounded-2xl border p-3.5",
                  unlocked
                    ? "bg-gradient-to-br from-amber-50 to-rose-50 dark:from-amber-950/30 dark:to-rose-950/30"
                    : "bg-card"
                )}
              >
                <div className="flex items-start justify-between">
                  <span className={cn("text-3xl leading-none", !unlocked && "opacity-40 grayscale")}>{r.emoji}</span>
                  {!unlocked && <Lock className="size-4 text-muted-foreground" aria-label="Terkunci" />}
                </div>
                <div>
                  <p className="text-sm font-semibold">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.requirement}</p>
                </div>
                {unlocked ? (
                  <Button
                    size="sm"
                    variant={isWorn ? "default" : "outline"}
                    onClick={() => setPrefs({ accessory: isWorn ? null : r.id })}
                    className={cn(
                      "h-9 rounded-xl text-xs font-semibold",
                      isWorn && "bg-mint-strong text-on-mint hover:bg-mint-strong/90"
                    )}
                    aria-pressed={isWorn}
                  >
                    {isWorn ? "Dipakai ✓" : "Pakai"}
                  </Button>
                ) : (
                  <div className="space-y-1">
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-amber-500"
                        style={{ width: `${Math.min(100, (current / r.target) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {Math.min(current, r.target)}/{r.target}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="space-y-2 rounded-2xl border bg-card p-4 text-sm">
        <h2 className="font-semibold">Cara kerjanya</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Setiap hari ada anggota keluarga yang mencatat transaksi, {prefs.name} kenyang.</li>
          <li>Hari berturut-turut membentuk streak. Lewat sehari tanpa mencatat, streak mulai dari awal.</li>
          <li>Tiap hari mencatat memberi 10 XP, ditambah 2 XP per transaksi (maks. 5 transaksi per hari).</li>
          <li>Hadiah yang sudah didapat tidak hilang walau streak terputus.</li>
          <li>Transaksi berulang yang dibuat otomatis tidak dihitung.</li>
        </ul>
      </section>
    </div>
  );
}

function StatTile({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-3.5">
      <div className="flex items-center gap-2">
        <span className={cn("grid size-8 place-items-center rounded-xl", tone)}>{icon}</span>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 text-lg font-bold">{value}</p>
    </div>
  );
}
