import { type ReactNode } from "react";
import { cn } from "@/utils/cn";

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
}

export function Tabs({
  items,
  value,
  onChange,
  className,
  variant = "underline",
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  variant?: "underline" | "pill";
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "cc-scroll flex gap-1 overflow-x-auto",
        variant === "underline" ? "border-b border-line" : "rounded-lg bg-surface-2 p-1",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-[0.8125rem] font-medium transition-colors",
              variant === "underline"
                ? cn(
                    "relative -mb-px border-b-2 px-3.5 py-2.5",
                    active
                      ? "border-accent text-ink"
                      : "border-transparent text-muted hover:border-line-strong hover:text-ink",
                  )
                : cn(
                    "rounded-md px-3 py-1.5",
                    active ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
                  ),
            )}
          >
            {item.icon}
            {item.label}
            {item.badge}
          </button>
        );
      })}
    </div>
  );
}
