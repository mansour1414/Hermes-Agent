import { useId, useState, type ReactNode } from "react";
import { cn } from "@/utils/cn";

export function Tooltip({
  content,
  children,
  side = "top",
  className,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  const position = {
    top: "bottom-full start-1/2 -translate-x-1/2 mb-2 rtl:translate-x-1/2",
    bottom: "top-full start-1/2 -translate-x-1/2 mt-2 rtl:translate-x-1/2",
    left: "end-full top-1/2 -translate-y-1/2 me-2",
    right: "start-full top-1/2 -translate-y-1/2 ms-2",
  }[side];

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined}>{children}</span>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-50 w-max max-w-64 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[0.75rem] leading-relaxed text-ink shadow-[var(--shadow-card)] animate-[fade-in_0.12s_ease-out]",
            position,
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
