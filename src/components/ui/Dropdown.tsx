import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/utils/cn";

export interface DropdownItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
}

export function Dropdown({
  trigger,
  items,
  align = "end",
  className,
}: {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: "start" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div onClick={() => setOpen((value) => !value)}>{trigger}</div>
      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-40 mt-2 w-max min-w-44 max-w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-[var(--shadow-float)] animate-[scale-in_0.14s_ease-out]",
            align === "end" ? "end-0" : "start-0",
          )}
        >
          {items.map((item) => (
            <div key={item.id}>
              {item.separatorBefore ? <div className="my-1 h-px bg-line" /> : null}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  "flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-start break-words text-[0.8125rem] transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  item.danger
                    ? "text-danger hover:bg-danger-soft"
                    : "text-ink hover:bg-surface-2",
                )}
              >
                {item.icon}
                {item.label}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
