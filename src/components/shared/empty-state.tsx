import type { LucideIcon } from "lucide-react";
import { BackButton } from "./back-button";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-mint-soft">
        <Icon className="size-7 text-mint-strong" />
      </span>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function PageHeading({
  title,
  subtitle,
  action,
  back,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Show a back arrow; the value is where it goes without in-app history. */
  back?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {back && <BackButton fallback={back} />}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}
