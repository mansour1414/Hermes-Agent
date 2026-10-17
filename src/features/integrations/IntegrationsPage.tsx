import { useEffect, useState } from "react";
import { Plug, PlugZap, Settings2, Unplug, Info } from "lucide-react";
import { PageHeader, DemoNotice } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useServices } from "@/services";
import { useI18n } from "@/i18n";
import { useUiStore } from "@/stores/uiStore";
import type { Integration } from "@/types";
import { formatRelative } from "@/utils/format";

const CATEGORY_LABEL: Record<Integration["category"], string> = {
  messaging: "integrations.messaging",
  git: "integrations.git",
  email: "integrations.email",
  storage: "integrations.storage",
  notes: "integrations.notes",
  webhooks: "integrations.webhooks",
};

export default function IntegrationsPage() {
  const { t, locale } = useI18n();
  const services = useServices();
  const pushToast = useUiStore((state) => state.pushToast);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsFor, setSettingsFor] = useState<Integration | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    services.integration
      .listIntegrations()
      .then(setIntegrations)
      .finally(() => setLoading(false));
  };

  useEffect(load, [services]);

  const connect = async (integration: Integration) => {
    setBusyId(integration.id);
    try {
      const updated = await services.integration.connect(integration.id);
      setIntegrations((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      pushToast({ title: t("integrations.connectedToast"), description: integration.name, variant: "success" });
    } finally {
      setBusyId(null);
    }
  };

  const disconnect = async (integration: Integration) => {
    setBusyId(integration.id);
    try {
      const updated = await services.integration.disconnect(integration.id);
      setIntegrations((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      pushToast({ title: t("integrations.disconnectedToast"), variant: "info" });
    } finally {
      setBusyId(null);
    }
  };

  const saveSettings = async () => {
    if (!settingsFor) return;
    const settings = settingsFor.settings.map((setting) => ({
      ...setting,
      value: draft[setting.id] ?? setting.value,
    }));
    const updated = await services.integration.saveSettings(settingsFor.id, settings);
    setIntegrations((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setSettingsFor(null);
    pushToast({ title: t("common.save"), variant: "success" });
  };

  return (
    <div className="mx-auto min-w-0 w-full max-w-[76rem]">
      <PageHeader title={t("integrations.title")} description={t("integrations.subtitle")} />

      <DemoNotice text={t("integrations.disclaimer")} className="mb-5" />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : integrations.length === 0 ? (
        <EmptyState icon={<Plug className="h-5 w-5" />} title={t("integrations.noIntegrations")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {integrations.map((integration) => (
            <Card key={integration.id} className="flex flex-col">
              <CardHeader
                title={
                  <span className="flex items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-[0.625rem] font-bold text-ink"
                      aria-hidden
                    >
                      {integration.iconHint}
                    </span>
                    {locale === "ar" ? integration.nameAr : integration.name}
                  </span>
                }
                description={t(CATEGORY_LABEL[integration.category] as never)}
                action={
                  <Badge variant={integration.connected ? "success" : "neutral"} dot>
                    {integration.connected ? t("integrations.connected") : t("integrations.disconnected")}
                  </Badge>
                }
              />
              <CardContent className="flex flex-1 flex-col gap-3">
                <p className="text-[0.8125rem] leading-relaxed text-muted">{integration.description}</p>

                <div>
                  <p className="mb-1 text-[0.625rem] uppercase tracking-wide text-subtle">
                    {t("integrations.requirements")}
                  </p>
                  <ul className="space-y-0.5">
                    {integration.requires.map((requirement) => (
                      <li key={requirement} className="flex items-start gap-1.5 text-[0.75rem] text-muted">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-subtle" aria-hidden />
                        {requirement}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="mb-1 text-[0.625rem] uppercase tracking-wide text-subtle">
                    {t("integrations.settings")}
                  </p>
                  <ul className="space-y-1">
                    {integration.settings.map((setting) => (
                      <li key={setting.id} className="flex items-center justify-between gap-2 text-[0.75rem]">
                        <span className="text-muted">{setting.label}</span>
                        <span
                          className="truncate font-mono text-[0.6875rem] text-ink"
                          dir="ltr"
                        >
                          {setting.value || "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {!integration.supportedByHermes ? (
                  <p className="flex items-center gap-1.5 text-[0.6875rem] text-warning">
                    <Info className="h-3.5 w-3.5" aria-hidden />
                    {t("integrations.disclaimer")}
                  </p>
                ) : null}

                {integration.lastSyncAt ? (
                  <p className="text-[0.6875rem] text-subtle">
                    {t("integrations.lastSync")}: {formatRelative(integration.lastSyncAt, locale)}
                  </p>
                ) : null}

                <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                  {integration.connected ? (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        leadingIcon={<Settings2 className="h-3.5 w-3.5" />}
                        onClick={() => {
                          setSettingsFor(integration);
                          setDraft(
                            Object.fromEntries(integration.settings.map((setting) => [setting.id, setting.value])),
                          );
                        }}
                      >
                        {t("integrations.configure")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        leadingIcon={<Unplug className="h-3.5 w-3.5" />}
                        onClick={() => void disconnect(integration)}
                        disabled={busyId === integration.id}
                      >
                        {t("integrations.disconnect")}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      leadingIcon={<PlugZap className="h-3.5 w-3.5" />}
                      onClick={() => void connect(integration)}
                      loading={busyId === integration.id}
                    >
                      {t("integrations.connect")}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={settingsFor !== null}
        onClose={() => setSettingsFor(null)}
        title={t("integrations.settings")}
        description={settingsFor?.name}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSettingsFor(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void saveSettings()}>{t("common.save")}</Button>
          </>
        }
      >
        <div className="space-y-4">
          {settingsFor?.settings.map((setting) => (
            <Field key={setting.id} label={setting.label} htmlFor={`integration-${setting.id}`}>
              <Input
                id={`integration-${setting.id}`}
                type={setting.type === "secret-ref" ? "password" : setting.type === "url" ? "url" : "text"}
                value={draft[setting.id] ?? setting.value}
                onChange={(event) => setDraft({ ...draft, [setting.id]: event.target.value })}
                dir="ltr"
              />
            </Field>
          ))}
        </div>
      </Modal>
    </div>
  );
}
