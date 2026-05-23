"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/components/providers/household-provider";
import type { Category, CategoryKind } from "@/lib/supabase/types";
import { db } from "@/lib/db/dexie";
import { triggerSync } from "@/lib/db/sync";
import { safeRandomUUID } from "@/lib/utils";

export interface HierarchicalCategory extends Category {
  subcategories: Category[];
}

export async function generateDeterministicUUID(householdId: string, stableId: string): Promise<string> {
  const str = `${householdId}:${stableId}`;
  let hashBuffer: ArrayBuffer;
  
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    hashBuffer = await crypto.subtle.digest("SHA-256", data);
  } else {
    // Pure JS fallback: compute deterministic 16-byte array via FNV-1a hash functions
    const hashArray = new Uint8Array(16);
    const fnv32 = (val: string, seed = 0x811c9dc5) => {
      let h = seed;
      for (let i = 0; i < val.length; i++) {
        h ^= val.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
      }
      return h >>> 0;
    };
    
    const h1 = fnv32(str, 0x811c9dc5);
    const h2 = fnv32(str + "-salt1", 0x12345678);
    const h3 = fnv32(str + "-salt2", 0xabcdef01);
    const h4 = fnv32(str + "-salt3", 0xdeadbeef);
    
    hashArray[0] = (h1 >> 24) & 0xff;
    hashArray[1] = (h1 >> 16) & 0xff;
    hashArray[2] = (h1 >> 8) & 0xff;
    hashArray[3] = h1 & 0xff;
    
    hashArray[4] = (h2 >> 24) & 0xff;
    hashArray[5] = (h2 >> 16) & 0xff;
    hashArray[6] = (h2 >> 8) & 0xff;
    hashArray[7] = h2 & 0xff;
    
    hashArray[8] = (h3 >> 24) & 0xff;
    hashArray[9] = (h3 >> 16) & 0xff;
    hashArray[10] = (h3 >> 8) & 0xff;
    hashArray[11] = h3 & 0xff;
    
    hashArray[12] = (h4 >> 24) & 0xff;
    hashArray[13] = (h4 >> 16) & 0xff;
    hashArray[14] = (h4 >> 8) & 0xff;
    hashArray[15] = h4 & 0xff;
    
    hashBuffer = hashArray.buffer;
  }
  
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hexes = hashArray.slice(0, 16).map(b => b.toString(16).padStart(2, "0"));
  const part1 = hexes.slice(0, 4).join("");
  const part2 = hexes.slice(4, 6).join("");
  const part3 = "4" + hexes.slice(6, 8).join("").substring(1);
  const part4 = "8" + hexes.slice(8, 10).join("").substring(1);
  const part5 = hexes.slice(10, 16).join("");
  
  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

