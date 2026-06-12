import { db, type OutboxEntry } from "./dexie";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Table } from "dexie";
import { useSyncStore } from "@/stores/sync-store";
import { toast } from "sonner";

// Mutex to prevent concurrent triggerSync executions (per-tab)
let _syncLock = false;

// Berapa kali sebuah entry outbox boleh gagal (error dari server, bukan
// gangguan jaringan) sebelum dipindahkan ke dead-letter.
const MAX_OUTBOX_RETRIES = 5;

// Post-sync callback — lets SyncProvider register QueryClient invalidation
let _onSyncComplete: (() => void) | null = null;
export function registerSyncCallback(cb: () => void) {
  _onSyncComplete = cb;
}

type EntityName = OutboxEntry["entity"];

interface SyncTableConfig {
  entity: EntityName;
  /** Tabel punya kolom updated_at → update di-guard last-write-wins */
  hasUpdatedAt: boolean;
  /** Perilaku op "delete" di server */
  deleteMode: "soft-delete" | "archive" | "hard";
}

// Urutan menentukan urutan pull; flush mengikuti urutan seq outbox.
const SYNC_TABLES: SyncTableConfig[] = [
  { entity: "wallets", hasUpdatedAt: true, deleteMode: "archive" },
  { entity: "categories", hasUpdatedAt: false, deleteMode: "archive" },
  { entity: "transactions", hasUpdatedAt: true, deleteMode: "soft-delete" },
  { entity: "budgets", hasUpdatedAt: true, deleteMode: "hard" },
  { entity: "savings_goals", hasUpdatedAt: true, deleteMode: "hard" },
  { entity: "debts", hasUpdatedAt: true, deleteMode: "hard" },
  { entity: "recurring_transactions", hasUpdatedAt: true, deleteMode: "hard" },
];

type SyncableRow = {
  id: string;
  household_id: string;
  syncStatus?: "pending" | "synced";
  [key: string]: unknown;
};

function tableFor(entity: EntityName): Table<SyncableRow, string> {
  return db.table(entity);
}

function stripLocalFields(payload: object): Record<string, unknown> {
  const clean = { ...payload } as Record<string, unknown>;
  delete clean.syncStatus;
  return clean;
}

async function refreshDeadLetterCount() {
  const count = await db.dead_letter.count();
  useSyncStore.getState().setDeadLetterCount(count);
}

async function pullTable(
  supabase: SupabaseClient,
  householdId: string,
  cfg: SyncTableConfig
) {
  let query = supabase
    .from(cfg.entity)
    .select("*")
    .eq("household_id", householdId);

  if (cfg.entity === "transactions") {
    // Aktif + soft-deleted 30 hari terakhir (untuk Recycle Bin)
    const trashCutoff = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    query = query.or(`is_deleted.eq.false,deleted_at.gte.${trashCutoff}`);
  }
  // Wallet/kategori yang diarsip TETAP di-pull agar riwayat transaksi lama
  // masih bisa menampilkan nama & ikonnya; UI yang memfilter is_archived.

  const { data, error } = await query;
  if (error) throw error;
  const remote = (data ?? []) as SyncableRow[];

  const table = tableFor(cfg.entity);
  // Transaksi Dexie rw: cek pending & merge atomik supaya mutasi user yang
  // terjadi di sela fetch jaringan tidak tertimpa data lama.
  await db.transaction("rw", table, async () => {
    const pending = await table.where("syncStatus").equals("pending").toArray();
    const pendingIds = new Set(pending.map((r) => r.id));

    const toPut = remote
      .filter((r) => !pendingIds.has(r.id))
      .map((r) => ({ ...r, syncStatus: "synced" as const }));
    if (toPut.length > 0) await table.bulkPut(toPut);

    // Purge baris synced yang sudah tidak ada di remote
    const remoteIds = new Set(remote.map((r) => r.id));
    const locals = await table.where("household_id").equals(householdId).toArray();
    const toDelete = locals
      .filter((l) => l.syncStatus === "synced" && !remoteIds.has(l.id))
      .map((l) => l.id);
    if (toDelete.length > 0) await table.bulkDelete(toDelete);
  });
}

