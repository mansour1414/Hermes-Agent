import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { ChevronsLeft, ChevronsRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAV_ITEMS, NAV_SECTIONS } from "@/components/layout/navigation";
import { useI18n } from "@/i18n";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import { cn } from "@/utils/cn";
import { Tooltip } from "@/components/ui/Tooltip";
import { HermesMark } from "@/components/layout/HermesMark";

export function Sidebar() {
  const { t } = useI18n();
  const sidebar = useSettingsStore((state) => state.settings.sidebar);
  const toggleSidebar = useSettingsStore((state) => state.toggleSidebar);
  const mobileOpen = useUiStore((state) => state.mobileSidebarOpen);
  const setMobileOpen = useUiStore((state) => state.setMobileSidebarOpen);
  const collapsed = sidebar === "collapsed";

  useEffect(() => {
    if (!mobileOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [mobileOpen, setMobileOpen]);

  return (
    <>
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      ) : null}

      <aside
        data-state={mobileOpen ? "open" : "closed"}
        className={cn(
          "cc-sidebar fixed inset-y-0 start-0 z-50 flex w-[min(18rem,calc(100vw-2rem))] flex-col border-e border-line bg-canvas-alt shadow-[var(--shadow-float)] transition-[width,translate] duration-200 lg:static lg:shadow-none",
          collapsed ? "lg:w-[4.5rem]" : "lg:w-[16.5rem]",
        )}
        aria-label={t("nav.dashboard")}
      >
        <div className="flex h-16 shrink-0 items-center gap-2.5 px-4">
          <HermesMark className="h-8 w-8 shrink-0" />
          <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
              <p className="truncate text-[0.8125rem] font-semibold leading-tight text-ink">
                Hermes Control
              </p>
              <p className="truncate text-[0.6875rem] leading-tight text-subtle">Control Center</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-subtle hover:bg-surface-2 hover:text-ink lg:hidden"
            aria-label={t("common.close")}
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        <nav className="cc-scroll flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label={t("nav.primary")}>
          {NAV_SECTIONS.map((section) => {
            const items = NAV_ITEMS.filter((item) => item.section === section.id);
            if (items.length === 0) return null;
            return (
              <div key={section.id}>
                <div className={cn(collapsed && "lg:hidden")}>
                  <p className="mb-1.5 px-2.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-subtle">
                    {t(section.labelKey)}
                  </p>
                </div>
                {collapsed ? <div className="mx-auto mb-2 hidden h-px w-6 bg-line lg:block" aria-hidden /> : null}
                <ul className="space-y-0.5">
                  {items.map((item) => (
                    <li key={item.id}>
                      <Tooltip
                        content={t(item.labelKey)}
                        side="right"
                        className={collapsed ? "w-full" : "w-full"}
                      >
                        <NavLink
                          aria-label={t(item.labelKey)}
                          to={item.path}
                          end={item.path === "/"}
                          onClick={() => setMobileOpen(false)}
                          className={({ isActive }) =>
                            cn(
                              "group flex items-center gap-3 rounded-lg px-2.5 py-2 text-[0.8125rem] font-medium transition-colors",
                              collapsed && "lg:justify-center lg:px-0",
                              isActive
                                ? "bg-accent-soft text-accent"
                                : "text-muted hover:bg-surface-2 hover:text-ink",
                            )
                          }
                        >
                          <item.icon className="h-4.5 w-4.5 shrink-0" aria-hidden />
                          <span className={cn("truncate", collapsed && "lg:hidden")}>{t(item.labelKey)}</span>
                        </NavLink>
                      </Tooltip>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="hidden shrink-0 border-t border-line p-3 lg:block">
          <button
            type="button"
            onClick={toggleSidebar}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.8125rem] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink",
              collapsed && "justify-center px-0",
            )}
            aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4.5 w-4.5" aria-hidden />
            ) : (
              <>
                <ChevronsLeft className="h-4.5 w-4.5 rtl:hidden" aria-hidden />
                <ChevronsRight className="hidden h-4.5 w-4.5 rtl:block" aria-hidden />
                <span>{t("nav.collapse")}</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
