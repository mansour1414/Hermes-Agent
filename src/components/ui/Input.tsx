import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

const fieldBase =
  "w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink transition-colors placeholder:text-subtle hover:border-line-strong focus:border-accent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-60";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: ReactNode;
  trailingSlot?: ReactNode;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leadingIcon, trailingSlot, invalid, ...props },
  ref,
) {
  if (leadingIcon || trailingSlot) {
    return (
      <div className="relative flex items-center">
        {leadingIcon ? (
          <span className="pointer-events-none absolute start-3 text-subtle">{leadingIcon}</span>
        ) : null}
        <input
          ref={ref}
          className={cn(
            fieldBase,
            "h-9.5",
            leadingIcon && "ps-9",
            trailingSlot && "pe-9",
            invalid && "border-danger focus:border-danger focus:ring-danger/25",
            className,
          )}
          aria-invalid={invalid || undefined}
          {...props}
        />
        {trailingSlot ? <span className="absolute end-2.5 text-subtle">{trailingSlot}</span> : null}
      </div>
    );
  }
  return (
    <input
      ref={ref}
      className={cn(fieldBase, "h-9.5", invalid && "border-danger focus:border-danger focus:ring-danger/25", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        fieldBase,
        "min-h-24 resize-y py-2 leading-relaxed",
        invalid && "border-danger focus:border-danger focus:ring-danger/25",
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});

export interface SelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        fieldBase,
        "h-9.5 appearance-none bg-[length:14px] bg-no-repeat pe-8",
        invalid && "border-danger focus:border-danger focus:ring-danger/25",
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888f9c' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
        backgroundPosition: "right 0.6rem center",
      }}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  );
});

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="flex items-center gap-1 text-[0.8125rem] font-medium text-ink">
        {label}
        {required ? (
          <span className="text-danger" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="text-[0.75rem] font-medium text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[0.75rem] text-subtle">{hint}</p>
      ) : null}
    </div>
  );
}
