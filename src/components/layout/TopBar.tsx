import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronDown,
  Languages,
  Menu,
  Moon,
  Plus,
  Search,
  Sun,
  Check,
  Circle,
  PlugZap,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { NAV_ITEMS } from "@/components/layout/navigation";
import { Button } from "@/components/ui/Button";
import { Dropdown, type DropdownItem } from "@/components/ui/Dropdown";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/utils/cn";
import { formatRelative } from "@/utils/format";
import { ModelSwitcher } from "@/components/layout/ModelSwitcher";

export function TopBar() {
  const { t, locale, toggleLocale } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const settings = useSettingsStore((state) => state.settings);
  const toggleTheme = useSettingsStore((state) => state.toggleTheme);
  const setMobileSidebarOpen = useUiStore((state) => state.setMobileSidebarOpen);
  const setCommandPaletteOpen = useUiStore((state) => state.setCommandPaletteOpen);
  const connection = useConnectionStore((state) => state.status);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const current = useMemo(() => {
    const match = NAV_ITEMS.filter((item) => item.path !== "/").find((item) =>
      location.pathname.startsWith(item.path),
    );
    if (match) return { label: t(match.labelKey), path: match.path };
    if (location.pathname === "/") return { label: t("nav.dashboard"), path: "/" };
    const segments = location.pathname.split("/").filter(Boolean);
    return {
      label: segments.length ? segments[0].replace(/-/g, " ") : t("nav.dashboard"),
      path: location.pathname,
    };
  }, [location.pathname, t]);

  const themeItems: DropdownItem[] = [
    {
      id: "theme",
      label: settings.theme === "dark" ? t("settings.dark") : t("settings.light"),
      icon: settings.theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />,
      onSelect: toggleTheme,
    },
    {
      id: "lang",
      label: locale === "ar" ? "English" : "العربية",
      icon: <Languages className="h-4 w-4" />,
      onSelect: toggleLocale,
    },
  ];

  const connectionTone =
    connection.state === "connected"
      ? "text-success"
      : connection.state === "demo"
        ? "text-warning"
        : connection.state === "error"
          ? "text-danger"
          : "text-subtle";

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-line bg-canvas/85 px-3 backdrop-blur-xl sm:px-5">
      <button
        type="button"
        onClick={() => setMobileSidebarOpen(true)}
        className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink lg:hidden"
        aria-label="menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden min-w-0 flex-col sm:flex">
        <h1 className="truncate text-[0.9375rem] font-semibold capitalize leading-tight text-ink">
          {current.label}
        </h1>
        {current.path !== "/" ? (
          <nav aria-label="breadcrumb" className="text-[0.6875rem] text-subtle">
            <ol className="flex items-center gap-1.5">
              <li>
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="transition-colors hover:text-ink"
                >
                  {t("nav.dashboard")}
                </button>
              </li>
              <li aria-hidden>/</li>
              <li className="capitalize">{current.label}</li>
            </ol>
          </nav>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
        className="group mx-auto flex h-9 w-full max-w-md items-center gap-2.5 rounded-lg border border-line bg-surface-2 px-3 text-start text-[0.8125rem] text-subtle transition-colors hover:border-line-strong hover:bg-surface-3"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden truncate sm:block">{t("topbar.searchPlaceholder")}</span>
        <kbd className="ms-auto hidden shrink-0 rounded border border-line bg-surface px-1.5 py-0.5 font-sans text-[0.6875rem] text-subtle sm:block">
          Ctrl K
        </kbd>
      </button>

      <div className="flex shrink-0 items-center gap-1.5">
        <ModelSwitcher />

        <Tooltip content={t("topbar.newChat")}>
          <Button
            size="icon"
            variant="secondary"
            onClick={() => navigate("/chats?new=1")}
            aria-label={t("topbar.newChat")}
          >
            <Plus className="h-4.5 w-4.5" />
          </Button>
        </Tooltip>

        <Tooltip content={`${t("topbar.connection")} — ${connection.message}`}>
          <button
            type="button"
            onClick={() => navigate("/settings?tab=advanced")}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label={t("topbar.connection")}
          >
            <PlugZap className={cn("h-4.5 w-4.5", connectionTone)} aria-hidden />
          </button>
        </Tooltip>

        <div className="relative">
          <Tooltip content={t("topbar.notifications")}>
            <button
              type="button"
              onClick={() => setNotificationsOpen((value) => !value)}
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              aria-label={t("topbar.notifications")}
              aria-expanded={notificationsOpen}
            >
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute end-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            </button>
          </Tooltip>
          {notificationsOpen ? (
            <div className="absolute end-0 z-40 mt-2 w-72 rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-float)] animate-[scale-in_0.14s_ease-out]">
              <p className="text-[0.8125rem] font-semibold text-ink">{t("topbar.notifications")}</p>
              <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2.5 text-[0.75rem] leading-relaxed text-muted">
                {t("topbar.noNotifications")}
              </p>
              <p className="mt-2 text-[0.6875rem] text-subtle">
                {formatRelative(new Date().toISOString(), locale)}
              </p>
            </div>
          ) : null}
        </div>

        <Tooltip content={t("topbar.theme")}>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={t("topbar.theme")}
          >
            {settings.theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
          </Button>
        </Tooltip>

        <Dropdown
          align="end"
          trigger={
            <button
              type="button"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 text-[0.8125rem] font-medium text-ink transition-colors hover:bg-surface-3"
              aria-label={t("topbar.userMenu")}
            >
              <span className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-accent text-[0.625rem] font-bold text-accent-fg">
                HC
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-subtle" />
            </button>
          }
          items={[
            ...themeItems,
            {
              id: "settings",
              label: t("topbar.preferences"),
              icon: <Check className="h-4 w-4 opacity-0" />,
              onSelect: () => navigate("/settings"),
            },
            {
              id: "status",
              label: `${t("topbar.connection")}: ${connection.message}`,
              icon: <Circle className="h-4 w-4" />,
              onSelect: () => navigate("/settings?tab=advanced"),
            },
          ]}
        />
      </div>
    </header>
  );
}
