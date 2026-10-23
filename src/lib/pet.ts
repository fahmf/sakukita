import { jakartaDateKey, todayJakarta } from "@/lib/financial-month";

/**
 * Household pet ("Saku"). Everything is derived from the transaction log —
 * a day counts as "fed" when anyone in the household recorded at least one
 * transaction by hand that day (Jakarta calendar, by entry time). Nothing is
 * stored, so the pet is the same on every device and survives reinstalls.
 *
 * Rows the server materializes from recurring templates have no client_id;
 * they are not a person recording, so they don't feed the pet.
 */

export type PetMood = "kenyang" | "lapar" | "sedih" | "tidur";
export type PetStage = "bayi" | "kecil" | "remaja" | "dewasa";
export type AccessoryId = "syal" | "topi" | "kacamata" | "mahkota";

export interface PetReward {
  id: AccessoryId;
  name: string;
  emoji: string;
  /** What has to be reached, in human terms. */
  requirement: string;
  metric: "bestStreak" | "totalDays";
  target: number;
}

export const PET_REWARDS: PetReward[] = [
  { id: "syal", name: "Syal Hangat", emoji: "🧣", requirement: "Rutin 3 hari berturut-turut", metric: "bestStreak", target: 3 },
  { id: "topi", name: "Topi Pesta", emoji: "🥳", requirement: "Rutin 7 hari berturut-turut", metric: "bestStreak", target: 7 },
  { id: "kacamata", name: "Kacamata Keren", emoji: "😎", requirement: "Total 15 hari mencatat", metric: "totalDays", target: 15 },
  { id: "mahkota", name: "Mahkota Emas", emoji: "👑", requirement: "Rutin 30 hari berturut-turut", metric: "bestStreak", target: 30 },
];

export interface PetRecord {
  created_at: string;
  client_id: string | null;
  is_deleted: boolean;
}

export interface PetState {
  mood: PetMood;
  stage: PetStage;
  /** Consecutive fed days ending today, or yesterday if today isn't fed yet. */
  streak: number;
  bestStreak: number;
  totalDays: number;
  fedToday: boolean;
  todayCount: number;
  /** Days since the last fed day; null when never fed. */
  daysSinceFed: number | null;
  level: number;
  xp: number;
  /** XP gathered inside the current level and the size of a level. */
  levelXp: number;
  levelSize: number;
  /** Jakarta date keys of the last 7 days (oldest first) with fed flags. */
  week: { key: string; fed: boolean }[];
  unlocked: AccessoryId[];
  nextReward: { reward: PetReward; current: number } | null;
}

const XP_PER_DAY = 10;
const XP_PER_TX = 2;
const MAX_TX_XP_PER_DAY = 5; // so a burst of entries can't outrun steady habits
const LEVEL_SIZE = 100;

function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function keyToUtc(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((keyToUtc(toKey) - keyToUtc(fromKey)) / 86400000);
}

function stageFor(level: number): PetStage {
  if (level >= 10) return "dewasa";
  if (level >= 6) return "remaja";
  if (level >= 3) return "kecil";
  return "bayi";
}

export function computePetState(records: PetRecord[], today: string = todayJakarta()): PetState {
  const perDay = new Map<string, number>();
  for (const r of records) {
    if (r.is_deleted || !r.client_id) continue;
    const key = jakartaDateKey(r.created_at);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }
  const days = [...perDay.keys()].sort();

  const fedToday = perDay.has(today);
  const yesterday = shiftKey(today, -1);

  let streak = 0;
  let cursor = fedToday ? today : perDay.has(yesterday) ? yesterday : null;
  while (cursor && perDay.has(cursor)) {
    streak++;
    cursor = shiftKey(cursor, -1);
  }

  let bestStreak = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of days) {
    run = prev && daysBetween(prev, key) === 1 ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    prev = key;
  }

  const lastFed = days.length ? days[days.length - 1] : null;
  const daysSinceFed = lastFed ? Math.max(0, daysBetween(lastFed, today)) : null;

  const mood: PetMood =
    daysSinceFed === null || daysSinceFed > 3
      ? "tidur"
      : daysSinceFed === 0
      ? "kenyang"
      : daysSinceFed === 1
      ? "lapar"
      : "sedih";

  let xp = 0;
  for (const count of perDay.values()) {
    xp += XP_PER_DAY + Math.min(count, MAX_TX_XP_PER_DAY) * XP_PER_TX;
  }
  const level = Math.floor(xp / LEVEL_SIZE) + 1;

  const totalDays = days.length;
  const metricValue = (m: PetReward["metric"]) => (m === "bestStreak" ? bestStreak : totalDays);
  const unlocked = PET_REWARDS.filter((r) => metricValue(r.metric) >= r.target).map((r) => r.id);
  const pending = PET_REWARDS.filter((r) => !unlocked.includes(r.id)).sort(
    (a, b) => a.target - metricValue(a.metric) - (b.target - metricValue(b.metric))
  );
  // For a streak reward, progress is the current streak — that's what the
  // household has to keep going.
  const nextReward = pending.length
    ? {
        reward: pending[0],
        current: pending[0].metric === "bestStreak" ? streak : totalDays,
      }
    : null;

  const week = Array.from({ length: 7 }, (_, i) => {
    const key = shiftKey(today, i - 6);
    return { key, fed: perDay.has(key) };
  });

  return {
    mood,
    stage: stageFor(level),
    streak,
    bestStreak,
    totalDays,
    fedToday,
    todayCount: perDay.get(today) ?? 0,
    daysSinceFed,
    level,
    xp,
    levelXp: xp % LEVEL_SIZE,
    levelSize: LEVEL_SIZE,
    week,
    unlocked,
    nextReward,
  };
}

export const MOOD_TEXT: Record<PetMood, { title: string; hint: string }> = {
  kenyang: { title: "kenyang & senang!", hint: "Sudah diberi makan hari ini. Sampai jumpa besok!" },
  lapar: { title: "mulai lapar…", hint: "Catat 1 transaksi hari ini supaya streak tetap jalan." },
  sedih: { title: "sedih, lama tidak diberi makan", hint: "Catat transaksi untuk menghiburnya lagi." },
  tidur: { title: "sedang tidur", hint: "Bangunkan dengan mencatat transaksi pertamamu." },
};

export const STAGE_LABEL: Record<PetStage, string> = {
  bayi: "Bayi",
  kecil: "Kecil",
  remaja: "Remaja",
  dewasa: "Dewasa",
};
