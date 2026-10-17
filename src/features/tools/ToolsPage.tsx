import { useEffect, useMemo, useState } from "react";
import {
  Braces,
  AppWindow,
  Code2,
  FileText,
  Image,
  MonitorCog,
  Search,
  Terminal,
  Wrench,
  Zap,
  Plug,
} from "lucide-react";
import { PageHeader, DemoNotice } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useServices } from "@/services";
import { useI18n } from "@/i18n";
import type { ToolCategory, ToolInfo } from "@/types";
import { cn } from "@/utils/cn";
import { formatNumber, formatRelative } from "@/utils/format";

const CATEGORY_ICONS: Record<ToolCategory, typeof Wrench> = {
  terminal: Terminal,
  files: FileText,
  browser: AppWindow,
  "computer-use": MonitorCog,
  code: Code2,
  search: Search,
  memory: Braces,
  media: Image,
  integrations: Plug,
};

const CATEGORY_LABEL: Record<ToolCategory, "tools.terminal" | "tools.files" | "tools.browser" | "tools.computerUse" | "tools.codeExec" | "tools.search" | "tools.memory" | "tools.media" | "tools.integrations"> = {
  terminal: "tools.terminal",
  files: "tools.files",
  browser: "tools.browser",
  "computer-use": "tools.computerUse",
  code: "tools.codeExec",
  search: "tools.search",
  memory: "tools.memory",
  media: "tools.media",
  integrations: "tools.integrations",
};

export default function ToolsPage() {
  const { t, locale } = useI18n();
  const services = useServices();
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ToolCategory | "all">("all");

  const load = () => {
    setLoading(true);
    services.tool
      .listTools()
      .then(setTools)
      .finally(() => setLoading(false));
  };

  useEffect(load, [services]);

  const grouped = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const map = new Map<ToolCategory, ToolInfo[]>();
    tools
      .filter((tool) => category === "all" || tool.category === category)
      .filter(
        (tool) =>
          !needle ||
          tool.name.toLowerCase().includes(needle) ||
          tool.description.toLowerCase().includes(needle) ||
          tool.nameAr.includes(needle),
      )
      .forEach((tool) => {
        const list = map.get(tool.category) ?? [];
        list.push(tool);
        map.set(tool.category, list);
      });
    return Array.from(map.entries());
  }, [tools, query, category]);

  const toggle = async (tool: ToolInfo) => {
    const updated = await services.tool.setEnabled(tool.id, !tool.enabled);
    setTools((current) => current.map((item) => (item.id === tool.id ? updated : item)));
  };

  return (
    <div className="mx-auto w-full max-w-[100rem]">
      <PageHeader title={t("tools.title")} description={t("tools.subtitle")} />

      <DemoNotice text={t("tools.demoNotice")} className="mb-5" />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="w-full sm:max-w-xs">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("common.search")}
            aria-label={t("common.search")}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={cn(
              "rounded-full border px-3 py-1 text-[0.75rem] font-medium transition-colors",
              category === "all"
                ? "border-accent bg-accent-soft text-accent"
                : "border-line bg-surface-2 text-muted hover:text-ink",
            )}
          >
            {t("common.all")}
          </button>
          {(Object.keys(CATEGORY_ICONS) as ToolCategory[]).map((key) => {
            const Icon = CATEGORY_ICONS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.75rem] font-medium transition-colors",
                  category === key
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line bg-surface-2 text-muted hover:text-ink",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {t(CATEGORY_LABEL[key])}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <EmptyState icon={<Wrench className="h-5 w-5" />} title={t("tools.noTools")} />
      ) : (
        <div className="space-y-6">
          {grouped.map(([group, items]) => {
            const Icon = CATEGORY_ICONS[group] ?? Wrench;
            return (
              <section key={group} aria-labelledby={`cat-${group}`}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 text-muted">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <h2 id={`cat-${group}`} className="text-[0.9375rem] font-semibold text-ink">
                    {t(CATEGORY_LABEL[group])}
                  </h2>
                  <span className="text-[0.75rem] text-subtle">{items.length}</span>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((tool) => (
                    <Card key={tool.id} className="flex flex-col">
                      <div className="flex items-start gap-3 p-5 pb-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-[0.8125rem] font-medium text-ink" dir="ltr">
                            {tool.name}
                          </p>
                          <p className="mt-0.5 truncate text-[0.75rem] text-subtle">
                            {locale === "ar" ? tool.nameAr : tool.name}
                          </p>
                        </div>
                        <Switch
                          checked={tool.enabled}
                          onChange={() => void toggle(tool)}
                          label={t("common.enable")}
                        />
                      </div>

                      <div className="flex-1 px-5">
                        <p className="text-[0.8125rem] leading-relaxed text-muted">
                          {locale === "ar" ? tool.descriptionAr : tool.description}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <Badge
                            variant={
                              tool.status === "ready"
                                ? "success"
                                : tool.status === "limited"
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {tool.status === "ready"
                              ? t("tools.ready")
                              : tool.status === "limited"
                                ? t("tools.limited")
                                : t("tools.disabled")}
                          </Badge>
                          {tool.requiresConfirmation ? (
                            <Badge variant="warning">{t("tools.requiresConfirmation")}</Badge>
                          ) : null}
                        </div>

                        <div className="mt-3">
                          <p className="text-[0.625rem] uppercase tracking-wide text-subtle">
                            {t("tools.permissions")}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {tool.permissions.map((permission) => (
                              <Badge key={permission} variant="outline">
                                {permission}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {tool.options.length > 0 ? (
                          <div className="mt-3">
                            <p className="text-[0.625rem] uppercase tracking-wide text-subtle">
                              {t("tools.options")}
                            </p>
                            <ul className="mt-1 space-y-0.5">
                              {tool.options.map((option) => (
                                <li
                                  key={option.id}
                                  className="flex items-center justify-between gap-2 font-mono text-[0.6875rem]"
                                >
                                  <span className="truncate text-muted">{option.label}</span>
                                  <span className="shrink-0 text-ink">{option.value}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-4 flex items-center gap-3 border-t border-line px-5 py-2.5 text-[0.6875rem] text-subtle">
                        <span className="flex items-center gap-1">
                          <Zap className="h-3 w-3" aria-hidden />
                          {t("tools.usage")}: {formatNumber(tool.usageCount, locale)}
                        </span>
                        <span className="ms-auto">
                          {tool.lastUsedAt
                            ? formatRelative(tool.lastUsedAt, locale)
                            : t("common.never")}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
