"use client";

import * as React from "react";
import { useHousehold } from "@/components/providers/household-provider";
import { useBudgets } from "@/hooks/use-budgets";
import { useTransactions } from "@/hooks/use-transactions";
import { useCategories } from "@/hooks/use-categories";
import { useNotificationPrefs } from "@/stores/notification-store";
import { currentFinancialMonth, financialMonthDateRange } from "@/lib/financial-month";
import { showLocalNotification, currentPermission } from "@/lib/notifications";
import { formatCurrency } from "@/lib/format";

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

function budgetLevel(ratio: number): 0 | 80 | 100 {
  if (ratio >= 1) return 100;
  if (ratio >= 0.8) return 80;
  return 0;
}

/**
 * App-wide watcher that fires local notifications for budget threshold
 * crossings (80% / 100%) and large expenses. Dedupe + a silent baseline on
 * first observation (per month / per device) prevent a burst of alerts for
 * data that already existed when the app loads. Renders nothing.
 */
export function useFinanceAlerts() {
  const { householdId } = useHousehold();
  const month = React.useMemo(() => currentFinancialMonth(), []);
  const { startDate, endDate } = React.useMemo(
    () => financialMonthDateRange(month),
    [month]
  );

  const { data: budgets = [] } = useBudgets(month);
  const { data: categories = [] } = useCategories();
  const { data: transactions = [] } = useTransactions({
    period: "custom",
    startDate,
    endDate,
    walletId: null,
    categoryId: null,
  });
  const { budgetAlerts, largeTxAlerts, largeTxThreshold } = useNotificationPrefs();

  React.useEffect(() => {
    if (!householdId) return;
    if (currentPermission() !== "granted") return;

    // ── Budget threshold alerts (80% / 100%) ─────────────────────────────
    if (budgetAlerts && budgets.length > 0) {
      const key = `saku-alert-budget:${householdId}:${month}`;
      const record = readJSON<Record<string, number>>(key, {});
      let changed = false;

      const spentByCat = new Map<string, number>();
      for (const t of transactions) {
        if (t.type === "expense" && t.category_id) {
          spentByCat.set(t.category_id, (spentByCat.get(t.category_id) ?? 0) + t.amount);
        }
      }

      for (const b of budgets) {
        if (b.amount <= 0) continue;
        const spent = spentByCat.get(b.category_id) ?? 0;
        const level = budgetLevel(spent / b.amount);
        const prev = record[b.category_id];

        if (prev === undefined) {
          // First time we see this category this month — baseline silently.
          record[b.category_id] = level;
          changed = true;
          continue;
        }
        if (level > prev) {
          const name = categories.find((c) => c.id === b.category_id)?.name ?? "Kategori";
          if (level === 100) {
            void showLocalNotification(`Budget ${name} terlampaui`, {
              body: `Pengeluaran ${formatCurrency(spent)} dari budget ${formatCurrency(b.amount)}.`,
              tag: `budget-${b.category_id}`,
              url: "/budgets",
            });
          } else {
            void showLocalNotification(`Budget ${name} sudah 80%`, {
              body: `Terpakai ${formatCurrency(spent)} dari ${formatCurrency(b.amount)}. Sisa ${formatCurrency(b.amount - spent)}.`,
              tag: `budget-${b.category_id}`,
              url: "/budgets",
            });
          }
          record[b.category_id] = level;
          changed = true;
        } else if (level < prev) {
          // Spending dropped (e.g. a transaction was deleted) — reset so a
          // future re-crossing alerts again.
          record[b.category_id] = level;
          changed = true;
        }
      }
      if (changed) writeJSON(key, record);
    }

    // ── Large transaction alerts ─────────────────────────────────────────
    if (largeTxAlerts && largeTxThreshold > 0) {
      const key = `saku-alert-bigtx:${householdId}`;
      const existing = localStorage.getItem(key);
      const bigTx = transactions.filter(
        (t) => t.type === "expense" && t.amount >= largeTxThreshold
      );

      if (existing === null) {
        // First observation on this device — seed silently.
        writeJSON(key, bigTx.map((t) => t.id));
      } else {
        const alerted = new Set<string>(readJSON<string[]>(key, []));
        let changed = false;
        for (const t of bigTx) {
          if (alerted.has(t.id)) continue;
          void showLocalNotification("Transaksi besar tercatat", {
            body: `${t.note || t.category?.name || "Pengeluaran"} sebesar ${formatCurrency(t.amount)}.`,
            tag: `bigtx-${t.id}`,
            url: "/transactions",
          });
          alerted.add(t.id);
          changed = true;
        }
        if (changed) writeJSON(key, Array.from(alerted));
      }
    }
  }, [
    householdId,
    month,
    budgets,
    categories,
    transactions,
    budgetAlerts,
    largeTxAlerts,
    largeTxThreshold,
  ]);
}
