import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, PlugZap, ShieldCheck, Unplug } from "lucide-react";
import { PageHeader, DemoNotice } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Tooltip } from "@/components/ui/Tooltip";
import { useServices } from "@/services";
import { useI18n } from "@/i18n";
import { useUiStore } from "@/stores/uiStore";
import type { ProviderInfo } from "@/types";
import { formatRelative } from "@/utils/format";

const PROVIDER_MARKS: Record<string, string> = {
  "p-hermes": "H",
  "p-openrouter": "OR",
  "p-openai": "AI",
  "p-anthropic": "AN",
  "p-google": "G",
  "p-xai": "X",
  "p-mistral": "MI",
  "p-deepseek": "DS",
};

export default function ProvidersPage() {
  const { t, locale } = useI18n();
  const services = useServices();
  const pushToast = useUiStore((state) => state.pushToast);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [credentialFor, setCredentialFor] = useState<ProviderInfo | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    services.provider
      .listProviders()
      .then(setProviders)
      .finally(() => setLoading(false));
  };

  useEffect(load, [services]);

  const saveCredential = async () => {
    if (!credentialFor) return;
    if (apiKey.trim().length < 8) {
      setError(t("providers.credentialRequired"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await services.provider.saveCredential(credentialFor.id, apiKey);
      setApiKey("");
      setShowKey(false);
      setCredentialFor(null);
      load();
      pushToast({ title: t("providers.saveCredential"), variant: "success" });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async (provider: ProviderInfo) => {
    await services.provider.disconnect(provider.id);
    load();
    pushToast({ title: t("providers.disconnect"), description: provider.name, variant: "info" });
  };

  return (
    <div className="mx-auto w-full max-w-[90rem]">
      <PageHeader title={t("providers.title")} description={t("providers.subtitle")} />

      <DemoNotice text={t("providers.credentialHelp")} className="mb-5" />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : providers.length === 0 ? (
        <EmptyState title={t("providers.noProviders")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {providers.map((provider) => {
            const statusVariant =
              provider.status === "connected"
                ? "success"
                : provider.status === "error"
                  ? "danger"
                  : "neutral";
            return (
              <Card key={provider.id} className="flex flex-col">
                <CardHeader
                  title={
                    <span className="flex items-center gap-2.5">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-[0.6875rem] font-bold text-ink"
                        aria-hidden
                      >
                        {PROVIDER_MARKS[provider.id] ?? provider.name.slice(0, 2).toUpperCase()}
                      </span>
                      {provider.name}
                    </span>
                  }
                  description={provider.kind}
                  action={
                    <Badge variant={statusVariant} dot>
                      {provider.status === "connected"
                        ? t("providers.connected")
                        : provider.status === "error"
                          ? t("common.error")
                          : t("providers.notConfigured")}
                    </Badge>
                  }
                />
                <CardContent className="flex flex-1 flex-col gap-3">
                  <dl className="space-y-2 text-[0.75rem]">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-subtle">{t("providers.authStatus")}</dt>
                      <dd>
                        <Badge
                          variant={
                            provider.authStatus === "active"
                              ? "success"
                              : provider.authStatus === "expired"
                                ? "danger"
                                : provider.authStatus === "pending"
                                  ? "warning"
                                  : "neutral"
                          }
                        >
                          {provider.authStatus === "active"
                            ? t("providers.authActive")
                            : provider.authStatus === "expired"
                              ? t("providers.authExpired")
                              : provider.authStatus === "pending"
                                ? t("providers.authPending")
                                : t("providers.authNone")}
                        </Badge>
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-subtle">{t("providers.configuredModels")}</dt>
                      <dd className="tabular-nums text-ink">
                        {provider.configuredModels} / {provider.totalModels}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-subtle">{t("providers.baseUrl")}</dt>
                      <dd className="max-w-40 truncate font-mono text-[0.6875rem] text-ink" dir="ltr">
                        {provider.baseUrl}
                      </dd>
                    </div>
                    {provider.lastUsedAt ? (
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-subtle">{t("providers.lastUsed")}</dt>
                        <dd className="text-ink">{formatRelative(provider.lastUsedAt, locale)}</dd>
                      </div>
                    ) : null}
                  </dl>

                  <div>
                    <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-subtle">
                      {t("providers.supported")}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {provider.capabilities.map((capability) => (
                        <Badge key={capability} variant="outline">
                          {capability}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <p className="text-[0.75rem] leading-relaxed text-muted">{provider.notes}</p>

                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      leadingIcon={<KeyRound className="h-3.5 w-3.5" />}
                      onClick={() => {
                        setCredentialFor(provider);
                        setApiKey("");
                        setError("");
                      }}
                    >
                      {provider.authStatus === "active"
                        ? t("providers.editConfig")
                        : t("providers.addCredential")}
                    </Button>
                    <Tooltip content={t("providers.disconnectWarning")}>
                      <Button
                        size="sm"
                        variant="ghost"
                        leadingIcon={<Unplug className="h-3.5 w-3.5" />}
                        onClick={() => void disconnect(provider)}
                        disabled={provider.authStatus === "none"}
                      >
                        {t("providers.disconnect")}
                      </Button>
                    </Tooltip>
                    {provider.status === "connected" ? (
                      <span className="ms-auto flex items-center gap-1 text-[0.6875rem] text-success">
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                        {t("providers.connected")}
                      </span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={credentialFor !== null}
        onClose={() => setCredentialFor(null)}
        title={t("providers.credentialTitle")}
        description={credentialFor?.name}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCredentialFor(null)}>
              {t("common.cancel")}
            </Button>
            <Button loading={saving} onClick={() => void saveCredential()}>
              {t("providers.saveCredential")}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <DemoNotice text={t("providers.credentialHelp")} />
          <Field label={t("providers.apiKey")} htmlFor="provider-key" required error={error || undefined}>
            <div className="relative">
              <Input
                id="provider-key"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="sk-••••••••••••••••"
                className="pe-10 font-mono"
                dir="ltr"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowKey((value) => !value)}
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-subtle transition-colors hover:text-ink"
                aria-label={showKey ? t("providers.hide") : t("providers.reveal")}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          <p className="flex items-start gap-2 text-[0.6875rem] text-subtle">
            <PlugZap className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {t("settings.privacyHint")}
          </p>
        </div>
      </Modal>
    </div>
  );
}
