import * as React from "react";

export function Shimmer({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-muted rounded-md ${className}`} />
  );
}

export function TransactionCardSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-2xl border bg-card p-3.5 min-w-0">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Shimmer className="size-9 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Shimmer className="h-4 w-32" />
          <Shimmer className="h-3 w-20" />
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 pl-2">
        <Shimmer className="h-4 w-16" />
        <div className="flex gap-1.5">
          <Shimmer className="size-8 rounded-lg" />
          <Shimmer className="size-8 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function BudgetCardSkeleton() {
  return (
    <div className="space-y-2 py-1">
      <div className="flex justify-between items-center text-xs">
        <div className="flex items-center gap-2">
          <Shimmer className="size-4 rounded-full" />
          <Shimmer className="h-3.5 w-20" />
        </div>
        <Shimmer className="h-3.5 w-24" />
      </div>
      <Shimmer className="h-2 w-full rounded-full" />
    </div>
  );
}

export function NetWorthSkeleton() {
  return (
    <div className="h-9 w-48 bg-muted animate-pulse rounded-xl mx-auto" />
  );
}

export function TransactionListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <TransactionCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function GoalCardSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3.5 min-w-0">
      <div className="flex items-center gap-3 min-w-0">
        <Shimmer className="size-12 rounded-full shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex justify-between items-center gap-2">
            <Shimmer className="h-4 w-28" />
            <Shimmer className="h-3.5 w-10" />
          </div>
          <div className="flex justify-between items-center gap-2">
            <Shimmer className="h-3.5 w-24" />
            <Shimmer className="h-3 w-16" />
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Shimmer className="flex-1 h-9 rounded-xl" />
        <Shimmer className="h-9 w-20 rounded-xl" />
      </div>
    </div>
  );
}

export function GoalListSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <GoalCardSkeleton key={i} />
      ))}
    </div>
  );
}
