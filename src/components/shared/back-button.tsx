"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Back arrow for sub-pages reachable from more than one place (Lainnya,
 * Beranda cards, Pengaturan): returns to wherever the user came from, or to
 * `fallback` when the page was opened directly (no in-app history).
 */
export function BackButton({ fallback, className }: { fallback: string; className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      className={
        className ??
        "grid size-9 shrink-0 place-items-center rounded-full hover:bg-muted transition-colors"
      }
      aria-label="Kembali"
    >
      <ArrowLeft className="size-4" />
    </button>
  );
}
