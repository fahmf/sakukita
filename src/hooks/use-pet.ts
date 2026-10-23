import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db/dexie";
import { useHousehold } from "@/components/providers/household-provider";
import { computePetState, type PetState } from "@/lib/pet";

/**
 * The household pet, derived from the local transaction log. The query key
 * sits under ["transactions", householdId] so every transaction mutation —
 * which invalidates that prefix — refreshes the pet too.
 */
export function usePet() {
  const { householdId } = useHousehold();

  return useQuery<PetState>({
    queryKey: ["transactions", householdId, "pet"],
    enabled: !!householdId,
    queryFn: () => loadPetState(householdId),
  });
}

/** Read the pet straight from IndexedDB (for one-off checks outside React Query). */
export async function loadPetState(householdId: string | null | undefined): Promise<PetState> {
  const rows = householdId
    ? await db.transactions.where("household_id").equals(householdId).toArray()
    : [];
  return computePetState(rows);
}
