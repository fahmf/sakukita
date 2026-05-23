"use client";

import * as React from "react";
import { useHousehold, canEdit } from "@/components/providers/household-provider";
import { toast } from "sonner";

export function useCanEdit(): boolean {
  const { role } = useHousehold();
  return canEdit(role);
}

/**
 * Toast the "view only" warning. Call this when an attempted mutation
 * is blocked client-side.
 */
export function viewOnlyToast(): void {
  toast("Mode tampilan: kamu hanya bisa melihat data household ini.");
}

/**
 * Wraps a single interactive child. When the current role lacks edit
 * permission, the child is rendered with `disabled` + opacity, and clicks
 * surface a toast instead of firing the original handler.
 */
export function EditGuard({
  children,
  fallback,
}: {
  children: React.ReactElement;
  fallback?: React.ReactNode;
}) {
  const allowed = useCanEdit();
  if (allowed) return children;
  if (fallback !== undefined) return <>{fallback}</>;

  const child = children as React.ReactElement<
    React.HTMLAttributes<HTMLElement> & {
      disabled?: boolean;
      "aria-disabled"?: boolean;
      className?: string;
    }
  >;

  return React.cloneElement(child, {
    disabled: true,
    "aria-disabled": true,
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      viewOnlyToast();
    },
    className: `${child.props.className ?? ""} opacity-50 cursor-not-allowed`.trim(),
    title: "Hanya pengguna dengan peran admin/editor yang dapat mengubah data.",
  });
}