export async function pullLatest(supabase: SupabaseClient, householdId: string) {
  if (!householdId) return;
  try {
    for (const cfg of SYNC_TABLES) {
      await pullTable(supabase, householdId, cfg);
    }
  } catch (error) {
    console.error("Failed to pull latest from remote:", error);
    useSyncStore
      .getState()
      .setStatus("error", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function flushEntry(
  supabase: SupabaseClient,
  entry: OutboxEntry,
  cfg: SyncTableConfig
) {
  const table = tableFor(entry.entity);

  if (entry.op === "create") {
    const payload = stripLocalFields(entry.payload);
    const { error } = await supabase.from(entry.entity).insert(payload);
    // 23505 (duplicate key) = baris sudah ada di server, mis. retry setelah
    // insert sebenarnya sukses. HANYA kode ini yang aman dianggap sinkron;
    // error constraint lain (mis. FK 23503) harus masuk jalur retry agar
    // data tidak hilang.
    if (error && error.code !== "23505") throw error;
    await table.update(entry.entityId, { syncStatus: "synced" });
  } else if (entry.op === "update") {
    const payload = stripLocalFields(entry.payload);
    let query = supabase.from(entry.entity).update(payload).eq("id", entry.entityId);
    if (cfg.hasUpdatedAt && typeof payload.updated_at === "string") {
      // Guard last-write-wins: jika versi remote lebih baru, update ini
      // tidak mengenai baris apa pun dan pull berikutnya menyegarkan lokal.
      query = query.lt("updated_at", payload.updated_at);
    }
    const { error } = await query;
    if (error) throw error;
    await table.update(entry.entityId, { syncStatus: "synced" });
  } else if (entry.op === "delete") {
    if (cfg.deleteMode === "soft-delete") {
      const local = await table.get(entry.entityId);
      const { error } = await supabase
        .from(entry.entity)
        .update({
          is_deleted: true,
          deleted_at: (local?.deleted_at as string | null) ?? new Date().toISOString(),
          deleted_by: (local?.deleted_by as string | null) ?? null,
        })
        .eq("id", entry.entityId);
      if (error) throw error;
      await table.update(entry.entityId, { syncStatus: "synced" });
    } else if (cfg.deleteMode === "archive") {
      const { error } = await supabase
        .from(entry.entity)
        .update({ is_archived: true })
        .eq("id", entry.entityId);
      if (error) throw error;
      await table.update(entry.entityId, { is_archived: true, syncStatus: "synced" });
    } else {
      const { error } = await supabase
        .from(entry.entity)
        .delete()
        .eq("id", entry.entityId);
      if (error) throw error;
      await table.delete(entry.entityId);
    }
  } else if (entry.op === "purge") {
    // Hard delete — only allowed via RLS when is_deleted = true
    const { error } = await supabase
      .from(entry.entity)
      .delete()
      .eq("id", entry.entityId);
    if (error) throw error;
    await table.delete(entry.entityId);
  }

  await db.outbox.delete(entry.seq!);
}

export async function flushOutbox(supabase: SupabaseClient) {
  // Grab items ordered by sequence seq to maintain transactional chronology
  const entries = await db.outbox.orderBy("seq").toArray();
  if (entries.length === 0) return;

  for (const entry of entries) {
    const cfg = SYNC_TABLES.find((c) => c.entity === entry.entity);
    if (!cfg) {
      console.error(`Unknown outbox entity ${entry.entity}; discarding`, entry);
      await db.outbox.delete(entry.seq!);
      continue;
    }

    try {
      await flushEntry(supabase, entry, cfg);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      console.error(`Failed to flush outbox entry seq=${entry.seq}:`, err);

      if (!code) {
        // Tanpa kode Postgres = kemungkinan gangguan jaringan/transien.
        // Hentikan agar urutan terjaga; coba lagi pada sync berikutnya
        // tanpa menambah hitungan retry.
        break;
      }

      const retries = (entry.retries ?? 0) + 1;
      if (retries >= MAX_OUTBOX_RETRIES) {
        // Pindahkan ke dead-letter — JANGAN dibuang diam-diam dan JANGAN
        // tandai synced (baris lokal tetap pending agar tidak ikut purge).
        await db.dead_letter.add({
          entity: entry.entity,
          entityId: entry.entityId,
          op: entry.op,
          payload: entry.payload,
          error: err instanceof Error ? err.message : String(err),
          failedAt: Date.now(),
        });
        await db.outbox.delete(entry.seq!);
        await refreshDeadLetterCount();
        toast.error(
          "Sebagian perubahan gagal disinkronkan ke server. Cek menu Pengaturan untuk detailnya."
        );
        continue; // entry berikutnya mungkin tidak bergantung pada yang gagal
      }

      await db.outbox.update(entry.seq!, { retries });
      break; // pertahankan urutan; retry pada sync berikutnya
    }
  }
}

export async function materializePassedScheduledTransactions() {
  try {
    const nowStr = new Date().toISOString();
    const allTxs = await db.transactions.toArray();
    const filterPassed = allTxs.filter(
      (t) => t.is_scheduled && t.occurred_at <= nowStr && !t.is_deleted
    );

    for (const tx of filterPassed) {
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

// CATATAN: materialisasi transaksi BERULANG (recurring) sengaja TIDAK
// dilakukan di klien. Menjalankannya per-device menyebabkan transaksi ganda
// saat dua perangkat online bersamaan, dan payload klien tidak punya
// created_by yang valid. Materialisasi berjalan di server via pg_cron
// (lihat supabase/migrations/0014_recurring_server_cron.sql); hasilnya
// sampai ke klien lewat realtime/pull seperti transaksi biasa.

export interface TriggerSyncOptions {
  /**
   * pull=false → hanya flush outbox (dipakai mutasi lokal, murah).
   * pull=true → flush + tarik semua data remote (mount, online, manual).
   */
  pull?: boolean;
}

export async function triggerSync(
  supabase: SupabaseClient,
  householdId: string,
  options: TriggerSyncOptions = {}
) {
  const { pull = true } = options;

  // Mutex: prevent concurrent sync executions that cause data corruption
  if (_syncLock) return;
  if (typeof window !== "undefined" && !navigator.onLine) {
    useSyncStore.getState().setStatus("offline");
    return;
  }
  _syncLock = true;
  useSyncStore.getState().setStatus("syncing");
  try {
    await flushOutbox(supabase);
    if (pull) {
      await pullLatest(supabase, householdId);
      await materializePassedScheduledTransactions();
    }
    await refreshDeadLetterCount();
    useSyncStore.getState().setLastSynced(new Date().toISOString());
    if (pull) {
      // Notify listeners (e.g. SyncProvider) to invalidate query caches
      _onSyncComplete?.();
    }
  } catch (err) {
    console.error("Sync failed:", err);
    useSyncStore
      .getState()
      .setStatus("error", err instanceof Error ? err.message : String(err));
  } finally {
    _syncLock = false;
  }
}
