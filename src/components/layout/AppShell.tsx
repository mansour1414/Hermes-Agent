import { useEffect, type ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { DemoBanner } from "@/components/layout/DemoBanner";
import { Toaster } from "@/components/ui/Toast";
import { useHotkey } from "@/hooks/useHotkey";
import { useUiStore } from "@/stores/uiStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { useServices } from "@/services";
import { useSettingsStore } from "@/stores/settingsStore";
import { useI18n } from "@/i18n";
import { cn } from "@/utils/cn";

export function AppShell({ children }: { children: ReactNode }) {
  const setCommandPaletteOpen = useUiStore((state) => state.setCommandPaletteOpen);
  const setStatus = useConnectionStore((state) => state.setStatus);
  const services = useServices();
  const settings = useSettingsStore((state) => state.settings);
  const { locale } = useI18n();

  useHotkey({ key: "k", ctrl: true }, (event) => {
    event.preventDefault();
    setCommandPaletteOpen(true);
  });

  useEffect(() => {
    let cancelled = false;
    services.system
      .getConnectionStatus()
      .then((status) => {
        if (!cancelled) setStatus(status);
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({
            state: "error",
            message: "status.unknown",
            lastCheckedAt: new Date().toISOString(),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [services, setStatus]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <div className="flex min-h-screen bg-canvas">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[80] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:shadow-[var(--shadow-card)]"
      >
        {settings.locale === "ar" ? "تخطَّ إلى المحتوى" : "Skip to content"}
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <DemoBanner />
        <main id="main-content" className={cn("flex-1 px-4 py-5 sm:px-6 sm:py-6")}>
          {children}
        </main>
      </div>
      <CommandPalette />
      <Toaster />
    </div>
  );
}
