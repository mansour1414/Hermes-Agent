import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 min-w-0 space-y-3 sm:mb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-snug text-ink sm:text-[1.375rem]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function DemoNotice({ text, className }: { text: string; className?: string }) {
  return (
    <div
      className={`rounded-lg border border-warning/25 bg-warning-soft px-3.5 py-2.5 text-[0.75rem] leading-relaxed text-warning ${className ?? ""}`}
    >
      {text}
    </div>
  );
}
