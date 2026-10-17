import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { CornerDownLeft, Search, Sparkles, Plus, Moon, Languages } from "lucide-react";
import { useUiStore } from "@/stores/uiStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useI18n } from "@/i18n";
import { NAV_ITEMS } from "@/components/layout/navigation";
import { cn } from "@/utils/cn";

interface Command {
  id: string;
  label: string;
  group: string;
  icon: React.ReactNode;
  shortcut?: string;
  run: () => void;
}

export function CommandPalette() {
  const { t, locale, toggleLocale } = useI18n();
  const navigate = useNavigate();
  const open = useUiStore((state) => state.commandPaletteOpen);
  const setOpen = useUiStore((state) => state.setCommandPaletteOpen);
  const toggleTheme = useSettingsStore((state) => state.toggleTheme);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const pages: Command[] = NAV_ITEMS.map((item) => ({
      id: `nav-${item.id}`,
      label: t(item.labelKey),
      group: t("topbar.search"),
      icon: <item.icon className="h-4 w-4" />,
      run: () => navigate(item.path),
    }));

    const actions: Command[] = [
      {
        id: "action-new-chat",
        label: t("dashboard.actionNewChat"),
        group: t("common.actions"),
        icon: <Plus className="h-4 w-4" />,
        shortcut: "N",
        run: () => navigate("/chats?new=1"),
      },
      {
        id: "action-theme",
        label: t("topbar.theme"),
        group: t("common.actions"),
        icon: <Moon className="h-4 w-4" />,
        run: toggleTheme,
      },
      {
        id: "action-language",
        label: `${t("topbar.language")} — ${locale === "ar" ? "English" : "العربية"}`,
        group: t("common.actions"),
        icon: <Languages className="h-4 w-4" />,
        run: toggleLocale,
      },
    ];

    return [...pages, ...actions];
  }, [t, navigate, locale, toggleLocale, toggleTheme]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((command) => command.label.toLowerCase().includes(needle));
  }, [commands, query]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setIndex((value) => Math.min(value + 1, filtered.length - 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setIndex((value) => Math.max(value - 1, 0));
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const command = filtered[index];
        if (command) {
          command.run();
          setOpen(false);
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, filtered, index, setOpen]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]">
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px] animate-[fade-in_0.15s_ease-out]"
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("topbar.commandHint")}
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-float)] animate-[scale-in_0.16s_cubic-bezier(0.22,1,0.36,1)]"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("topbar.searchPlaceholder")}
            className="h-13 w-full bg-transparent text-sm text-ink outline-none placeholder:text-subtle"
            aria-label={t("topbar.search")}
          />
          <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[0.6875rem] text-subtle">
            ESC
          </kbd>
        </div>

        <div className="cc-scroll max-h-[22rem] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-[0.8125rem] text-muted">
              {t("logs.noEvents")}
            </p>
          ) : (
            filtered.map((command, commandIndex) => (
              <button
                key={command.id}
                type="button"
                onMouseEnter={() => setIndex(commandIndex)}
                onClick={() => {
                  command.run();
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start text-[0.8125rem] transition-colors",
                  commandIndex === index ? "bg-accent-soft text-accent" : "text-ink hover:bg-surface-2",
                )}
              >
                <span className="text-subtle">{command.icon}</span>
                <span className="flex-1 truncate">{command.label}</span>
                {command.shortcut ? (
                  <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[0.6875rem] text-subtle">
                    {command.shortcut}
                  </kbd>
                ) : null}
                {commandIndex === index ? (
                  <CornerDownLeft className="h-3.5 w-3.5 text-subtle" aria-hidden />
                ) : null}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line bg-surface-2/50 px-4 py-2 text-[0.6875rem] text-subtle">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            {t("commandPalette.brand")}
          </span>
          <span>↑↓ {t("common.next")} · ↵ {t("common.confirm")}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
