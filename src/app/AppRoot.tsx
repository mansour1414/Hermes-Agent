import { I18nProvider } from "@/i18n";
import { ServicesProvider } from "@/services";
import { AppShell } from "@/components/layout/AppShell";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AppRoutes } from "@/app/routes";
import { useSettingsStore } from "@/stores/settingsStore";
import { useThemeEffect } from "@/stores/themeStore";

/**
 * Root composition without a router, so tests can mount the app inside a
 * `MemoryRouter` while production uses the `HashRouter` from `App.tsx`.
 */
export function AppRoot() {
  useThemeEffect();
  const locale = useSettingsStore((state) => state.settings.locale);

  return (
    <I18nProvider initialLocale={locale}>
      <ServicesProvider>
        <ErrorBoundary>
          <AppShell>
            <AppRoutes />
          </AppShell>
        </ErrorBoundary>
      </ServicesProvider>
    </I18nProvider>
  );
}
