import { cn } from "@/utils/cn";

/** Custom Hermes mark — a winged glyph drawn with gradients, no external assets. */
export function HermesMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-[0.7rem] bg-gradient-to-br from-accent to-accent/70 text-accent-fg shadow-sm",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M12 3.2c1.9 0 3.4 1.5 3.4 3.4 0 .7-.2 1.4-.5 2 2.6.5 4.6 2.1 5.6 4.4-1.6-.7-3-1.6-4.1-2.8-.6 1.4-1.9 2.6-3.5 3.2v3.4c0 .5-.4.9-.9.9s-.9-.4-.9-.9v-3.4c-1.6-.6-2.9-1.8-3.5-3.2-1.1 1.2-2.5 2.1-4.1 2.8 1-2.3 3-3.9 5.6-4.4-.3-.6-.5-1.3-.5-2 0-1.9 1.5-3.4 3.4-3.4Z"
          fill="currentColor"
          fillOpacity="0.95"
        />
      </svg>
    </span>
  );
}
