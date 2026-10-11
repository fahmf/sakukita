"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/components/providers/household-provider";
import type { Category, CategoryKind } from "@/lib/supabase/types";
import { db, type Syncable } from "@/lib/db/dexie";
import type { SupabaseClient } from "@supabase/supabase-js";
import { triggerSync } from "@/lib/db/sync";
import { safeRandomUUID } from "@/lib/utils";

// Guard against concurrent seedStandardCategories executions
let _seedingInProgress = false;

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

/**
 * Fold category `dupId` into `targetId`: transactions, recurring templates,
 * budgets and subcategories are all repointed before the duplicate goes away.
 *
 * Remote writes run first and every PostgREST error is checked (supabase-js
 * returns `{ error }` instead of throwing). If any of them fails we stop
 * before touching local data, so the device never diverges from the server
 * and nothing is orphaned — the merge simply retries on the next seed run.
 */
async function mergeCategoryInto(
  supabase: SupabaseClient,
  householdId: string,
  dupId: string,
  targetId: string
): Promise<boolean> {
  const fail = (step: string, error: unknown) => {
    console.error(`Category merge ${dupId} -> ${targetId} aborted at ${step}:`, error);
    return false;
  };

  const remaps: [string, Record<string, string>, string][] = [
    ["transactions", { category_id: targetId }, "category_id"],
    ["recurring_transactions", { category_id: targetId }, "category_id"],
    ["categories", { parent_id: targetId }, "parent_id"],
  ];
  for (const [table, patch, column] of remaps) {
    const { error } = await supabase.from(table).update(patch).eq(column, dupId);
    if (error) return fail(table, error);
  }

  // Budgets: fold into the target's budget for the same month if one exists,
  // since (household, category, month) is unique.
  const householdBudgets = await db.budgets.where("household_id").equals(householdId).toArray();
  const dupBudgets = householdBudgets.filter((b) => b.category_id === dupId);
  for (const b of dupBudgets) {
    const existing = householdBudgets.find(
      (x) => x.category_id === targetId && x.period_month === b.period_month
    );
    if (existing) {
      const amount = Number(existing.amount) + Number(b.amount);
      const { error: upErr } = await supabase.from("budgets").update({ amount }).eq("id", existing.id);
      if (upErr) return fail("budgets", upErr);
      const { error: delErr } = await supabase.from("budgets").delete().eq("id", b.id);
      if (delErr) return fail("budgets", delErr);
      await db.budgets.update(existing.id, { amount });
      await db.budgets.delete(b.id);
    } else {
      const { error } = await supabase.from("budgets").update({ category_id: targetId }).eq("id", b.id);
      if (error) return fail("budgets", error);
      await db.budgets.update(b.id, { category_id: targetId });
    }
  }

  // Deleting a category is admin-only under RLS; editors fall back to archiving
  // it, which hides it just the same now that nothing points at it.
  const { error: delError } = await supabase.from("categories").delete().eq("id", dupId);
  if (delError) {
    const { error: archError } = await supabase
      .from("categories")
      .update({ is_archived: true })
      .eq("id", dupId);
    if (archError) return fail("categories delete/archive", archError);
  }

  // Server is consistent — mirror it locally.
  await db.transactions.where("category_id").equals(dupId).modify({ category_id: targetId });
  await db.recurring_transactions
    .filter((r) => r.category_id === dupId)
    .modify({ category_id: targetId });
  await db.categories.filter((c) => c.parent_id === dupId).modify({ parent_id: targetId });
  await db.categories.delete(dupId);

  // Queued writes still carrying the old id would re-point rows at a deleted
  // category (FK violation) — rewrite them, and drop the duplicate's own ops.
  const queued = await db.outbox.toArray();
  for (const entry of queued) {
    if (entry.entity === "categories" && entry.entityId === dupId) {
      await db.outbox.delete(entry.seq!);
      continue;
    }
    const payload = entry.payload ?? {};
    if (payload.category_id === dupId || payload.parent_id === dupId) {
      await db.outbox.update(entry.seq!, {
        payload: {
          ...payload,
          ...(payload.category_id === dupId ? { category_id: targetId } : {}),
          ...(payload.parent_id === dupId ? { parent_id: targetId } : {}),
        },
      });
    }
  }
  return true;
}

