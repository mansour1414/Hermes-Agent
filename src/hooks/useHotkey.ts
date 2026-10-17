import { useEffect } from "react";

type Handler = (event: KeyboardEvent) => void;

/** Registers a global hotkey such as Ctrl/Cmd + K. */
export function useHotkey(
  combo: { key: string; ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean },
  handler: Handler,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key !== combo.key.toLowerCase()) return;
      if (combo.ctrl && !event.ctrlKey) return;
      if (combo.meta && !event.metaKey) return;
      if (combo.shift && !event.shiftKey) return;
      if (combo.alt && !event.altKey) return;
      if (!combo.ctrl && !combo.meta && !event.shiftKey && !event.altKey) {
        // plain key: ignore when typing in inputs
        const target = event.target as HTMLElement | null;
        if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
        if (target?.isContentEditable) return;
      }
      handler(event);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [combo.key, combo.ctrl, combo.meta, combo.shift, combo.alt, enabled, handler]);
}
