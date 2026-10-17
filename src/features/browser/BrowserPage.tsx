import { useEffect, useState } from "react";
import {
  Globe,
  HardDrive,
  Play,
  ShieldCheck,
  Square,
  Trash2,
  Settings2,
  Info,
  User,
} from "lucide-react";
import { PageHeader, DemoNotice } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useServices } from "@/services";
import { useI18n } from "@/i18n";
import { useUiStore } from "@/stores/uiStore";
import type { BrowserState } from "@/types";
import { formatRelative } from "@/utils/format";

export default function BrowserPage() {
  const { t, locale } = useI18n();
  const services = useServices();
  const pushToast = useUiStore((state) => state.pushToast);
  const [state, setState] = useState<BrowserState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    services.browser
      .getState()
      .then(setState)
      .finally(() => setLoading(false));
  };

  useEffect(load, [services]);

  const launch = async () => {
    setBusy(true);
    try {
      const next = await services.browser.launch();
      setState(next);
      pushToast({ title: t("browser.launched"), variant: "success" });
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    setBusy(true);
    try {
      const next = await services.browser.close();
      setState(next);
      pushToast({ title: t("browser.closedToast"), variant: "info" });
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      const next = await services.browser.clearSession();
      setState(next);
      pushToast({ title: t("browser.clearSession"), variant: "info" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto min-w-0 w-full max-w-[76rem]">
      <PageHeader
        title={t("browser.title")}
        description={t("browser.subtitle")}
        actions={
          state?.running ? (
            <Button variant="secondary" leadingIcon={<Square className="h-4 w-4" />} onClick={() => void close()} loading={busy}>
              {t("browser.close")}
            </Button>
          ) : (
            <Button leadingIcon={<Play className="h-4 w-4" />} onClick={() => void launch()} loading={busy}>
              {t("browser.launch")}
            </Button>
          )
        }
      />

      <DemoNotice text={t("browser.privacyNotice")} className="mb-5" />

      {loading ? (
        <SkeletonRows rows={4} />
      ) : state ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title={t("browser.status")}
              icon={<Globe className="h-4 w-4" />}
              action={
                <Badge variant={state.running ? "success" : "neutral"} dot>
                  {state.running ? t("browser.running") : t("browser.closed")}
                </Badge>
              }
            />
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <InfoRow icon={<Globe className="h-4 w-4" />} label={t("browser.engine")} value={state.engine} />
              <InfoRow icon={<HardDrive className="h-4 w-4" />} label={t("browser.storageLocation")} value={state.storageLocation} mono />
              <InfoRow icon={<User className="h-4 w-4" />} label={t("browser.currentProfile")} value="hermes-default" />
              <InfoRow
                icon={<ShieldCheck className="h-4 w-4" />}
                label={t("browser.persistence")}
                value={state.persistenceEnabled ? t("browser.persistent") : t("common.disabled")}
              />
              <InfoRow icon={<Settings2 className="h-4 w-4" />} label={t("browser.installed")} value={state.version} />
              <InfoRow icon={<HardDrive className="h-4 w-4" />} label={t("projects.path")} value={state.profilePath} mono />
            </CardContent>
          </Card>

          <Card>
            <CardHeader title={t("browser.sessions")} icon={<Globe className="h-4 w-4" />} />
            <CardContent className="space-y-3">
              {state.sessions.length === 0 ? (
                <EmptyState title={t("browser.noSessions")} description={t("browser.privacyNotice")} />
              ) : (
                <ul className="space-y-2">
                  {state.sessions.map((session) => (
                    <li key={session.id} className="rounded-lg border border-line bg-surface-2 p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[0.8125rem] font-medium text-ink">{session.profile}</span>
                        <Badge variant={session.state === "running" ? "success" : "neutral"}>
                          {session.state}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[0.6875rem] text-subtle">
                        {t("browser.startedAt")}: {formatRelative(session.startedAt, locale)}
                      </p>
                      <p className="mt-0.5 text-[0.6875rem] text-subtle">
                        {t("browser.pages")}: {session.pages.join(", ")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              <Button
                variant="ghost"
                className="w-full"
                leadingIcon={<Trash2 className="h-4 w-4" />}
                onClick={() => void clear()}
                disabled={state.sessions.length === 0}
              >
                {t("browser.clearSession")}
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader title={t("browser.settings")} icon={<Info className="h-4 w-4" />} />
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[0.8125rem] text-ink">{t("browser.persistence")}</span>
                <Switch checked={state.persistenceEnabled} onChange={() => undefined} label={t("browser.persistence")} />
              </div>
              <p className="text-[0.75rem] leading-relaxed text-muted">{state.isolationNote}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[0.6875rem] text-subtle">
        {icon}
        {label}
      </p>
      <p className={`mt-1 truncate text-[0.8125rem] font-medium text-ink ${mono ? "font-mono text-[0.75rem]" : ""}`} dir={mono ? "ltr" : undefined}>
        {value}
      </p>
    </div>
  );
}