export async function seedStandardCategories(householdId: string) {
  const supabase: any = createClient();
  const now = new Date().toISOString();

  const standardCategories = [
    // --- EXPENSES ---
    {
      id: "00000000-0000-4000-8000-000000000001",
      name: "Makanan",
      kind: "expense" as const,
      icon: "🍔",
      color: "#E8A5A5",
      sort_order: 10,
      subcategories: [
        { id: "00000000-0000-4000-8000-000000000002", name: "Bahan Makanan", icon: "🛒" },
        { id: "00000000-0000-4000-8000-000000000003", name: "Makan Luar", icon: "🍕" },
        { id: "00000000-0000-4000-8000-000000000004", name: "Kopi & Cemilan", icon: "☕" },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000000000010",
      name: "Transportasi",
      kind: "expense" as const,
      icon: "🚗",
      color: "#B8E6D3",
      sort_order: 20,
      subcategories: [
        { id: "00000000-0000-4000-8000-000000000011", name: "Bahan Bakar", icon: "⛽" },
        { id: "00000000-0000-4000-8000-000000000012", name: "Ojek & Taksi Online", icon: "🛵" },
        { id: "00000000-0000-4000-8000-000000000013", name: "Parkir & Tol", icon: "🎫" },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000000000100",
      name: "Kebutuhan Rumah",
      kind: "expense" as const,
      icon: "🏠",
      color: "#F4D2A6",
      sort_order: 30,
      subcategories: [
        { id: "00000000-0000-4000-8000-000000000101", name: "Listrik & Air", icon: "🔌" },
        { id: "00000000-0000-4000-8000-000000000102", name: "Internet & Pulsa", icon: "📶" },
        { id: "00000000-0000-4000-8000-000000000103", name: "Perlengkapan Rumah", icon: "🧹" },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000000001000",
      name: "Hiburan & Hobi",
      kind: "expense" as const,
      icon: "🎮",
      color: "#C8A5E8",
      sort_order: 40,
      subcategories: [
        { id: "00000000-0000-4000-8000-000000001001", name: "Bioskop & Streaming", icon: "🍿" },
        { id: "00000000-0000-4000-8000-000000001002", name: "Liburan", icon: "✈️" },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000000010000",
      name: "Kesehatan",
      kind: "expense" as const,
      icon: "🏥",
      color: "#A5D8E8",
      sort_order: 50,
      subcategories: [
        { id: "00000000-0000-4000-8000-000000010001", name: "Obat & Vitamin", icon: "💊" },
        { id: "00000000-0000-4000-8000-000000010002", name: "Dokter & Lab", icon: "🩺" },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000000100000",
      name: "Belanja Pribadi",
      kind: "expense" as const,
      icon: "🛍️",
      color: "#E8A5C8",
      sort_order: 60,
      subcategories: [
        { id: "00000000-0000-4000-8000-000000100001", name: "Pakaian", icon: "👕" },
        { id: "00000000-0000-4000-8000-000000100002", name: "Perawatan Diri", icon: "🧴" },
      ],
    },

    // --- INCOME ---
    {
      id: "00000000-0000-4000-8000-000001000000",
      name: "Gaji & Pendapatan",
      kind: "income" as const,
      icon: "💰",
      color: "#5FBF9A",
      sort_order: 100,
      subcategories: [
        { id: "00000000-0000-4000-8000-000001000001", name: "Gaji Bulanan", icon: "💵" },
        { id: "00000000-0000-4000-8000-000001000002", name: "Bonus & THR", icon: "🎁" },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000010000000",
      name: "Investasi",
      kind: "income" as const,
      icon: "📈",
      color: "#A5E8B8",
      sort_order: 110,
      subcategories: [
        { id: "00000000-0000-4000-8000-000010000001", name: "Dividen & Bunga", icon: "🪙" },
        { id: "00000000-0000-4000-8000-000010000002", name: "Reksa Dana & Saham", icon: "📊" },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000020000000",
      name: "Pendapatan Lain",
      kind: "income" as const,
      icon: "✨",
      color: "#E8E5A5",
      sort_order: 120,
      subcategories: [
        { id: "00000000-0000-4000-8000-000020000001", name: "Refund", icon: "🔙" },
        { id: "00000000-0000-4000-8000-000020000002", name: "Pemberian", icon: "🧧" },
      ],
    },
  ];

  console.log("Seeding and deduplicating categories for household:", householdId);

  // 1. Write the standard stable categories locally first
  for (const parent of standardCategories) {
    const parentDetId = await generateDeterministicUUID(householdId, parent.id);
    const parentCategory: Category = {
      id: parentDetId,
      household_id: householdId,
      name: parent.name,
      kind: parent.kind,
      parent_id: null,
      icon: parent.icon,
      color: parent.color,
      sort_order: parent.sort_order,
      is_archived: false,
      created_at: now,
    };

    await db.categories.put({
      ...parentCategory,
      syncStatus: "pending",
    });

    await db.outbox.add({
      entity: "categories",
      entityId: parentDetId,
      op: "create",
      payload: parentCategory,
      createdAt: Date.now(),
    });

    if (parent.subcategories) {
      let childOrder = 0;
      for (const child of parent.subcategories) {
        const childDetId = await generateDeterministicUUID(householdId, child.id);
        const childCategory: Category = {
          id: childDetId,
          household_id: householdId,
          name: child.name,
          kind: parent.kind,
          parent_id: parentDetId,
          icon: child.icon,
          color: parent.color,
          sort_order: parent.sort_order + (++childOrder),
          is_archived: false,
          created_at: now,
        };

        await db.categories.put({
          ...childCategory,
          syncStatus: "pending",
        });

        await db.outbox.add({
          entity: "categories",
          entityId: childDetId,
          op: "create",
          payload: childCategory,
          createdAt: Date.now(),
        });
      }
    }
  }

  // 2. Fetch all local categories to detect duplicates and map aliases
  const currentLocalCategories = await db.categories
    .where("household_id")
    .equals(householdId)
    .toArray();

  const aliasToStableId = new Map<string, string>();

  // Add primary mappings for aliases
  aliasToStableId.set("makanan", "00000000-0000-4000-8000-000000000001");
  aliasToStableId.set("makanan & dapur", "00000000-0000-4000-8000-000000000001");
  aliasToStableId.set("makanan/minuman", "00000000-0000-4000-8000-000000000001");
  aliasToStableId.set("food", "00000000-0000-4000-8000-000000000001");
  aliasToStableId.set("kuliner", "00000000-0000-4000-8000-000000000001");

  aliasToStableId.set("transportasi", "00000000-0000-4000-8000-000000000010");
  aliasToStableId.set("kendaraan", "00000000-0000-4000-8000-000000000010");
  aliasToStableId.set("bensin", "00000000-0000-4000-8000-000000000010");
  aliasToStableId.set("transport", "00000000-0000-4000-8000-000000000010");

  aliasToStableId.set("kebutuhan rumah", "00000000-0000-4000-8000-000000000100");
  aliasToStableId.set("rumah", "00000000-0000-4000-8000-000000000100");
  aliasToStableId.set("tagihan", "00000000-0000-4000-8000-000000000100");
  aliasToStableId.set("utilities", "00000000-0000-4000-8000-000000000100");

  aliasToStableId.set("hiburan & hobi", "00000000-0000-4000-8000-000000001000");
  aliasToStableId.set("hiburan", "00000000-0000-4000-8000-000000001000");
  aliasToStableId.set("hobi", "00000000-0000-4000-8000-000000001000");
  aliasToStableId.set("entertainment", "00000000-0000-4000-8000-000000001000");

  aliasToStableId.set("kesehatan", "00000000-0000-4000-8000-000000010000");
  aliasToStableId.set("medis", "00000000-0000-4000-8000-000000010000");
  aliasToStableId.set("obat", "00000000-0000-4000-8000-000000010000");
  aliasToStableId.set("health", "00000000-0000-4000-8000-000000010000");

  aliasToStableId.set("belanja pribadi", "00000000-0000-4000-8000-000000100000");
  aliasToStableId.set("belanja", "00000000-0000-4000-8000-000000100000");
  aliasToStableId.set("pribadi", "00000000-0000-4000-8000-000000100000");
  aliasToStableId.set("shopping", "00000000-0000-4000-8000-000000100000");

  aliasToStableId.set("gaji & pendapatan", "00000000-0000-4000-8000-000001000000");
  aliasToStableId.set("gaji", "00000000-0000-4000-8000-000001000000");
  aliasToStableId.set("pendapatan", "00000000-0000-4000-8000-000001000000");
  aliasToStableId.set("salary", "00000000-0000-4000-8000-000001000000");

  aliasToStableId.set("investasi", "00000000-0000-4000-8000-000010000000");
  aliasToStableId.set("tabungan", "00000000-0000-4000-8000-000010000000");
  aliasToStableId.set("invest", "00000000-0000-4000-8000-000010000000");

  aliasToStableId.set("pendapatan lain", "00000000-0000-4000-8000-000020000000");
  aliasToStableId.set("lain-lain", "00000000-0000-4000-8000-000020000000");
  aliasToStableId.set("others", "00000000-0000-4000-8000-000020000000");

  // Also match subcategories
  for (const parent of standardCategories) {
    for (const child of parent.subcategories) {
      aliasToStableId.set(child.name.toLowerCase().trim(), child.id);
    }
  }

  // Pre-calculate deterministic stable IDs for household context mapping
  const householdStableIds = new Set<string>();
  const aliasToHouseholdStableId = new Map<string, string>();
  for (const [alias, stableId] of aliasToStableId.entries()) {
    const detId = await generateDeterministicUUID(householdId, stableId);
    aliasToHouseholdStableId.set(alias, detId);
    householdStableIds.add(detId);
  }

  // Find duplicate categories (non-stable IDs whose name/alias is a duplicate)
  const duplicates = currentLocalCategories.filter((c) => {
    const isStable = householdStableIds.has(c.id);
    if (isStable) return false;

    const nameKey = c.name.toLowerCase().trim();
    return aliasToHouseholdStableId.has(nameKey);
  });

  if (duplicates.length > 0) {
    console.log(`Found ${duplicates.length} duplicate categories to deduplicate & merge.`);

    for (const dup of duplicates) {
      const nameKey = dup.name.toLowerCase().trim();
      const stableId = aliasToHouseholdStableId.get(nameKey)!;

      console.log(`Merging duplicate category "${dup.name}" (${dup.id}) into stable category (${stableId})`);

      // A. Remap local transactions
      const localTxs = await db.transactions
        .where("category_id")
        .equals(dup.id)
        .toArray();

      for (const tx of localTxs) {
        await db.transactions.update(tx.id, { category_id: stableId, syncStatus: "pending" });
        await db.outbox.add({
          entity: "transactions",
          entityId: tx.id,
          op: "update",
          payload: { id: tx.id, category_id: stableId },
          createdAt: Date.now(),
        });
      }

      // B. Remap remote transactions on Supabase directly
      try {
        await supabase
          .from("transactions")
          .update({ category_id: stableId } as any)
          .eq("category_id", dup.id);
      } catch (err) {
        console.error("Failed to update remote transactions for duplicate category:", err);
      }

      // C. Remap budgets
      const localBudgets = await db.budgets
        .where("category_id")
        .equals(dup.id)
        .toArray();

      for (const b of localBudgets) {
        // Query to see if a budget already exists for the stable category in the same month
        const allBudgets = await db.budgets.where("household_id").equals(householdId).toArray();
        const existingStableBudget = allBudgets.find(
          (x) => x.category_id === stableId && x.period_month === b.period_month
        );

        if (existingStableBudget) {
          // Combine amounts to prevent duplicates
          const newAmount = Number(existingStableBudget.amount) + Number(b.amount);
          
          await db.budgets.update(existingStableBudget.id, { amount: newAmount, syncStatus: "pending" });
          await db.outbox.add({
            entity: "budgets",
            entityId: existingStableBudget.id,
            op: "create",
            payload: { ...existingStableBudget, amount: newAmount },
            createdAt: Date.now(),
          });

          await db.budgets.delete(b.id);
          try {
            await supabase
              .from("budgets")
              .delete()
              .eq("id", b.id);
          } catch (err) {
            console.error("Failed to delete remote budget for duplicate category:", err);
          }
        } else {
          // Simply update the category_id
          await db.budgets.update(b.id, { category_id: stableId, syncStatus: "pending" });
          await db.outbox.add({
            entity: "budgets",
            entityId: b.id,
            op: "create",
            payload: { ...b, category_id: stableId },
            createdAt: Date.now(),
          });
          try {
            await supabase
              .from("budgets")
              .update({ category_id: stableId } as any)
              .eq("id", b.id);
          } catch (err) {
            console.error("Failed to update remote budget for duplicate category:", err);
          }
        }
      }

      // D. Delete the duplicate category locally and remotely
      await db.categories.delete(dup.id);
      try {
        await supabase
          .from("categories")
          .delete()
          .eq("id", dup.id);
      } catch (err) {
        console.error("Failed to delete duplicate category from remote:", err);
      }

      // E. Clean up outbox entries referencing this duplicate category ID
      const pendingOutbox = await db.outbox
        .where("entity")
        .equals("categories")
        .toArray();
      for (const entry of pendingOutbox) {
        if (entry.entityId === dup.id) {
          await db.outbox.delete(entry.seq!);
        }
      }
    }
  }

  // 3. Self-healing deduplication by NAME (case-insensitive, same kind & parent_id)
  const freshLocalCategories = await db.categories
    .where("household_id")
    .equals(householdId)
    .toArray();

  const categoriesGrouped = new Map<string, any[]>();
  for (const cat of freshLocalCategories) {
    if (cat.is_archived) continue;
    const key = `${cat.kind}:${cat.parent_id || "root"}:${cat.name.toLowerCase().trim()}`;
    if (!categoriesGrouped.has(key)) {
      categoriesGrouped.set(key, []);
    }
    categoriesGrouped.get(key)!.push(cat);
  }

  for (const [key, list] of categoriesGrouped.entries()) {
    if (list.length > 1) {
      console.log(`Self-healing: Found duplicate categories for key "${key}":`, list.map(c => c.id));
      
      // Select the best category to keep:
      // Prefer the one with a deterministic stable ID if possible
      let stableCat = list.find(c => householdStableIds.has(c.id));
      if (!stableCat) {
        stableCat = list.find(c => c.syncStatus === "synced") || list[0];
      }

      const duplicatesToMerge = list.filter(c => c.id !== stableCat!.id);

      for (const dup of duplicatesToMerge) {
        console.log(`Self-healing: Merging duplicate category "${dup.name}" (${dup.id}) into stable category (${stableCat!.id})`);

        // A. Remap local transactions
        const localTxs = await db.transactions
          .where("category_id")
          .equals(dup.id)
          .toArray();

        for (const tx of localTxs) {
          await db.transactions.update(tx.id, { category_id: stableCat!.id, syncStatus: "pending" });
          await db.outbox.add({
            entity: "transactions",
            entityId: tx.id,
            op: "update",
            payload: { id: tx.id, category_id: stableCat!.id },
            createdAt: Date.now(),
          });
        }

        // B. Remap remote transactions on Supabase
        try {
          await supabase
            .from("transactions")
            .update({ category_id: stableCat!.id } as any)
            .eq("category_id", dup.id);
        } catch (err) {
          console.error("Self-healing: Failed to update remote transactions for duplicate:", err);
        }

        // C. Remap budgets
        const localBudgets = await db.budgets
          .where("category_id")
          .equals(dup.id)
          .toArray();

        for (const b of localBudgets) {
          const allBudgets = await db.budgets.where("household_id").equals(householdId).toArray();
          const existingStableBudget = allBudgets.find(
            (x) => x.category_id === stableCat!.id && x.period_month === b.period_month
          );

          if (existingStableBudget) {
            const newAmount = Number(existingStableBudget.amount) + Number(b.amount);
            await db.budgets.update(existingStableBudget.id, { amount: newAmount, syncStatus: "pending" });
            await db.outbox.add({
              entity: "budgets",
              entityId: existingStableBudget.id,
              op: "create",
              payload: { ...existingStableBudget, amount: newAmount },
              createdAt: Date.now(),
            });

            await db.budgets.delete(b.id);
            try {
              await supabase.from("budgets").delete().eq("id", b.id);
            } catch (err) {
              console.error("Self-healing: Failed to delete remote budget for duplicate:", err);
            }
          } else {
            await db.budgets.update(b.id, { category_id: stableCat!.id, syncStatus: "pending" });
            await db.outbox.add({
              entity: "budgets",
              entityId: b.id,
              op: "create",
              payload: { ...b, category_id: stableCat!.id },
              createdAt: Date.now(),
            });
            try {
              await supabase.from("budgets").update({ category_id: stableCat!.id } as any).eq("id", b.id);
            } catch (err) {
              console.error("Self-healing: Failed to update remote budget for duplicate:", err);
            }
          }
        }

        // D. Delete duplicate locally and remotely
        await db.categories.delete(dup.id);
        try {
          await supabase.from("categories").delete().eq("id", dup.id);
        } catch (err) {
          console.error("Self-healing: Failed to delete remote duplicate category:", err);
        }

        // E. Clean up pending outbox entries
        const pendingOutbox = await db.outbox
          .where("entity")
          .equals("categories")
          .toArray();
        for (const entry of pendingOutbox) {
          if (entry.entityId === dup.id) {
            await db.outbox.delete(entry.seq!);
          }
        }
      }
    }
  }

  triggerSync(supabase, householdId);
}

export function useCategories() {
  const { householdId } = useHousehold();

  return useQuery<HierarchicalCategory[]>({
    queryKey: ["categories", householdId],
    queryFn: async () => {
      if (!householdId) return [];

      try {
        // Query local Dexie database for offline-first speed and robustness
        const data = await db.categories
          .where("household_id")
          .equals(householdId)
          .toArray();

        let allCategories = data.filter((c) => !c.is_archived);

        // Check if we have active duplicates by kind, parent_id, and name
        const activeNames = new Set<string>();
        let hasDuplicates = false;
        const dedupedCategories: typeof allCategories = [];

        for (const c of allCategories) {
          const key = `${c.kind}:${c.parent_id || "root"}:${c.name.toLowerCase().trim()}`;
          if (activeNames.has(key)) {
            hasDuplicates = true;
          } else {
            activeNames.add(key);
            dedupedCategories.push(c);
          }
        }

        if (hasDuplicates) {
          console.log("Self-healing: Active duplicates detected in useCategories query. Triggering background merge...");
          // Decouple side-effect database write from the read query execution context
          setTimeout(() => {
            seedStandardCategories(householdId).catch((seedErr) => {
              console.error("Self-healing seeding standard categories failed in background:", seedErr);
            });
          }, 0);
          
          allCategories = dedupedCategories;
        }

        // If database is upgraded/empty and no categories exist, auto-seed standard ones
        if (allCategories.length === 0) {
          console.log("Auto-seeding: No categories exist locally. Triggering background seed standard categories...");
          setTimeout(() => {
            seedStandardCategories(householdId).catch((seedErr) => {
              console.error("Auto seeding standard categories failed in background:", seedErr);
            });
          }, 0);
        }

        // Sort by sort_order ascending
        allCategories.sort((a, b) => a.sort_order - b.sort_order);

        // Separate parents from subcategories
        const parents = allCategories.filter(
          (c) => c.parent_id === null
        ) as HierarchicalCategory[];
        const children = allCategories.filter((c) => c.parent_id !== null);

        parents.forEach((parent) => {
          parent.subcategories = children.filter(
            (child) => child.parent_id === parent.id
          );
        });

        return parents;
      } catch (err) {
        console.error("Critical error in useCategories queryFn:", err);
        return [];
      }
    },
  });
}

export function useCreateCategory() {
  const supabase = createClient();
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (category: {
      name: string;
      kind: CategoryKind;
      parent_id?: string | null;
      icon?: string;
      color?: string;
    }) => {
      if (!householdId) throw new Error("Active household context is required");

      const id = safeRandomUUID();
      const newCategory: Category = {
        id,
        household_id: householdId,
        name: category.name,
        kind: category.kind,
        parent_id: category.parent_id ?? null,
        icon: category.icon ?? "tag",
        color: category.color ?? "#C4C4C4",
        sort_order: 0,
        is_archived: false,
        created_at: new Date().toISOString(),
      };

      // Write locally to IndexedDB immediately
      await db.categories.put({
        ...newCategory,
        syncStatus: "pending",
      });

      // Queue action into outbox sync queue
      await db.outbox.add({
        entity: "categories",
        entityId: id,
        op: "create",
        payload: newCategory,
        createdAt: Date.now(),
      });

      // Fire a background sync attempt
      triggerSync(supabase, householdId);

      return newCategory;
    },
    onSuccess: () => {
      // Instantly invalidate TanStack Query cache to re-run the local Dexie query Fn
      queryClient.invalidateQueries({ queryKey: ["categories", householdId] });
    },
  });
}

export function useUpdateCategory() {
  const supabase = createClient();
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (category: {
      id: string;
      name: string;
      kind: CategoryKind;
      parent_id?: string | null;
      icon?: string;
      color?: string;
    }) => {
      if (!householdId) throw new Error("Active household context is required");

      const localCat = await db.categories.get(category.id);
      if (!localCat) throw new Error("Category not found locally");

      const updatedCategory: Category = {
        ...localCat,
        name: category.name,
        kind: category.kind,
        parent_id: category.parent_id !== undefined ? category.parent_id : localCat.parent_id,
        icon: category.icon !== undefined ? category.icon : localCat.icon,
        color: category.color !== undefined ? category.color : localCat.color,
      };

      // Write locally to IndexedDB immediately
      await db.categories.put({
        ...updatedCategory,
        syncStatus: "pending",
      });

      // Queue action into outbox sync queue
      await db.outbox.add({
        entity: "categories",
        entityId: category.id,
        op: "update",
        payload: updatedCategory,
        createdAt: Date.now(),
      });

      // Fire a background sync attempt
      triggerSync(supabase, householdId);

      return updatedCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories", householdId] });
    },
  });
}

export function useArchiveCategory() {
  const supabase = createClient();
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryId: string) => {
      if (!householdId) throw new Error("Active household context is required");

      const localCat = await db.categories.get(categoryId);
      if (!localCat) throw new Error("Category not found locally");

      const archivedCategory: Category = {
        ...localCat,
        is_archived: true,
      };

      // Write locally to IndexedDB immediately
      await db.categories.put({
        ...archivedCategory,
        syncStatus: "pending",
      });

      // Queue action into outbox sync queue
      await db.outbox.add({
        entity: "categories",
        entityId: categoryId,
        op: "delete",
        payload: archivedCategory,
        createdAt: Date.now(),
      });

      // Fire a background sync attempt
      triggerSync(supabase, householdId);

      return archivedCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories", householdId] });
      queryClient.invalidateQueries({ queryKey: ["transactions", householdId] });
      queryClient.invalidateQueries({ queryKey: ["budgets", householdId] });
    },
  });
}
