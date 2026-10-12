import type { Budget } from "@/lib/supabase/types";
import { isInFinancialMonth } from "@/lib/financial-month";

type UsageTx = {
  type: string;
  amount: number;
  category_id: string | null;
  occurred_at: string;
};

type CategoryNode = { id: string; subcategories?: { id: string }[] };

export type BudgetStatus = "safe" | "near" | "over";

export interface BudgetUsage {
  limit: number;
  carryOver: number;
  totalLimit: number;
  spent: number;
  remaining: number;
  /** Unclamped spend ratio in percent (can exceed 100). */
  percent: number;
  status: BudgetStatus;
}

/**
 * Category ids a budget on `categoryId` covers: the category itself plus its
 * subcategories when it is a parent — same rule as the Budget page.
 */
export function budgetCategoryIds(categoryId: string, tree: CategoryNode[]): string[] {
  const parent = tree.find((c) => c.id === categoryId);
  return [categoryId, ...(parent?.subcategories ?? []).map((s) => s.id)];
}

function spentIn(ids: string[], month: string, txs: UsageTx[]): number {
  return txs.reduce(
    (sum, t) =>
      t.type === "expense" &&
      t.category_id &&
      ids.includes(t.category_id) &&
      isInFinancialMonth(t.occurred_at, month)
        ? sum + t.amount
        : sum,
    0
  );
}

/**
 * Spend vs limit for one budget in its financial month, including the
 * carry-over of last month's unspent limit when the budget opts in.
 * `transactions` must cover the budget's month (and the previous month when
 * carry-over matters); rows outside those months are ignored.
 */
export function computeBudgetUsage(
  budget: Budget,
  prevBudget: Budget | undefined,
  tree: CategoryNode[],
  transactions: UsageTx[],
  prevMonth: string
): BudgetUsage {
  const ids = budgetCategoryIds(budget.category_id, tree);
  const spent = spentIn(ids, budget.period_month, transactions);

  let carryOver = 0;
  if (budget.carry_over && prevBudget) {
    carryOver = Math.max(0, prevBudget.amount - spentIn(ids, prevMonth, transactions));
  }

  const totalLimit = budget.amount + carryOver;
  const percent = totalLimit > 0 ? Math.round((spent / totalLimit) * 100) : 0;
  const status: BudgetStatus = spent > totalLimit ? "over" : percent >= 80 ? "near" : "safe";

  return {
    limit: budget.amount,
    carryOver,
    totalLimit,
    spent,
    remaining: totalLimit - spent,
    percent,
    status,
  };
}

/**
 * The budget that applies to an expense in `categoryId`: its own budget if it
 * has one, otherwise its parent's.
 */
export function findApplicableBudget(
  categoryId: string,
  tree: CategoryNode[],
  budgets: Budget[],
  month: string
): Budget | undefined {
  const inMonth = budgets.filter((b) => b.period_month === month);
  const own = inMonth.find((b) => b.category_id === categoryId);
  if (own) return own;
  const parent = tree.find((p) => p.subcategories?.some((s) => s.id === categoryId));
  return parent ? inMonth.find((b) => b.category_id === parent.id) : undefined;
}
