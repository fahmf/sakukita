const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const syncFilePath = path.join(__dirname, '../src/lib/db/sync.ts');

try {
  // 1. Reset sync.ts to origin
  execSync('git checkout src/lib/db/sync.ts', { cwd: path.join(__dirname, '..') });
  console.log('Restored sync.ts to original state.');
  
  let content = fs.readFileSync(syncFilePath, 'utf8');
  // Normalize line endings to LF (\n) to prevent carriage return issues in replace matching
  content = content.replace(/\r\n/g, '\n');
  
  // 2. Add imports
  content = content.replace(
    `import { db } from "./dexie";\nimport type { SupabaseClient } from "@supabase/supabase-js";`,
    `import { db } from "./dexie";\nimport type { SupabaseClient } from "@supabase/supabase-js";\nimport { useSyncStore } from "@/stores/sync-store";`
  );
  
  // 3. Destructuring linter warning fix (use delete instead of unused const syncStatus)
  content = content.replaceAll(
    'const { syncStatus, ...payload } = entry.payload;',
    'const payload = { ...entry.payload }; delete (payload as any).syncStatus;'
  );
  
  // 4. Wallet soft-delete instead of hard-delete in Dexie outbox delete operation
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
  
  // 5. Category soft-delete instead of hard-delete in Dexie outbox delete operation
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
  
  // 6. Fix strict 'any' types in catch block
  content = content.replace(
    'const pgError = err as any;',
    'const pgError = err as { code?: string; message?: string };'
  );
  content = content.replace(
    'const table = (db as any)[entry.entity];',
    'const table = (db as unknown as Record<string, { update: (id: string, obj: { syncStatus: "synced" }) => Promise<unknown> }>)[entry.entity];'
  );
  
  // 7. Inject scheduled local materialization and Zustand sync store updates into triggerSync / pullLatest
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
    `export async function triggerSync(supabase: SupabaseClient, householdId: string) {\n  if (typeof window !== "undefined" && !navigator.onLine) return;\n  await flushOutbox(supabase);\n  await pullLatest(supabase, householdId);\n}`,
    scheduledAndTriggerBlock
  );
  
  content = content.replace(
    `  } catch (error) {\n    console.error("Failed to pull latest from remote:", error);\n  }\n}`,
    `  } catch (error) {\n    console.error("Failed to pull latest from remote:", error);\n    useSyncStore.getState().setStatus("error", error instanceof Error ? error.message : String(error));\n    throw error;\n  }\n}`
  );
  
  // Restore CRLF line endings for Windows environment
  content = content.replace(/\n/g, '\r\n');
  
  fs.writeFileSync(syncFilePath, content, 'utf8');
  console.log('Successfully completed full bulletproof patch for sync.ts!');
} catch (e) {
  console.error('Failed to apply sync patch:', e);
}
