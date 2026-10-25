"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { Check, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { iconMap } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/supabase/types";
import type { HierarchicalCategory } from "@/hooks/use-categories";

/** A category's icon: a mapped lucide icon name, else the stored emoji. */
export function CategoryIcon({
  icon,
  className,
  fallback = "🏷️",
}: {
  icon: string | null | undefined;
  className?: string;
  fallback?: string;
}) {
  const Icon = icon ? iconMap[icon] : undefined;
  if (Icon) return <Icon className={className} />;
  // Emoji inherit the container's font size, so badges can scale them.
  return <span className="select-none leading-none">{icon || fallback}</span>;
}

/**
 * Category colours are light pastels, so the icon on top uses a fixed dark
 * ink (not a theme token) to stay readable in both light and dark mode.
 */
export function CategoryBadge({
  category,
  size = "md",
  fallbackColor,
}: {
  category: Pick<Category, "icon" | "color">;
  size?: "sm" | "md" | "lg";
  fallbackColor?: string | null;
}) {
  const dims = size === "lg" ? "size-12 text-2xl" : size === "md" ? "size-9 text-lg" : "size-7 text-sm";
  const icon = size === "lg" ? "size-6" : size === "md" ? "size-4.5" : "size-3.5";
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-full text-[#1f2937]", dims)}
      style={{ backgroundColor: category.color || fallbackColor || "#E7E5E4" }}
    >
      <CategoryIcon icon={category.icon} className={icon} />
    </span>
  );
}

/**
 * Full-height category chooser opened from the quick-add sheet. Replaces the
 * old dropdown, whose 28px rows and indented sub-items were hard to hit:
 * big tiles, a search box, recent picks, and sub-categories one tap away.
 * Rendered as a nested vaul drawer so it stacks on the quick-add sheet.
 */
