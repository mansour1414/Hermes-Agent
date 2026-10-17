import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="cc-scroll w-full overflow-x-auto">
      <table className={cn("w-full min-w-[44rem] border-collapse text-start text-sm", className)} {...props} />
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-line bg-surface-2/60">
      <tr>{children}</tr>
    </thead>
  );
}

export function TH({
  children,
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-4 py-2.5 text-start text-[0.75rem] font-semibold uppercase tracking-wide text-subtle",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-line">{children}</tbody>;
}

export function TR({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("transition-colors hover:bg-surface-2/60", className)} {...props}>
      {children}
    </tr>
  );
}

export function TD({
  children,
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-4 py-3 align-middle text-[0.8125rem] text-ink", className)} {...props}>
      {children}
    </td>
  );
}
