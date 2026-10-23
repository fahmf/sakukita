import * as React from "react";
import { useHousehold } from "@/components/providers/household-provider";
import type { AccessoryId } from "@/lib/pet";

export interface PetPrefs {
  name: string;
  /** Equipped accessory; null = none. Undefined = auto (best unlocked). */
  accessory?: AccessoryId | null;
}

const DEFAULT_PREFS: PetPrefs = { name: "Saku" };

/**
 * Per-device cosmetic choices for the pet. Progress itself is derived from
 * the shared transaction log; only the name and the worn accessory live in
 * localStorage, and the pet works fine when storage is unavailable.
 */
export function usePetPrefs() {
  const { householdId } = useHousehold();
  const key = `saku-pet:${householdId}`;
  const [prefs, setPrefs] = React.useState<PetPrefs>(DEFAULT_PREFS);

  React.useEffect(() => {
    let stored: PetPrefs | null = null;
    try {
      const raw = localStorage.getItem(key);
      stored = raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : null;
    } catch {
      stored = null;
    }
    // Deferred so the first render matches the server (no hydration mismatch).
    const id = requestAnimationFrame(() => setPrefs(stored ?? DEFAULT_PREFS));
    return () => cancelAnimationFrame(id);
  }, [key]);

  const update = React.useCallback(
    (patch: Partial<PetPrefs>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...patch };
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // Storage blocked (private mode etc.) — keep it for this session only.
        }
        return next;
      });
    },
    [key]
  );

  return [prefs, update] as const;
}
