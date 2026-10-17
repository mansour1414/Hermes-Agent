import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-surface-2/50 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-3 text-subtle">
          {icon}
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-[0.8125rem] leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