export async function seedStandardCategories(householdId: string) {
  if (_seedingInProgress) return;
  _seedingInProgress = true;
  try {
  const supabase = createClient();
  const now = new Date().toISOString();

  // Lean default catalog (Oct 2026), shaped by five months of real usage:
  // four subcategories held 55% of entries while ~25 were never used, and
  // missing/hidden "Kesehatan" pushed medicine into "Bahan Makanan".
  //
  // Stable ids are kept from the previous catalog wherever the concept
  // survives (renamed or moved), so existing households that already hold
  // these ids never get a duplicate. Dropped entries simply stop being seeded
  // for new households; nothing is removed from existing ones.
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
        { id: "00000000-0000-4000-8000-000000000002", name: "Belanja Dapur", icon: "🛒" },
        { id: "00000000-0000-4000-8000-000000000003", name: "Makan di Luar", icon: "🍕" },
        { id: "00000000-0000-4000-8000-000000000004", name: "Jajan & Kopi", icon: "☕" },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000000000100",
      name: "Rumah Tangga",
      kind: "expense" as const,
      icon: "🏠",
      color: "#F4D2A6",
      sort_order: 20,
      subcategories: [
        { id: "00000000-0000-4000-8000-000000000101", name: "Listrik & Air", icon: "🔌" },
        { id: "00000000-0000-4000-8000-000000000312", name: "Gas & Galon", icon: "🔥" },
        { id: "00000000-0000-4000-8000-000000000103", name: "Perlengkapan Rumah", icon: "🧹" },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000000000010",
      name: "Transportasi",
      kind: "expense" as const,
      icon: "🚗",
      color: "#B8E6D3",
      sort_order: 30,
      subcategories: [
        { id: "00000000-0000-4000-8000-000000000011", name: "Bensin", icon: "⛽" },
        { id: "00000000-0000-4000-8000-000000000013", name: "Ojek, Parkir & Tol", icon: "🎫" },
        { id: "00000000-0000-4000-8000-000000000302", name: "Servis Kendaraan", icon: "🔧" },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000000000200",
      name: "Tagihan",
      kind: "expense" as const,
      icon: "🧾",
      color: "#F4A6A6",
      sort_order: 40,
      subcategories: [
        // Moved here from Rumah Tangga; same stable id as before.
        { id: "00000000-0000-4000-8000-000000000102", name: "Pulsa & Internet", icon: "📶" },
        { id: "00000000-0000-4000-8000-000000000201", name: "Langganan Digital", icon: "📺" },
        { id: "00000000-0000-4000-8000-000000000203", name: "Cicilan & Utang", icon: "🏦" },
        { id: "00000000-0000-4000-8000-000000000204", name: "Pajak & Asuransi", icon: "🧮" },
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
        { id: "00000000-0000-4000-8000-000000010002", name: "Dokter, Bidan & Lab", icon: "🩺" },
        { id: "00000000-0000-4000-8000-000000000331", name: "BPJS & Asuransi Kesehatan", icon: "🩹" },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000000000220",
      name: "Anak & Keluarga",
      kind: "expense" as const,
      icon: "👨‍👩‍👧",
      color: "#E8C8A5",
      sort_order: 55,
      subcategories: [
        { id: "00000000-0000-4000-8000-000000000221", name: "Kebutuhan Anak & Bayi", icon: "🍼" },
        { id: "00000000-0000-4000-8000-000000000223", name: "Kiriman Orang Tua", icon: "👵" },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000000000210",
      name: "Pendidikan",
      kind: "expense" as const,
      icon: "🎓",
      color: "#A6C8E8",
      sort_order: 60,
      subcategories: [
        { id: "00000000-0000-4000-8000-000000000211", name: "SPP & Biaya Sekolah", icon: "🏫" },
        { id: "00000000-0000-4000-8000-000000000212", name: "Buku & Alat Tulis", icon: "📚" },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000000100000",
      name: "Pakaian & Perawatan",
      kind: "expense" as const,
      icon: "🛍️",
      color: "#E8A5C8",
      sort_order: 65,
      subcategories: [
        { id: "00000000-0000-4000-8000-000000100001", name: "Pakaian", icon: "👕" },
        { id: "00000000-0000-4000-8000-000000100002", name: "Perawatan Diri", icon: "🧴" },
        { id: "00000000-0000-4000-8000-000000000341", name: "Elektronik & Gadget", icon: "📱" },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000000000230",
      name: "Sosial & Ibadah",
      kind: "expense" as const,
      icon: "🤲",
      color: "#E8A5D8",
      sort_order: 70,
      subcategories: [
        { id: "00000000-0000-4000-8000-000000000232", name: "Zakat, Infak & Sedekah", icon: "🕌" },
        { id: "00000000-0000-4000-8000-000000000233", name: "Hadiah & Kondangan", icon: "🎀" },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000000001000",
      name: "Hiburan & Liburan",
      kind: "expense" as const,
      icon: "🎡",
      color: "#C8A5E8",
      sort_order: 80,
      subcategories: [],
    },
    {
      id: "00000000-0000-4000-8000-000000000250",
      name: "Lainnya",
      kind: "expense" as const,
      icon: "📦",
      color: "#A8A29E",
      sort_order: 900,
      subcategories: [],
    },

    // --- INCOME ---
    {
      id: "00000000-0000-4000-8000-000001000000",
      name: "Gaji",
      kind: "income" as const,
      icon: "💰",
      color: "#5FBF9A",
      sort_order: 100,
      subcategories: [
        { id: "00000000-0000-4000-8000-000001000001", name: "Gaji Bulanan", icon: "💵" },
        { id: "00000000-0000-4000-8000-000001000002", name: "Bonus, THR & Lembur", icon: "🎁" },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000000000400",
      name: "Usaha & Sampingan",
      kind: "income" as const,
      icon: "🏪",
      color: "#A5E8B8",
      sort_order: 110,
      subcategories: [],
    },
    {
      // Promoted from a subcategory of "Pendapatan Lain"; same stable id.
      id: "00000000-0000-4000-8000-000020000002",
      name: "Pemberian & Hadiah",
      kind: "income" as const,
      icon: "🧧",
      color: "#E8C8A5",
      sort_order: 115,
      subcategories: [],
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
        // Moved here from the dropped "Investasi" parent; same stable id.
        { id: "00000000-0000-4000-8000-000010000001", name: "Bunga & Imbal Hasil", icon: "🪙" },
      ],
    },
  ];

  console.log("Seeding and deduplicating categories for household:", householdId);

  // Snapshot existing local ids so seeding is add-only: we never overwrite a
  // category the user has already customized or archived, and re-runs (e.g. to
  // top up newly shipped defaults) only insert what's genuinely missing.
  const existingIds = new Set(
    (await db.categories.where("household_id").equals(householdId).primaryKeys()) as string[]
  );

  // 1. Write any missing standard stable categories locally first
  for (const parent of standardCategories) {
    const parentDetId = await generateDeterministicUUID(householdId, parent.id);
    if (!existingIds.has(parentDetId)) {
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
    }

    if (parent.subcategories) {
      let childOrder = 0;
      for (const child of parent.subcategories) {
        const childDetId = await generateDeterministicUUID(householdId, child.id);
        childOrder++;
        if (existingIds.has(childDetId)) continue;
        const childCategory: Category = {
          id: childDetId,
          household_id: householdId,
          name: child.name,
          kind: parent.kind,
          parent_id: parentDetId,
          icon: child.icon,
          color: parent.color,
          sort_order: parent.sort_order + childOrder,
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

  // 2. Merge legacy/alias duplicates into their standard category.
  //
  // Only names that earlier versions (or the server signup trigger) seeded are
  // aliased here. Generic words people plausibly use for their own categories
  // ("obat", "anak", "sekolah", "tabungan", ...) are deliberately absent: an
  // alias hit merges and then deletes the category, so a broad alias silently
  // destroys user-made categories. Every alias also carries its kind so an
  // expense category can never be folded into an income one (the old
  // "lain-lain" -> "Pendapatan Lain" mapping did exactly that).
  const kindByStableId = new Map<string, CategoryKind>();
  for (const parent of standardCategories) {
    kindByStableId.set(parent.id, parent.kind);
    for (const child of parent.subcategories) kindByStableId.set(child.id, parent.kind);
  }

  // Current names plus every name an earlier catalog or the server signup
  // trigger used for the same stable category.
  const rootAliases: Record<string, string> = {
    "makanan": "00000000-0000-4000-8000-000000000001",
    "makanan & dapur": "00000000-0000-4000-8000-000000000001",
    "makanan/minuman": "00000000-0000-4000-8000-000000000001",
    "food": "00000000-0000-4000-8000-000000000001",
    "rumah tangga": "00000000-0000-4000-8000-000000000100",
    "kebutuhan rumah": "00000000-0000-4000-8000-000000000100",
    "transportasi": "00000000-0000-4000-8000-000000000010",
    "transport": "00000000-0000-4000-8000-000000000010",
    "tagihan": "00000000-0000-4000-8000-000000000200",
    "tagihan & langganan": "00000000-0000-4000-8000-000000000200",
    "utilities": "00000000-0000-4000-8000-000000000200",
    "bills": "00000000-0000-4000-8000-000000000200",
    "kesehatan": "00000000-0000-4000-8000-000000010000",
    "health": "00000000-0000-4000-8000-000000010000",
    "anak & keluarga": "00000000-0000-4000-8000-000000000220",
    "keluarga & anak": "00000000-0000-4000-8000-000000000220",
    "pendidikan": "00000000-0000-4000-8000-000000000210",
    "education": "00000000-0000-4000-8000-000000000210",
    "pakaian & perawatan": "00000000-0000-4000-8000-000000100000",
    "belanja pribadi": "00000000-0000-4000-8000-000000100000",
    "belanja": "00000000-0000-4000-8000-000000100000",
    "shopping": "00000000-0000-4000-8000-000000100000",
    "sosial & ibadah": "00000000-0000-4000-8000-000000000230",
    "hadiah & donasi": "00000000-0000-4000-8000-000000000230",
    "hiburan & liburan": "00000000-0000-4000-8000-000000001000",
    "hiburan & hobi": "00000000-0000-4000-8000-000000001000",
    "hiburan": "00000000-0000-4000-8000-000000001000",
    "entertainment": "00000000-0000-4000-8000-000000001000",
    "lainnya": "00000000-0000-4000-8000-000000000250",
    // Server signup default "Lain-lain" is an EXPENSE category.
    "lain-lain": "00000000-0000-4000-8000-000000000250",
    "gaji": "00000000-0000-4000-8000-000001000000",
    "gaji & pendapatan": "00000000-0000-4000-8000-000001000000",
    "salary": "00000000-0000-4000-8000-000001000000",
    "usaha & sampingan": "00000000-0000-4000-8000-000000000400",
    "usaha & bisnis": "00000000-0000-4000-8000-000000000400",
    "freelance & sampingan": "00000000-0000-4000-8000-000000000400",
    // Server signup default "Hadiah" is an INCOME category.
    "pemberian & hadiah": "00000000-0000-4000-8000-000020000002",
    "hadiah": "00000000-0000-4000-8000-000020000002",
    "pendapatan lain": "00000000-0000-4000-8000-000020000000",
  };

  // alias key is `${kind}:${level}:${name}` so kind and tree level must match
  const aliasToHouseholdStableId = new Map<string, string>();
  const householdStableIds = new Set<string>();
  for (const [alias, stableId] of Object.entries(rootAliases)) {
    const detId = await generateDeterministicUUID(householdId, stableId);
    aliasToHouseholdStableId.set(`${kindByStableId.get(stableId)}:root:${alias}`, detId);
    householdStableIds.add(detId);
  }
  for (const parent of standardCategories) {
    for (const child of parent.subcategories) {
      const detId = await generateDeterministicUUID(householdId, child.id);
      aliasToHouseholdStableId.set(`${parent.kind}:sub:${child.name.toLowerCase().trim()}`, detId);
      householdStableIds.add(detId);
    }
  }

  const currentLocalCategories = await db.categories
    .where("household_id")
    .equals(householdId)
    .toArray();
  const activeLocalIds = new Set(
    currentLocalCategories.filter((c) => !c.is_archived).map((c) => c.id)
  );

  for (const cat of currentLocalCategories) {
    // Archived rows are left alone: they are invisible already and double as
    // tombstones that stop the seed from recreating a category the user removed.
    if (cat.is_archived || householdStableIds.has(cat.id)) continue;
    const level = cat.parent_id ? "sub" : "root";
    const targetId = aliasToHouseholdStableId.get(
      `${cat.kind}:${level}:${cat.name.toLowerCase().trim()}`
    );
    // Never merge into a standard category that is missing or archived here.
    if (!targetId || !activeLocalIds.has(targetId)) continue;
    await mergeCategoryInto(supabase, householdId, cat.id, targetId);
  }

  // 3. Self-healing deduplication by NAME (case-insensitive, same kind & parent_id)
  const freshLocalCategories = await db.categories
    .where("household_id")
    .equals(householdId)
    .toArray();

  const categoriesGrouped = new Map<string, Category[]>();
  for (const cat of freshLocalCategories) {
    if (cat.is_archived) continue;
    const key = `${cat.kind}:${cat.parent_id || "root"}:${cat.name.toLowerCase().trim()}`;
    if (!categoriesGrouped.has(key)) {
      categoriesGrouped.set(key, []);
    }
    categoriesGrouped.get(key)!.push(cat);
  }

  for (const list of categoriesGrouped.values()) {
    if (list.length < 2) continue;
    // Prefer the deterministic standard id, then an already-synced row
    const keep =
      list.find((c) => householdStableIds.has(c.id)) ||
      list.find((c) => (c as Syncable<Category>).syncStatus === "synced") ||
      list[0];
    for (const dup of list) {
      if (dup.id !== keep.id) await mergeCategoryInto(supabase, householdId, dup.id, keep.id);
    }
  }

  triggerSync(supabase, householdId);
  } finally {
    _seedingInProgress = false;
  }
}

// Bump whenever the shipped standard catalog gains new categories. Existing
// installs run the add-only seed once per version to top up the new defaults
// without touching anything the user has already customized or archived.
const STANDARD_CATALOG_VERSION = 2;

export function useCategories() {
  const { householdId } = useHousehold();

  return useQuery<HierarchicalCategory[]>({
    queryKey: ["categories", householdId],
    enabled: !!householdId,
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
        } else if (typeof window !== "undefined") {
          // Existing install: top up newly shipped default categories once per
          // catalog version. The seed is add-only, so this never clobbers edits.
          const versionKey = `sakukita_cat_seed_version:${householdId}`;
          const seenVersion = Number(window.localStorage.getItem(versionKey) || "0");
          if (seenVersion < STANDARD_CATALOG_VERSION) {
            console.log(`Category catalog top-up: v${seenVersion} -> v${STANDARD_CATALOG_VERSION}. Adding missing defaults in background...`);
            window.localStorage.setItem(versionKey, String(STANDARD_CATALOG_VERSION));
            setTimeout(() => {
              seedStandardCategories(householdId).catch((seedErr) => {
                console.error("Category catalog top-up failed in background:", seedErr);
              });
            }, 0);
          }
        }

        // Sort by sort_order ascending
        allCategories.sort((a, b) => a.sort_order - b.sort_order);

        // Separate parents from subcategories. A subcategory whose parent is
        // archived or missing is promoted to a top-level entry rather than
        // silently vanishing from every picker (this is how "Kesehatan › Obat
        // & Vitamin" disappeared once its parent was archived).
        const activeIds = new Set(allCategories.map((c) => c.id));
        const isRoot = (c: Category) => c.parent_id === null || !activeIds.has(c.parent_id);
        const parents = allCategories.filter(isRoot) as HierarchicalCategory[];
        const children = allCategories.filter((c) => !isRoot(c));

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

/**
 * How often each category was used in the last `days` days (live, non-deleted,
 * non-scheduled transactions). Keyed under ["transactions", householdId, ...]
 * so every transaction mutation that invalidates "transactions" refreshes it.
 */
export function useCategoryUsage(days = 90) {
  const { householdId } = useHousehold();

  return useQuery<Map<string, number>>({
    queryKey: ["transactions", householdId, "category-usage", days],
    enabled: !!householdId,
    queryFn: async () => {
      const counts = new Map<string, number>();
      if (!householdId) return counts;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      const txs = await db.transactions.where("household_id").equals(householdId).toArray();
      for (const t of txs) {
        if (t.is_deleted || t.is_scheduled || !t.category_id) continue;
        if (new Date(t.occurred_at).getTime() < cutoff) continue;
        counts.set(t.category_id, (counts.get(t.category_id) ?? 0) + 1);
      }
      return counts;
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

      // Archiving a parent archives its subcategories too; otherwise they are
      // left pointing at a hidden parent.
      const subcategories = localCat.parent_id
        ? []
        : await db.categories
            .where("household_id")
            .equals(householdId)
            .filter((c) => c.parent_id === categoryId && !c.is_archived)
            .toArray();

      const archivedCategory: Category = {
        ...localCat,
        is_archived: true,
      };

      for (const cat of [...subcategories, localCat]) {
        const archived: Category = { ...cat, is_archived: true };
        delete (archived as Syncable<Category>).syncStatus;

        // Write locally to IndexedDB immediately
        await db.categories.put({
          ...archived,
          syncStatus: "pending",
        });

        // Queue action into outbox sync queue
        await db.outbox.add({
          entity: "categories",
          entityId: cat.id,
          op: "delete",
          payload: archived,
          createdAt: Date.now(),
        });
      }

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

export interface ArchivedCategory extends Category {
  /** Name of its parent (archived or not), for "Parent › Child" labels. */
  parentName: string | null;
}

/**
 * Archived categories that can usefully be restored. Archived rows whose name
 * matches an active category of the same kind and level are left out — those
 * are old duplicates kept as seed tombstones, and restoring one would only
 * recreate the duplicate.
 */
export function useArchivedCategories() {
  const { householdId } = useHousehold();

  return useQuery<ArchivedCategory[]>({
    queryKey: ["categories", householdId, "archived"],
    enabled: !!householdId,
    queryFn: async () => {
      if (!householdId) return [];
      const all = await db.categories.where("household_id").equals(householdId).toArray();
      const byId = new Map(all.map((c) => [c.id, c]));
      const key = (c: Category) =>
        `${c.kind}:${c.parent_id ? "sub" : "root"}:${c.name.toLowerCase().trim()}`;
      const activeKeys = new Set(all.filter((c) => !c.is_archived).map(key));
      return all
        .filter((c) => c.is_archived && !activeKeys.has(key(c)))
        .map((c) => ({ ...c, parentName: c.parent_id ? byId.get(c.parent_id)?.name ?? null : null }))
        .sort(
          (a, b) =>
            a.kind.localeCompare(b.kind) ||
            (a.parentName ?? a.name).localeCompare(b.parentName ?? b.name) ||
            (a.parent_id ? 1 : 0) - (b.parent_id ? 1 : 0) ||
            a.name.localeCompare(b.name)
        );
    },
  });
}

/**
 * Restore an archived category. A parent comes back with its archived
 * subcategories (archiving cascades, so this undoes it); a subcategory brings
 * its parent back too so it isn't left under a hidden parent.
 */
export function useRestoreCategory() {
  const supabase = createClient();
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryId: string) => {
      if (!householdId) throw new Error("Active household context is required");
      const cat = await db.categories.get(categoryId);
      if (!cat) throw new Error("Kategori tidak ditemukan");

      const all = await db.categories.where("household_id").equals(householdId).toArray();
      const toRestore: Category[] = [cat];
      if (cat.parent_id) {
        const parent = all.find((c) => c.id === cat.parent_id);
        if (parent?.is_archived) toRestore.push(parent);
      } else {
        toRestore.push(...all.filter((c) => c.parent_id === cat.id && c.is_archived));
      }

      for (const c of toRestore) {
        const restored: Category = { ...c, is_archived: false };
        delete (restored as Syncable<Category>).syncStatus;
        await db.categories.put({ ...restored, syncStatus: "pending" });
        await db.outbox.add({
          entity: "categories",
          entityId: c.id,
          op: "update",
          payload: restored,
          createdAt: Date.now(),
        });
      }
      triggerSync(supabase, householdId);
      return toRestore.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories", householdId] });
      queryClient.invalidateQueries({ queryKey: ["transactions", householdId] });
    },
  });
}

/**
 * Merge one category into another of the same kind: every transaction,
 * recurring template, budget and subcategory moves to the target and the
 * source disappears. Runs against the server directly (see mergeCategoryInto),
 * so it needs a connection.
 */
export function useMergeCategory() {
  const supabase = createClient();
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sourceId, targetId }: { sourceId: string; targetId: string }) => {
      if (!householdId) throw new Error("Active household context is required");
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("Menggabungkan kategori butuh koneksi internet.");
      }
      const [source, target] = await Promise.all([
        db.categories.get(sourceId),
        db.categories.get(targetId),
      ]);
      if (!source || !target) throw new Error("Kategori tidak ditemukan");
      if (source.id === target.id) throw new Error("Pilih kategori tujuan yang berbeda");
      if (source.kind !== target.kind) {
        throw new Error("Kategori pemasukan dan pengeluaran tidak bisa digabung");
      }
      if (target.parent_id === source.id) {
        throw new Error("Tidak bisa digabung ke subkategorinya sendiri");
      }
      const hasSubs = (await db.categories.filter((c) => c.parent_id === source.id && !c.is_archived).count()) > 0;
      if (hasSubs && target.parent_id) {
        throw new Error("Kategori yang punya subkategori hanya bisa digabung ke kategori induk");
      }

      const ok = await mergeCategoryInto(supabase, householdId, source.id, target.id);
      if (!ok) throw new Error("Server menolak penggabungan. Coba lagi nanti.");
      triggerSync(supabase, householdId);
      return { source: source.name, target: target.name };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories", householdId] });
      queryClient.invalidateQueries({ queryKey: ["transactions", householdId] });
      queryClient.invalidateQueries({ queryKey: ["budgets", householdId] });
      queryClient.invalidateQueries({ queryKey: ["recurring-transactions", householdId] });
    },
  });
}

/**
 * Every category of the household by id, archived ones included. Reports and
 * history need this: a transaction keeps pointing at its category after that
 * category (or its parent) is archived, and must still be counted and named.
 */
export function useCategoryLookup() {
  const { householdId } = useHousehold();

  return useQuery<Map<string, Category>>({
    queryKey: ["categories", householdId, "lookup"],
    enabled: !!householdId,
    queryFn: async () => {
      if (!householdId) return new Map();
      const all = await db.categories.where("household_id").equals(householdId).toArray();
      return new Map(all.map((c) => [c.id, c]));
    },
  });
}
