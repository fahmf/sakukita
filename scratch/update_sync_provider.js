const fs = require('fs');
const path = require('path');

const providerPath = path.join(__dirname, '../src/components/providers/sync-provider.tsx');
let content = fs.readFileSync(providerPath, 'utf8');

// 1. Clean imports - we only need triggerSync
content = content.replace(
  `import { triggerSync, flushOutbox, pullLatest } from "@/lib/db/sync";`,
  `import { triggerSync } from "@/lib/db/sync";
import type { Transaction, Wallet, Category, Budget } from "@/lib/supabase/types";`
);

// 2. Update handleOnline in useEffect
content = content.replace(
  `    const handleOnline = async () => {
      console.log("Network online, flushing pending outbox items...");
      await flushOutbox(supabase);
      await pullLatest(supabase, householdId);
      // Invalidate all react-query queries to fetch latest from local Dexie store
      queryClient.invalidateQueries();
    };`,
  `    const handleOnline = async () => {
      console.log("Network online, triggering full sync...");
      await triggerSync(supabase, householdId);
      // Invalidate all react-query queries to fetch latest from local Dexie store
      queryClient.invalidateQueries();
    };`
);

// 3. Fix strict 'any' types in Realtime subscriptions by casting to unknown first, then the correct type
content = content.replace(
  `          if (payload.eventType === "DELETE") {
            await db.transactions.delete((payload.old as any).id);
          } else {
            const newTx = payload.new as any;
            if (newTx.is_deleted) {
              await db.transactions.delete(newTx.id);
            } else {
              const local = await db.transactions.get(newTx.id);
              if (!local || local.syncStatus !== "pending") {
                await db.transactions.put({ ...newTx, syncStatus: "synced" });
              }
            }
          }`,
  `          if (payload.eventType === "DELETE") {
            const oldTx = payload.old as unknown as Transaction;
            if (oldTx?.id) await db.transactions.delete(oldTx.id);
          } else {
            const newTx = payload.new as unknown as Transaction;
            if (newTx?.is_deleted) {
              await db.transactions.delete(newTx.id);
            } else if (newTx) {
              const local = await db.transactions.get(newTx.id);
              if (!local || local.syncStatus !== "pending") {
                await db.transactions.put({ ...newTx, syncStatus: "synced" });
              }
            }
          }`
);

content = content.replace(
  `          if (payload.eventType === "DELETE" || (payload.new as any)?.is_archived) {
            await db.wallets.delete((payload.old as any)?.id || (payload.new as any)?.id);
          } else {
            const newWallet = payload.new as any;
            const local = await db.wallets.get(newWallet.id);
            if (!local || local.syncStatus !== "pending") {
              await db.wallets.put({ ...newWallet, syncStatus: "synced" });
            }
          }`,
  `          const oldW = payload.old as unknown as Wallet;
          const newW = payload.new as unknown as Wallet;
          if (payload.eventType === "DELETE" || newW?.is_archived) {
            const wId = oldW?.id || newW?.id;
            if (wId) {
              // Soft delete locally matching outbox behavior
              await db.wallets.update(wId, { is_archived: true, syncStatus: "synced" });
            }
          } else if (newW) {
            const local = await db.wallets.get(newW.id);
            if (!local || local.syncStatus !== "pending") {
              await db.wallets.put({ ...newW, syncStatus: "synced" });
            }
          }`
);

content = content.replace(
  `          if (payload.eventType === "DELETE" || (payload.new as any)?.is_archived) {
            await db.categories.delete((payload.old as any)?.id || (payload.new as any)?.id);
          } else {
            const newCategory = payload.new as any;
            const local = await db.categories.get(newCategory.id);
            if (!local || local.syncStatus !== "pending") {
              await db.categories.put({ ...newCategory, syncStatus: "synced" });
            }
          }`,
  `          const oldCat = payload.old as unknown as Category;
          const newCat = payload.new as unknown as Category;
          if (payload.eventType === "DELETE" || newCat?.is_archived) {
            const catId = oldCat?.id || newCat?.id;
            if (catId) {
              // Soft delete locally matching outbox behavior
              await db.categories.update(catId, { is_archived: true, syncStatus: "synced" });
            }
          } else if (newCat) {
            const local = await db.categories.get(newCat.id);
            if (!local || local.syncStatus !== "pending") {
              await db.categories.put({ ...newCat, syncStatus: "synced" });
            }
          }`
);

content = content.replace(
  `          if (payload.eventType === "DELETE") {
            await db.budgets.delete((payload.old as any)?.id);
          } else {
            const newBudget = payload.new as any;
            const local = await db.budgets.get(newBudget.id);
            if (!local || local.syncStatus !== "pending") {
              await db.budgets.put({ ...newBudget, syncStatus: "synced" });
            }
          }`,
  `          const oldB = payload.old as unknown as Budget;
          const newB = payload.new as unknown as Budget;
          if (payload.eventType === "DELETE") {
            if (oldB?.id) await db.budgets.delete(oldB.id);
          } else if (newB) {
            const local = await db.budgets.get(newB.id);
            if (!local || local.syncStatus !== "pending") {
              await db.budgets.put({ ...newB, syncStatus: "synced" });
            }
          }`
);

fs.writeFileSync(providerPath, content, 'utf8');
console.log('Successfully updated sync-provider.tsx!');
