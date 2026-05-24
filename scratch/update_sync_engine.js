const fs = require('fs');
const path = require('path');

const syncFilePath = path.join(__dirname, '../src/lib/db/sync.ts');
let content = fs.readFileSync(syncFilePath, 'utf8');

// 1. Add import for useSyncStore at the top
content = content.replace(
  `import { db } from "./dexie";
import type { SupabaseClient } from "@supabase/supabase-js";`,
  `import { db } from "./dexie";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useSyncStore } from "@/stores/sync-store";`
);

// 2. Replace all 'const { syncStatus, ...payload }' with 'const { syncStatus: _, ...payload }' to fix TS unused warnings
content = content.replaceAll(
  'const { syncStatus, ...payload }',
  'const { syncStatus: _, ...payload }'
);

// 3. Fix wallet soft-delete in flushOutbox
content = content.replace(
  `        } else if (entry.op === "delete") {
          const { error } = await supabase
            .from("wallets")
            .update({ is_archived: true })
            .eq("id", entry.entityId);
          if (error) throw error;
          await db.wallets.delete(entry.entityId);
          await db.outbox.delete(entry.seq!);
        }`,
  `        } else if (entry.op === "delete") {
          const { error } = await supabase
            .from("wallets")
            .update({ is_archived: true })
            .eq("id", entry.entityId);
          if (error) throw error;
          await db.wallets.update(entry.entityId, { is_archived: true, syncStatus: "synced" });
          await db.outbox.delete(entry.seq!);
        }`
);

// 4. Fix category soft-delete in flushOutbox
content = content.replace(
  `        } else if (entry.op === "delete") {
          const { error } = await supabase
            .from("categories")
            .update({ is_archived: true })
            .eq("id", entry.entityId);
          if (error) throw error;
          await db.categories.delete(entry.entityId);
          await db.outbox.delete(entry.seq!);
        }`,
  `        } else if (entry.op === "delete") {
          const { error } = await supabase
            .from("categories")
            .update({ is_archived: true })
            .eq("id", entry.entityId);
          if (error) throw error;
          await db.categories.update(entry.entityId, { is_archived: true, syncStatus: "synced" });
          await db.outbox.delete(entry.seq!);
        }`
);

// 5. Add materializePassedScheduledTransactions function and update triggerSync and pullLatest
const scheduledAndTriggerBlock = `export async function materializePassedScheduledTransactions() {
  try {
    const nowStr = new Date().toISOString();
    const allTxs = await db.transactions.toArray();
    const filterPassed = allTxs.filter(t => t.is_scheduled && t.occurred_at <= nowStr && !t.is_deleted);
    
    for (const tx of filterPassed) {
      console.log("Materializing scheduled transaction locally:", tx.id);
      const updated = { ...tx, is_scheduled: false, updated_at: new Date().toISOString() };
      await db.transactions.put({ ...updated, syncStatus: "pending" });
      await db.outbox.add({
        entity: "transactions",
        entityId: tx.id,
        op: "update",
        payload: updated,
        createdAt: Date.now(),
      });
    }
  } catch (err) {
    console.error("Failed to materialize scheduled transactions locally:", err);
  }
}

export async function triggerSync(supabase: SupabaseClient, householdId: string) {
  if (typeof window !== "undefined" && !navigator.onLine) {
    useSyncStore.getState().setStatus("offline");
    return;
  }
  useSyncStore.getState().setStatus("syncing");
  try {
    await flushOutbox(supabase);
    await pullLatest(supabase, householdId);
    await materializePassedScheduledTransactions();
    useSyncStore.getState().setLastSynced(new Date().toISOString());
  } catch (err) {
    console.error("Sync failed:", err);
    useSyncStore.getState().setStatus("error", err instanceof Error ? err.message : String(err));
  }
}`;

content = content.replace(
  `export async function triggerSync(supabase: SupabaseClient, householdId: string) {
  if (typeof window !== "undefined" && !navigator.onLine) return;
  await flushOutbox(supabase);
  await pullLatest(supabase, householdId);
}`,
  scheduledAndTriggerBlock
);

// 6. Update catch block in pullLatest to notify the sync store
content = content.replace(
  `  } catch (error) {
    console.error("Failed to pull latest from remote:", error);
  }
}`,
  `  } catch (error) {
    console.error("Failed to pull latest from remote:", error);
    useSyncStore.getState().setStatus("error", error instanceof Error ? error.message : String(error));
    throw error;
  }
}`
);

fs.writeFileSync(syncFilePath, content, 'utf8');
console.log('Successfully updated sync.ts!');
