import { useEffect, useState } from "react";
import {
  Activity as ActivityIcon,
  AlertCircle,
  Bot,
  Boxes,
  Download,
  FolderPlus,
  Globe,
  Info,
  MessageSquare,
  RefreshCw,
  Search,
  Server,
  Sparkles,
  Plug,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useServices } from "@/services";
import { useI18n } from "@/i18n";
import { useUiStore } from "@/stores/uiStore";
import type { ActivityEvent, ActivityEventType } from "@/types";
import { cn } from "@/utils/cn";
import { formatDateTime, formatDuration, formatRelative } from "@/utils/format";

const EVENT_ICONS: Record<ActivityEventType, typeof ActivityIcon> = {
  "chat-started": MessageSquare,
  "model-changed": Bot,
  "tool-called": Plug,
  "mcp-connected": Server,
  "skill-enabled": Sparkles,
  "browser-session": Globe,
  "automation-executed": Boxes,
  error: AlertCircle,
  "project-created": FolderPlus,
  "provider-updated": RefreshCw,
};

const EVENT_LABEL: Record<ActivityEventType, string> = {
  "chat-started": "logs.chatStarted",
  "model-changed": "logs.modelChanged",
  "tool-called": "logs.toolCalled",
  "mcp-connected": "logs.mcpConnected",
  "skill-enabled": "logs.skillEnabled",
  "browser-session": "logs.browserSession",
  "automation-executed": "logs.automationExecuted",
  error: "logs.error",
  "project-created": "logs.projectCreated",
  "provider-updated": "logs.providerUpdated",
};

export default function ActivityPage() {
  const { t, locale } = useI18n();
  const services = useServices();
  const pushToast = useUiStore((state) => state.pushToast);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ActivityEventType | "all">("all");
  const [status, setStatus] = useState("all");

  const load = () => {
    setLoading(true);
    services.activity
      .listEvents({ type, status, search: query })
      .then(setEvents)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = window.setTimeout(load, 180);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, status, query]);

  const exportEvents = async () => {
    const json = await services.activity.exportEvents();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "hermes-activity.json";
    anchor.click();
    URL.revokeObjectURL(url);
    pushToast({ title: t("logs.exported"), variant: "success" });
  };

  return (
    <div className="mx-auto min-w-0 w-full max-w-[76rem]">
      <PageHeader
        title={t("logs.title")}
        description={t("logs.subtitle")}
        actions={
          <Button variant="secondary" leadingIcon={<Download className="h-4 w-4" />} onClick={() => void exportEvents()}>
            {t("logs.export")}
          </Button>
        }
      />

      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="w-full sm:max-w-xs">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("common.search")}
              leadingIcon={<Search className="h-4 w-4" />}
              aria-label={t("common.search")}
            />
          </div>
          <Select
            value={type}
            onChange={(event) => setType(event.target.value as ActivityEventType | "all")}
            aria-label={t("logs.filterByType")}
            className="w-full sm:w-52"
          >
            <option value="all">{t("logs.allEvents")}</option>
            {(Object.keys(EVENT_ICONS) as ActivityEventType[]).map((key) => (
              <option key={key} value={key}>
                {t(EVENT_LABEL[key] as never)}
              </option>
            ))}
          </Select>
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label={t("logs.filterByStatus")}
            className="w-full sm:w-40"
          >
            <option value="all">{t("logs.severity")}: {t("common.all")}</option>
            <option value="success">{t("logs.success")}</option>
            <option value="info">{t("logs.info")}</option>
            <option value="warning">{t("logs.warning")}</option>
            <option value="error">{t("logs.error")}</option>
          </Select>
          <Button
            variant="ghost"
            onClick={() => {
              setQuery("");
              setType("all");
              setStatus("all");
            }}
          >
            {t("logs.clearFilters")}
          </Button>
        </div>
      </Card>

      {loading ? (
        <SkeletonRows rows={6} />
      ) : events.length === 0 ? (
        <EmptyState icon={<ActivityIcon className="h-5 w-5" />} title={t("logs.noEvents")} />
      ) : (
        <Card className="overflow-hidden">
          <ol className="divide-y divide-line">
            {events.map((event) => {
              const Icon = EVENT_ICONS[event.type] ?? ActivityIcon;
              return (
                <li key={event.id} className="flex gap-3 p-4 transition-colors hover:bg-surface-2/50">
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      event.status === "error"
                        ? "bg-danger-soft text-danger"
                        : event.status === "warning"
                          ? "bg-warning-soft text-warning"
                          : event.status === "success"
                            ? "bg-success-soft text-success"
                            : "bg-info-soft text-info",
                    )}
                    aria-hidden
                  >
                    <Icon className="h-4 w-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[0.875rem] font-medium text-ink">
                        {t(EVENT_LABEL[event.type] as never)}
                      </p>
                      <Badge variant="outline">{event.actor}</Badge>
                      {event.target ? (
                        <span className="font-mono text-[0.6875rem] text-subtle" dir="ltr">
                          {event.target}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted">{event.description}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-[0.6875rem] text-subtle">
                      <span title={formatDateTime(event.timestamp, locale)}>
                        {formatRelative(event.timestamp, locale)}
                      </span>
                      {event.durationMs ? (
                        <span className="flex items-center gap-1">
                          <ActivityIcon className="h-3 w-3" aria-hidden />
                          {formatDuration(event.durationMs, locale)}
                        </span>
                      ) : null}
                      {event.demo ? <Badge variant="warning">{t("common.demo")}</Badge> : null}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      <p className="mt-4 flex items-center gap-2 text-[0.75rem] text-subtle">
        <Info className="h-3.5 w-3.5" aria-hidden />
        {t("activity.sourceNote")}
      </p>
    </div>
  );
}