export function CategoryPicker({
  open,
  onOpenChange,
  categories,
  recent,
  selectedId,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Parent categories of the current kind, each with its subcategories. */
  categories: HierarchicalCategory[];
  /** Most-used categories (parents or subs), best first. */
  recent: Category[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [drillId, setDrillId] = React.useState<string | null>(null);

  // Reset on close so the next open starts at the top level.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setQuery("");
      setDrillId(null);
    }
    onOpenChange(next);
  };

  const parentOf = React.useMemo(() => {
    const map = new Map<string, HierarchicalCategory>();
    for (const p of categories) for (const s of p.subcategories) map.set(s.id, p);
    return map;
  }, [categories]);

  const pick = (id: string) => {
    onSelect(id);
    handleOpenChange(false);
  };

  const q = query.trim().toLowerCase();
  const results = React.useMemo(() => {
    if (!q) return [];
    const flat = categories.flatMap((p) => [p as Category, ...p.subcategories]);
    return flat.filter(
      (c) => c.name.toLowerCase().includes(q) || (parentOf.get(c.id)?.name.toLowerCase().includes(q) ?? false)
    );
  }, [q, categories, parentOf]);

  const drill = drillId ? categories.find((p) => p.id === drillId) ?? null : null;

  return (
    <DrawerPrimitive.NestedRoot open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="h-[85dvh] max-h-[85dvh] px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2 pt-3 pb-2">
          {drill && !q ? (
            <button
              type="button"
              onClick={() => setDrillId(null)}
              className="relative hit-area-44 -ml-1 grid size-9 place-items-center rounded-full hover:bg-muted"
              aria-label="Kembali ke semua kategori"
            >
              <ChevronLeft className="size-5" />
            </button>
          ) : null}
          <DrawerTitle className="flex-1 text-lg font-semibold">
            {drill && !q ? drill.name : "Pilih Kategori"}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            Cari atau pilih kategori untuk transaksi ini
          </DrawerDescription>
        </div>

        <label className="relative mb-3 block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari kategori…"
            aria-label="Cari kategori"
            className="h-12 w-full rounded-2xl border bg-muted/40 pl-11 pr-11 text-base outline-none [&::-webkit-search-cancel-button]:appearance-none focus:border-mint-strong focus:ring-2 focus:ring-mint-strong/20"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              aria-label="Hapus pencarian"
            >
              <X className="size-4" />
            </button>
          )}
        </label>

        <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4 pb-2">
          {q ? (
            results.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Tidak ada kategori &ldquo;{query}&rdquo;
              </p>
            ) : (
              <ul className="space-y-1.5">
                {results.map((c) => (
                  <li key={c.id}>
                    <CategoryRow
                      category={c}
                      parentName={parentOf.get(c.id)?.name}
                      fallbackColor={parentOf.get(c.id)?.color}
                      selected={c.id === selectedId}
                      onClick={() => pick(c.id)}
                    />
                  </li>
                ))}
              </ul>
            )
          ) : drill ? (
            <ul className="space-y-1.5">
              <li>
                <CategoryRow
                  category={drill}
                  label={`Semua ${drill.name}`}
                  hint="Tanpa sub-kategori"
                  selected={drill.id === selectedId}
                  onClick={() => pick(drill.id)}
                />
              </li>
              {drill.subcategories.map((s) => (
                <li key={s.id}>
                  <CategoryRow
                    category={s}
                    fallbackColor={drill.color}
                    selected={s.id === selectedId}
                    onClick={() => pick(s.id)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-5">
              {recent.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Sering dipakai
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {recent.map((c) => {
                      const selected = c.id === selectedId;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => pick(c.id)}
                          aria-pressed={selected}
                          className={cn(
                            "flex h-11 items-center gap-2 rounded-full border pl-1.5 pr-4 text-sm font-medium transition-colors active:scale-95",
                            selected ? "border-mint-strong bg-mint-soft text-mint-strong" : "bg-card hover:bg-muted"
                          )}
                        >
                          <CategoryBadge category={c} size="sm" fallbackColor={parentOf.get(c.id)?.color} />
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Semua kategori
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {categories.map((p) => {
                    const hasSubs = p.subcategories.length > 0;
                    const selected =
                      p.id === selectedId || p.subcategories.some((s) => s.id === selectedId);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => (hasSubs ? setDrillId(p.id) : pick(p.id))}
                        aria-pressed={selected}
                        aria-label={hasSubs ? `${p.name}, ${p.subcategories.length} sub-kategori` : p.name}
                        className={cn(
                          "relative flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 text-center transition-colors active:scale-95",
                          selected ? "border-mint-strong bg-mint-soft" : "bg-card hover:bg-muted"
                        )}
                      >
                        <CategoryBadge category={p} size="lg" />
                        <span className="line-clamp-2 text-xs font-semibold leading-tight text-foreground">
                          {p.name}
                        </span>
                        {hasSubs && (
                          <span className="absolute right-1.5 top-1.5 rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground tabular-nums">
                            {p.subcategories.length}
                          </span>
                        )}
                        {selected && (
                          <span className="absolute left-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-mint-strong text-on-mint">
                            <Check className="size-3" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
        </div>
      </DrawerContent>
    </DrawerPrimitive.NestedRoot>
  );
}

function CategoryRow({
  category,
  label,
  hint,
  parentName,
  fallbackColor,
  selected,
  onClick,
}: {
  category: Category;
  label?: string;
  hint?: string;
  parentName?: string;
  fallbackColor?: string | null;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-colors active:scale-[0.99]",
        selected ? "border-mint-strong bg-mint-soft" : "bg-card hover:bg-muted"
      )}
    >
      <CategoryBadge category={category} fallbackColor={fallbackColor} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{label ?? category.name}</span>
        {(hint || parentName) && (
          <span className="block truncate text-xs text-muted-foreground">{hint ?? parentName}</span>
        )}
      </span>
      {selected ? (
        <Check className="size-5 shrink-0 text-mint-strong" aria-hidden />
      ) : (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden />
      )}
    </button>
  );
}
