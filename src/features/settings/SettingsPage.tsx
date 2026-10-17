import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Check,
  Cpu,
  Database,
  HardDrive,
  Info,
  Palette,
  Plug,
  RotateCcw,
  Settings as SettingsIcon,
  Shield,
  Terminal,
  Wrench,
} from "lucide-react";
import { PageHeader, DemoNotice } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { Badge as StatusBadge } from "@/components/ui/Badge";
import { useI18n } from "@/i18n";
import { useSettingsStore, ACCENT_PRESETS } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import { useServices } from "@/services";
import type { ModelInfo } from "@/types";
import { cn } from "@/utils/cn";

export default function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const settings = useSettingsStore((state) => state.settings);
  const setSetting = useSettingsStore((state) => state.setSetting);
  const setNotification = useSettingsStore((state) => state.setNotification);
  const resetSettings = useSettingsStore((state) => state.resetSettings);
  const pushToast = useUiStore((state) => state.pushToast);
  const services = useServices();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [tab, setTab] = useState(searchParams.get("tab") ?? "general");
  const [connectionState, setConnectionState] = useState<"idle" | "testing" | "ok" | "failed">("idle");

  useEffect(() => {
    services.model
      .listModels()
      .then(setModels)
      .catch(() => undefined);
  }, [services]);

  useEffect(() => {
    const next = searchParams.get("tab");
    if (next && next !== tab) setTab(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const changeTab = (next: string) => {
    setTab(next);
    setSearchParams(next === "general" ? {} : { tab: next });
  };

  const tabs: TabItem[] = [
    { id: "general", label: t("settings.general"), icon: <SettingsIcon className="h-3.5 w-3.5" /> },
    { id: "appearance", label: t("settings.appearance"), icon: <Palette className="h-3.5 w-3.5" /> },
    { id: "ai", label: t("settings.ai"), icon: <Cpu className="h-3.5 w-3.5" /> },
    { id: "tools", label: t("settings.tools"), icon: <Wrench className="h-3.5 w-3.5" /> },
    { id: "privacy", label: t("settings.privacy"), icon: <Shield className="h-3.5 w-3.5" /> },
    { id: "storage", label: t("settings.storage"), icon: <HardDrive className="h-3.5 w-3.5" /> },
    { id: "advanced", label: t("settings.advanced"), icon: <Plug className="h-3.5 w-3.5" /> },
    { id: "about", label: t("settings.about"), icon: <Info className="h-3.5 w-3.5" /> },
  ];

  const testConnection = async () => {
    setConnectionState("testing");
    const status = await services.system.getConnectionStatus();
    setConnectionState(status.state === "connected" ? "ok" : "failed");
  };

  return (
    <div className="mx-auto w-full max-w-[70rem]">
      <PageHeader
        title={t("settings.title")}
        description={t("settings.subtitle")}
        actions={
          <Button
            variant="secondary"
            leadingIcon={<RotateCcw className="h-4 w-4" />}
            onClick={() => {
              resetSettings();
              pushToast({ title: t("settings.reset"), variant: "info" });
            }}
          >
            {t("settings.reset")}
          </Button>
        }
      />

      <DemoNotice text={t("settings.savedLocally")} className="mb-5" />

      <Tabs items={tabs} value={tab} onChange={changeTab} className="mb-5" variant="pill" />

      <div className="space-y-4">
        {tab === "general" ? (
          <>
            <Card>
              <CardHeader title={t("settings.general")} icon={<SettingsIcon className="h-4 w-4" />} />
              <CardContent className="space-y-5">
                <Field label={t("settings.language")} htmlFor="setting-language">
                  <Select
                    id="setting-language"
                    value={locale}
                    onChange={(event) => {
                      const next = event.target.value as "ar" | "en";
                      setLocale(next);
                      setSetting("locale", next);
                    }}
                  >
                    <option value="ar">العربية (RTL)</option>
                    <option value="en">English (LTR)</option>
                  </Select>
                </Field>

                <Field label={t("settings.theme")} htmlFor="setting-theme">
                  <div className="flex gap-2" id="setting-theme">
                    {(["light", "dark", "system"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setSetting("theme", option)}
                        aria-pressed={settings.theme === option}
                        className={cn(
                          "flex-1 rounded-lg border px-3 py-2 text-[0.8125rem] font-medium transition-colors",
                          settings.theme === option
                            ? "border-accent bg-accent-soft text-accent"
                            : "border-line bg-surface-2 text-muted hover:text-ink",
                        )}
                      >
                        {option === "light"
                          ? t("settings.light")
                          : option === "dark"
                            ? t("settings.dark")
                            : t("settings.system")}
                      </button>
                    ))}
                  </div>
                </Field>

                <div>
                  <p className="mb-2 text-[0.8125rem] font-medium text-ink">{t("topbar.notifications")}</p>
                  <div className="space-y-3">
                    <ToggleRow
                      label={t("topbar.notifications")}
                      hint={t("settings.notificationsHintDesktop")}
                      checked={settings.notifications.desktop}
                      onChange={(value) => setNotification("desktop", value)}
                    />
                    <ToggleRow
                      label={t("topbar.notifications")}
                      hint={t("settings.notificationsHintDigest")}
                      checked={settings.notifications.digest}
                      onChange={(value) => setNotification("digest", value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}

        {tab === "appearance" ? (
          <Card>
            <CardHeader title={t("settings.appearance")} description={t("settings.appearanceHint")} icon={<Palette className="h-4 w-4" />} />
            <CardContent className="space-y-5">
              <div>
                <p className="mb-2 text-[0.8125rem] font-medium text-ink">{t("settings.accent")}</p>
                <div className="flex flex-wrap gap-2">
                  {ACCENT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSetting("accent", preset.id)}
                      aria-pressed={settings.accent === preset.id}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-[0.8125rem] font-medium transition-colors",
                        settings.accent === preset.id
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-line bg-surface-2 text-muted hover:text-ink",
                      )}
                    >
                      <span
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: `rgb(${preset.light})` }}
                        aria-hidden
                      />
                      {preset.name}
                      {settings.accent === preset.id ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                    </button>
                  ))}
                </div>
              </div>

              <Field label={t("settings.fontSize")} htmlFor="setting-font">
                <div className="flex gap-2" id="setting-font">
                  {(["sm", "md", "lg"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSetting("fontSize", option)}
                      aria-pressed={settings.fontSize === option}
                      className={cn(
                        "flex-1 rounded-lg border px-3 py-2 text-[0.8125rem] font-medium transition-colors",
                        settings.fontSize === option
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-line bg-surface-2 text-muted hover:text-ink",
                      )}
                    >
                      {option === "sm" ? t("settings.sm") : option === "md" ? t("settings.md") : t("settings.lg")}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label={t("settings.density")} htmlFor="setting-density">
                <div className="flex gap-2" id="setting-density">
                  {(["comfortable", "compact"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSetting("density", option)}
                      aria-pressed={settings.density === option}
                      className={cn(
                        "flex-1 rounded-lg border px-3 py-2 text-[0.8125rem] font-medium transition-colors",
                        settings.density === option
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-line bg-surface-2 text-muted hover:text-ink",
                      )}
                    >
                      {option === "comfortable" ? t("settings.comfortable") : t("settings.compact")}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label={t("settings.sidebarMode")} htmlFor="setting-sidebar">
                <div className="flex gap-2" id="setting-sidebar">
                  {(["expanded", "collapsed"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSetting("sidebar", option)}
                      aria-pressed={settings.sidebar === option}
                      className={cn(
                        "flex-1 rounded-lg border px-3 py-2 text-[0.8125rem] font-medium transition-colors",
                        settings.sidebar === option
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-line bg-surface-2 text-muted hover:text-ink",
                      )}
                    >
                      {option === "expanded" ? t("settings.expanded") : t("settings.collapsed")}
                    </button>
                  ))}
                </div>
              </Field>

              <ToggleRow
                label={t("settings.animations")}
                hint={t("settings.appearanceHint")}
                checked={settings.animations}
                onChange={(value) => setSetting("animations", value)}
              />
            </CardContent>
          </Card>
        ) : null}

        {tab === "ai" ? (
          <Card>
            <CardHeader title={t("settings.ai")} icon={<Cpu className="h-4 w-4" />} />
            <CardContent className="space-y-5">
              <Field label={t("settings.defaultModel")} htmlFor="setting-model">
                <Select
                  id="setting-model"
                  value={settings.defaultModelId}
                  onChange={(event) => {
                    const nextModel = event.target.value;
                    void services.model.setActiveModel(nextModel)
                      .then(() => setSetting("defaultModelId", nextModel))
                      .catch((error) => pushToast({ title: t("common.error"), description: error instanceof Error ? error.message : String(error), variant: "error" }));
                  }}
                >
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} — {model.providerName}
                    </option>
                  ))}
                </Select>
              </Field>

              <div>
                <p className="mb-2 text-[0.8125rem] font-medium text-ink">{t("settings.fallbacks")}</p>
                <ul className="space-y-2">
                  {models
                    .filter((model) => model.inFallbackChain)
                    .map((model, index) => (
                      <li
                        key={model.id}
                        className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2"
                      >
                        <Badge variant="accent">{index + 1}</Badge>
                        <span className="flex-1 truncate text-[0.8125rem] text-ink">{model.name}</span>
                        <Badge variant={model.pricing === "free" ? "success" : "neutral"}>
                          {model.pricing === "free" ? t("models.freeModels") : t("models.paidModels")}
                        </Badge>
                      </li>
                    ))}
                </ul>
              </div>

              <Field label={t("settings.context")} htmlFor="setting-context">
                <Input
                  id="setting-context"
                  defaultValue="200000"
                  type="number"
                  readOnly
                  className="opacity-70"
                />
              </Field>
              <p className="text-[0.75rem] text-subtle">{t("settings.notImplemented")}</p>
            </CardContent>
          </Card>
        ) : null}

        {tab === "tools" ? (
          <Card>
            <CardHeader title={t("settings.tools")} icon={<Wrench className="h-4 w-4" />} />
            <CardContent className="space-y-4">
              <ToggleRow
                label={t("settings.permissions")}
                hint={t("settings.privacyHint")}
                checked={settings.sensitiveOpsConfirmation}
                onChange={(value) => setSetting("sensitiveOpsConfirmation", value)}
              />
              <div className="rounded-lg border border-line bg-surface-2 p-3">
                <p className="text-[0.8125rem] font-medium text-ink">{t("settings.browserSettings")}</p>
                <p className="mt-1 text-[0.75rem] text-muted">{t("browser.privacyNotice")}</p>
              </div>
              <div className="rounded-lg border border-line bg-surface-2 p-3">
                <p className="text-[0.8125rem] font-medium text-ink">{t("settings.computerUseSettings")}</p>
                <p className="mt-1 text-[0.75rem] text-muted">{t("computerUse.unavailable")}</p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {tab === "privacy" ? (
          <Card>
            <CardHeader title={t("settings.privacy")} icon={<Shield className="h-4 w-4" />} />
            <CardContent className="space-y-4">
              <ToggleRow
                label={t("settings.telemetry")}
                hint={t("settings.telemetryHint")}
                checked={settings.telemetry}
                onChange={(value) => setSetting("telemetry", value)}
              />
              <ToggleRow
                label={t("settings.confirmSensitive")}
                hint={t("settings.privacyHint")}
                checked={settings.sensitiveOpsConfirmation}
                onChange={(value) => setSetting("sensitiveOpsConfirmation", value)}
              />
              <Field label={t("settings.sessionStorage")} htmlFor="setting-storage-mode">
                <Select
                  id="setting-storage-mode"
                  value={settings.sessionStorage}
                  onChange={(event) => setSetting("sessionStorage", event.target.value as "memory" | "local")}
                >
                  <option value="memory">{t("settings.inMemory")}</option>
                  <option value="local">{t("settings.inLocal")}</option>
                </Select>
              </Field>
            </CardContent>
          </Card>
        ) : null}

        {tab === "storage" ? (
          <Card>
            <CardHeader title={t("settings.storage")} description={t("settings.storageHint")} icon={<HardDrive className="h-4 w-4" />} />
            <CardContent className="space-y-3">
              <PathRow icon={<HardDrive className="h-4 w-4" />} label={t("settings.hermesHome")} value={settings.hermesHome} />
              <PathRow icon={<Database className="h-4 w-4" />} label={t("settings.cache")} value={`${settings.hermesHome}\\cache`} />
              <PathRow icon={<FolderIcon />} label={t("settings.projectsDir")} value={`${settings.hermesHome}\\workspace`} />
              <PathRow icon={<Terminal className="h-4 w-4" />} label={t("settings.logsDir")} value={`${settings.hermesHome}\\logs`} />
              <p className="text-[0.75rem] text-subtle">{t("projects.pathNote")}</p>
            </CardContent>
          </Card>
        ) : null}

        {tab === "advanced" ? (
          <Card>
            <CardHeader title={t("settings.advanced")} icon={<Plug className="h-4 w-4" />} />
            <CardContent className="space-y-5">
              <Field label={t("settings.apiEndpoint")} htmlFor="setting-endpoint">
                <Input
                  id="setting-endpoint"
                  value={settings.apiEndpoint}
                  onChange={(event) => setSetting("apiEndpoint", event.target.value)}
                  className="font-mono"
                  dir="ltr"
                />
              </Field>

              <div className="flex items-center gap-3">
                <Button variant="secondary" onClick={() => void testConnection()} loading={connectionState === "testing"}>
                  {t("settings.testConnection")}
                </Button>
                {connectionState === "ok" ? (
                  <StatusBadge variant="success">{t("settings.connectionOk")}</StatusBadge>
                ) : null}
                {connectionState === "failed" ? (
                  <StatusBadge variant="warning">{t("settings.connectionFailed")}</StatusBadge>
                ) : null}
              </div>

              <ToggleRow
                label={t("settings.developerMode")}
                hint={t("settings.developerModeHint")}
                checked={settings.developerMode}
                onChange={(value) => setSetting("developerMode", value)}
              />
            </CardContent>
          </Card>
        ) : null}

        {tab === "about" ? (
          <Card>
            <CardHeader title={t("settings.about")} icon={<Info className="h-4 w-4" />} />
            <CardContent className="space-y-3">
              <AboutRow label={t("settings.version")} value="0.1.0 (demo)" />
              <AboutRow label={t("settings.build")} value="hermes-control-center / vite build" />
              <AboutRow label="Hermes" value="v0.22.2 (expected on the target device)" />
              <div>
                <p className="mb-1.5 text-[0.8125rem] font-medium text-ink">{t("settings.dependencies")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {["React 19", "TypeScript 5", "Vite 7", "Tailwind 4", "React Router 7", "Zustand", "Recharts", "Lucide", "React Hook Form + Zod"].map(
                    (dependency) => (
                      <Badge key={dependency} variant="outline">
                        {dependency}
                      </Badge>
                    ),
                  )}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[0.8125rem] font-medium text-ink">{t("settings.credits")}</p>
                <p className="text-[0.75rem] leading-relaxed text-muted">
                  Hermes Control Center — a frontend shell prepared for the Hermes agent runtime.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function FolderIcon() {
  return <HardDrive className="h-4 w-4" />;
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-line bg-surface-2 px-3.5 py-3">
      <div className="min-w-0">
        <p className="text-[0.8125rem] font-medium text-ink">{label}</p>
        {hint ? <p className="mt-0.5 text-[0.75rem] leading-relaxed text-muted">{hint}</p> : null}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function PathRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-3.5 py-3">
      <span className="text-subtle">{icon}</span>
      <span className="text-[0.8125rem] text-ink">{label}</span>
      <span className="ms-auto truncate font-mono text-[0.75rem] text-muted" dir="ltr">
        {value}
      </span>
    </div>
  );
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line pb-2 text-[0.8125rem] last:border-0">
      <span className="text-subtle">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}
