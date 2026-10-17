import { useEffect, useState } from "react";
import {
  AlertOctagon,
  Camera,
  Keyboard,
  MonitorCog,
  MousePointer2,
  Play,
  ShieldCheck,
  Square,
  History,
} from "lucide-react";
import { PageHeader, DemoNotice } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useServices } from "@/services";
import { useI18n } from "@/i18n";
import { useUiStore } from "@/stores/uiStore";
import type { ComputerUseState } from "@/types";
import { formatRelative } from "@/utils/format";

export default function ComputerUsePage() {
  const { t, locale } = useI18n();
  const services = useServices();
  const pushToast = useUiStore((state) => state.pushToast);
  const [state, setState] = useState<ComputerUseState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);

  const load = () => {
    setLoading(true);
    services.computerUse
      .getState()
      .then(setState)
      .finally(() => setLoading(false));
  };

  useEffect(load, [services]);

  const start = async () => {
    setBusy(true);
    try {
      const next = await services.computerUse.startSession();
      setState(next);
      pushToast({ title: t("computerUse.started"), variant: "success" });
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      const next = await services.computerUse.stopSession();
      setState(next);
      setConfirmStop(false);
      pushToast({ title: t("computerUse.stopped"), variant: "info" });
    } finally {
      setBusy(false);
    }
  };

  const emergency = async () => {
    setBusy(true);
    try {
      const next = await services.computerUse.emergencyStop();
      setState(next);
      pushToast({ title: t("computerUse.emergencyToast"), variant: "warning" });
    } finally {
      setBusy(false);
    }
  };

  const grant = async (id: string, currently: boolean) => {
    const next = await services.computerUse.setPermission(id, !currently);
    setState(next);
  };

  return (
    <div className="mx-auto min-w-0 w-full max-w-[76rem]">
      <PageHeader
        title={t("computerUse.title")}
        description={t("computerUse.subtitle")}
        actions={
          state?.sessionActive ? (
            <>
              <Button variant="secondary" leadingIcon={<Square className="h-4 w-4" />} onClick={() => setConfirmStop(true)}>
                {t("computerUse.stop")}
              </Button>
              <Button variant="danger" leadingIcon={<AlertOctagon className="h-4 w-4" />} onClick={() => void emergency()}>
                {t("computerUse.emergencyStop")}
              </Button>
            </>
          ) : (
            <Button leadingIcon={<Play className="h-4 w-4" />} onClick={() => void start()} loading={busy}>
              {t("computerUse.start")}
            </Button>
          )
        }
      />

      <DemoNotice text={t("computerUse.unavailable")} className="mb-5" />

      {loading ? (
        <SkeletonRows rows={4} />
      ) : state ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title={t("computerUse.driverStatus")}
              icon={<MonitorCog className="h-4 w-4" />}
              action={
                <Badge variant={state.driverInstalled ? "success" : "warning"} dot>
                  {state.driverInstalled ? t("browser.installed") : t("computerUse.unavailable")}
                </Badge>
              }
            />
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <StatusRow
                icon={<Camera className="h-4 w-4" />}
                label={t("computerUse.screenCapture")}
                ok={state.screenCaptureAvailable}
              />
              <StatusRow icon={<MousePointer2 className="h-4 w-4" />} label={t("computerUse.mouse")} ok={state.mouseControl} />
              <StatusRow icon={<Keyboard className="h-4 w-4" />} label={t("computerUse.keyboard")} ok={state.keyboardControl} />
              <StatusRow
                icon={<ShieldCheck className="h-4 w-4" />}
                label={t("computerUse.activeSession")}
                ok={state.sessionActive}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader title={t("computerUse.lastActivity")} icon={<History className="h-4 w-4" />} />
            <CardContent>
              <p className="text-[0.8125rem] text-ink">
                {state.lastActivityAt ? formatRelative(state.lastActivityAt, locale) : t("common.never")}
              </p>
              {state.sessionStartedAt ? (
                <p className="mt-1 text-[0.75rem] text-subtle">
                  {t("computerUse.activeSession")}: {formatRelative(state.sessionStartedAt, locale)}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader title={t("computerUse.permissionManagement")} icon={<ShieldCheck className="h-4 w-4" />} />
            <CardContent className="space-y-2">
              {state.permissions.map((permission) => (
                <div
                  key={permission.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[0.8125rem] font-medium text-ink">{permission.label}</p>
                    <p className="truncate font-mono text-[0.6875rem] text-subtle" dir="ltr">
                      {permission.id}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={permission.granted ? "success" : "neutral"}>
                      {permission.granted ? t("computerUse.granted") : t("computerUse.denied")}
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={() => void grant(permission.id, permission.granted)}>
                      {permission.granted ? t("computerUse.revoke") : t("computerUse.grant")}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title={t("computerUse.history")} icon={<History className="h-4 w-4" />} />
            <CardContent className="space-y-2">
              {state.history.length === 0 ? (
                <EmptyState title={t("dashboard.noActivity")} />
              ) : (
                <ul className="space-y-2">
                  {state.history.map((entry) => (
                    <li key={entry.id} className="rounded-lg border border-line bg-surface-2 p-2.5">
                      <p className="text-[0.8125rem] font-medium text-ink">{entry.action}</p>
                      <p className="mt-0.5 text-[0.6875rem] text-muted">{entry.result}</p>
                      <p className="mt-0.5 text-[0.6875rem] text-subtle">
                        {formatRelative(entry.at, locale)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmStop}
        onClose={() => setConfirmStop(false)}
        onConfirm={() => void stop()}
        title={t("computerUse.confirmTitle")}
        body={t("computerUse.confirmBody")}
        confirmLabel={t("computerUse.stop")}
        destructive
      />
    </div>
  );
}

function StatusRow({
  icon,
  label,
  ok,
}: {
  icon: React.ReactNode;
  label: string;
  ok: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
      <span className="text-subtle">{icon}</span>
      <span className="flex-1 text-[0.8125rem] text-ink">{label}</span>
      <Badge variant={ok ? "success" : "neutral"}>{ok ? t("tools.ready") : t("computerUse.unavailable")}</Badge>
    </div>
  );
}
