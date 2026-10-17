import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Columns3,
  Cpu,
  Download,
  Eye,
  GitBranch,
  Heart,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { PageHeader, DemoNotice } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Input";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { Tooltip } from "@/components/ui/Tooltip";
import { useServices } from "@/services";
import { useI18n } from "@/i18n";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import type { ModelInfo } from "@/types";
import { cn } from "@/utils/cn";
import { formatNumber, formatRelative } from "@/utils/format";

type ModelFilter =
  | "all"
  | "hermes"
  | "opencode"
  | "free"
  | "paid"
  | "favorites"
  | "fallback";

export default function ModelsPage() {
  const { t, locale } = useI18n();
  const services = useServices();
  const defaultModelId = useSettingsStore((state) => state.settings.defaultModelId);
  const setSetting = useSettingsStore((state) => state.setSetting);
  const pushToast = useUiStore((state) => state.pushToast);

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ModelFilter>("all");
  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "price" | "context">("name");
  const [detail, setDetail] = useState<ModelInfo | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void services.model
      .listModels()
      .then((list) => {
        if (!cancelled) setModels(list);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [services]);

  const providers = useMemo(
    () => Array.from(new Set(models.map((model) => model.providerName))),
    [models],
  );

  const filtered = useMemo(() => {
    let list = models;
    if (filter === "hermes") list = list.filter((model) => model.source === "hermes");
    if (filter === "opencode") list = list.filter((model) => model.source === "opencode");
    if (filter === "free") list = list.filter((model) => model.pricing === "free");
    if (filter === "paid") list = list.filter((model) => model.pricing === "paid");
    if (filter === "favorites") list = list.filter((model) => model.favorite);
    if (filter === "fallback") list = list.filter((model) => model.inFallbackChain);
    if (providerFilter !== "all") list = list.filter((model) => model.providerName === providerFilter);

    const needle = query.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (model) =>
          model.name.toLowerCase().includes(needle) ||
          model.modelId.toLowerCase().includes(needle) ||
          model.providerName.toLowerCase().includes(needle) ||
          model.tags.some((tag) => tag.toLowerCase().includes(needle)),
      );
    }

    return [...list].sort((a, b) => {
      if (sortBy === "price") return a.inputPrice + a.outputPrice - (b.inputPrice + b.outputPrice);
      if (sortBy === "context") return b.contextWindow - a.contextWindow;
      return a.name.localeCompare(b.name);
    });
  }, [models, filter, providerFilter, query, sortBy]);

  const setPrimary = async (model: ModelInfo) => {
    await services.model.setActiveModel(model.id);
    setSetting("defaultModelId", model.id);
    setModels((current) => current.map((item) => (item.id === model.id ? model : item)));
    pushToast({ title: t("models.setAsPrimary"), description: model.name, variant: "success" });
  };

  const toggleFavorite = async (model: ModelInfo) => {
    await services.model.setFavorite(model.id, !model.favorite);
    setModels((current) =>
      current.map((item) => (item.id === model.id ? { ...item, favorite: !item.favorite } : item)),
    );
  };

  const toggleFallback = async (model: ModelInfo) => {
    const next = model.inFallbackChain
      ? models.filter((item) => item.inFallbackChain && item.id !== model.id).map((item) => item.id)
      : [...models.filter((item) => item.inFallbackChain).map((item) => item.id), model.id];
    await services.model.setFallbackChain(next);
    setModels((current) =>
      current.map((item) => ({
        ...item,
        inFallbackChain: next.includes(item.id),
      })),
    );
    pushToast({ title: t("models.addedToChain"), description: model.name, variant: "info" });
  };

  const tabs: TabItem[] = [
    { id: "all", label: t("models.allModels"), badge: <Badge variant="neutral">{models.length}</Badge> },
    { id: "hermes", label: t("models.hermesModels"), badge: <Badge variant="neutral">{models.filter((m) => m.source === "hermes").length}</Badge> },
    { id: "opencode", label: t("models.openCodeModels"), badge: <Badge variant="neutral">{models.filter((m) => m.source === "opencode").length}</Badge> },
    { id: "free", label: t("models.freeModels"), badge: <Badge variant="neutral">{models.filter((m) => m.pricing === "free").length}</Badge> },
    { id: "paid", label: t("models.paidModels"), badge: <Badge variant="neutral">{models.filter((m) => m.pricing === "paid").length}</Badge> },
    { id: "favorites", label: t("models.favorites"), badge: <Badge variant="neutral">{models.filter((m) => m.favorite).length}</Badge> },
    { id: "fallback", label: t("models.fallback"), badge: <Badge variant="neutral">{models.filter((m) => m.inFallbackChain).length}</Badge> },
  ];

  const comparedModels = models.filter((model) => compare.includes(model.id));

  return (
    <div className="mx-auto w-full max-w-[100rem]">
      <PageHeader
        title={t("models.title")}
        description={t("models.subtitle")}
        actions={
          <>
            <Button
              variant="secondary"
              leadingIcon={<Columns3 className="h-4 w-4" />}
              onClick={() => setCompareOpen(true)}
              disabled={compare.length < 2}
            >
              {t("models.compare")} ({compare.length})
            </Button>
            <Button variant="secondary" leadingIcon={<Download className="h-4 w-4" />}>
              {t("common.export")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row">
            <div className="w-full sm:max-w-xs">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("projects.search")}
                leadingIcon={<Search className="h-4 w-4" />}
                aria-label={t("common.search")}
              />
            </div>
            <Select
              value={providerFilter}
              onChange={(event) => setProviderFilter(event.target.value)}
              aria-label={t("models.provider")}
              className="w-full sm:w-44"
            >
              <option value="all">{t("models.provider")}: {t("common.all")}</option>
              {providers.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </Select>
            <Select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as "name" | "price" | "context")}
              aria-label={t("common.sortBy")}
              className="w-full sm:w-44"
            >
              <option value="name">{t("common.sortBy")}: {t("models.modelName")}</option>
              <option value="price">{t("common.sortBy")}: {t("models.pricing")}</option>
              <option value="context">{t("common.sortBy")}: {t("models.contextWindow")}</option>
            </Select>
          </div>
        </div>
      </PageHeader>

      {!loading && !models.some((model) => model.source === "opencode") ? (
        <DemoNotice text={t("models.opencodeNotice")} className="mb-4" />
      ) : null}

      <Tabs items={tabs} value={filter} onChange={(value) => setFilter(value as ModelFilter)} className="mb-4" />

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-4">
            <SkeletonRows rows={6} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState title={t("models.noModels")} description={t("models.emptyBody")} />
          </div>
        ) : (
          <Table>
            <THead>
              <TH className="w-10">
                <span className="sr-only">{t("models.compare")}</span>
              </TH>
              <TH>{t("models.modelName")}</TH>
              <TH>{t("models.modelId")}</TH>
              <TH>{t("models.provider")}</TH>
              <TH>{t("models.source")}</TH>
              <TH>{t("models.pricing")}</TH>
              <TH>{t("models.inputPrice")}</TH>
              <TH>{t("models.outputPrice")}</TH>
              <TH>{t("models.contextWindow")}</TH>
              <TH className="text-center">{t("models.reasoning")}</TH>
              <TH className="text-center">{t("models.vision")}</TH>
              <TH className="text-center">{t("models.toolCalling")}</TH>
              <TH>{t("models.status")}</TH>
              <TH className="w-28">
                <span className="sr-only">{t("common.actions")}</span>
              </TH>
            </THead>
            <TBody>
              {filtered.map((model) => (
                <TR key={model.id}>
                  <TD>
                    <input
                      type="checkbox"
                      checked={compare.includes(model.id)}
                      onChange={() =>
                        setCompare((current) =>
                          current.includes(model.id)
                            ? current.filter((id) => id !== model.id)
                            : [...current, model.id].slice(-2),
                        )
                      }
                      aria-label={t("models.compare")}
                      className="h-4 w-4 rounded border-line accent-[rgb(var(--cc-accent))]"
                    />
                  </TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDetail(model)}
                        className="flex items-center gap-2 text-start font-medium text-ink transition-colors hover:text-accent"
                      >
                        <Cpu className="h-4 w-4 text-subtle" aria-hidden />
                        {model.name}
                      </button>
                      {model.id === defaultModelId ? (
                        <Badge variant="accent">
                          <Star className="h-3 w-3" aria-hidden />
                          {t("models.primaryModel")}
                        </Badge>
                      ) : null}
                    </div>
                  </TD>
                  <TD className="font-mono text-[0.75rem] text-muted">{model.modelId}</TD>
                  <TD>{model.providerName}</TD>
                  <TD>
                    <Badge variant="outline">
                      {model.source === "hermes"
                        ? "Hermes"
                        : model.source === "opencode"
                          ? "OpenCode"
                          : "Catalog"}
                    </Badge>
                  </TD>
                  <TD>
                    <Badge variant={model.pricing === "free" ? "success" : "neutral"}>
                      {model.pricing === "free" ? t("models.freeModels") : t("models.paidModels")}
                    </Badge>
                  </TD>
                  <TD className="tabular-nums">
                    {model.pricing === "free" ? "—" : `$${model.inputPrice}`}
                  </TD>
                  <TD className="tabular-nums">
                    {model.pricing === "free" ? "—" : `$${model.outputPrice}`}
                  </TD>
                  <TD className="tabular-nums">{formatNumber(model.contextWindow, locale)}</TD>
                  <TD className="text-center">
                    <CapabilityDot enabled={model.capabilities.reasoning} />
                  </TD>
                  <TD className="text-center">
                    <CapabilityDot enabled={model.capabilities.vision} />
                  </TD>
                  <TD className="text-center">
                    <CapabilityDot enabled={model.capabilities.toolCalling} />
                  </TD>
                  <TD>
                    <Badge
                      variant={
                        model.status === "verified"
                          ? "success"
                          : model.status === "deprecated"
                            ? "warning"
                            : model.status === "available"
                              ? "neutral"
                              : "info"
                      }
                    >
                      {model.status === "verified"
                        ? t("models.verified")
                        : model.status === "configured"
                          ? t("models.configured")
                          : model.status === "authenticated"
                            ? t("models.authenticated")
                            : model.status === "deprecated"
                              ? t("models.deprecated")
                              : t("models.available")}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex items-center justify-end gap-0.5">
                      <Tooltip content={t("common.view")}>
                        <Button variant="ghost" size="icon-sm" onClick={() => setDetail(model)} aria-label={t("common.view")}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </Tooltip>
                      <Tooltip content={t("common.favorite")}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void toggleFavorite(model)}
                          aria-label={t("common.favorite")}
                        >
                          <Heart
                            className={cn("h-3.5 w-3.5", model.favorite && "fill-accent text-accent")}
                          />
                        </Button>
                      </Tooltip>
                      <Tooltip content={t("models.addFallback")}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void toggleFallback(model)}
                          aria-label={t("models.addFallback")}
                        >
                          <GitBranch className={cn("h-3.5 w-3.5", model.inFallbackChain && "text-accent")} />
                        </Button>
                      </Tooltip>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {/* Model details */}
      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ""}
        description={detail?.description}
        size="lg"
        footer={
          detail ? (
            <>
              <Button
                variant="secondary"
                leadingIcon={<GitBranch className="h-4 w-4" />}
                onClick={() => void toggleFallback(detail)}
              >
                {detail.inFallbackChain ? t("common.remove") : t("models.addFallback")}
              </Button>
              <Button leadingIcon={<Star className="h-4 w-4" />} onClick={() => void setPrimary(detail)}>
                {t("models.setPrimary")}
              </Button>
            </>
          ) : null
        }
      >
        {detail ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow label={t("models.modelId")} value={detail.modelId} mono />
              <InfoRow label={t("models.provider")} value={detail.providerName} />
              <InfoRow label={t("models.source")} value={detail.source} />
              <InfoRow label={t("models.releaseDate")} value={detail.releaseDate} />
              <InfoRow
                label={t("models.inputPrice")}
                value={detail.pricing === "free" ? t("models.freeModels") : `$${detail.inputPrice} / 1M`}
              />
              <InfoRow
                label={t("models.outputPrice")}
                value={detail.pricing === "free" ? t("models.freeModels") : `$${detail.outputPrice} / 1M`}
              />
              <InfoRow
                label={t("models.contextWindow")}
                value={`${formatNumber(detail.contextWindow, locale)} tokens`}
              />
              <InfoRow
                label={t("models.limits")}
                value={detail.rateLimitPerMinute ? `${detail.rateLimitPerMinute} rpm` : t("common.notAvailable")}
              />
            </div>

            <section>
              <h3 className="mb-2 text-[0.8125rem] font-semibold text-ink">{t("models.readiness")}</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <ReadinessRow label={t("models.catalogAvailable")} ok={detail.catalogAvailable} />
                <ReadinessRow label={t("models.configured")} ok={detail.configured} />
                <ReadinessRow label={t("models.authenticated")} ok={detail.authenticated} />
                <ReadinessRow label={t("models.verifiedWorking")} ok={detail.verified} />
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-[0.8125rem] font-semibold text-ink">{t("models.capabilities")}</h3>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(detail.capabilities).map(([key, enabled]) => (
                  <Badge key={key} variant={enabled ? "success" : "neutral"}>
                    {enabled ? <Check className="h-3 w-3" aria-hidden /> : <X className="h-3 w-3" aria-hidden />}
                    {key}
                  </Badge>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-[0.8125rem] font-semibold text-ink">{t("models.tags")}</h3>
              <div className="flex flex-wrap gap-1.5">
                {detail.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </section>

            {detail.releaseDate ? (
              <p className="text-[0.75rem] text-subtle">
                {t("models.released")}{" "}
                <time dateTime={detail.releaseDate}>{formatRelative(detail.releaseDate, locale)}</time>
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* Comparison */}
      <Modal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title={t("models.compareModels")}
        size="lg"
        footer={
          <Button variant="ghost" onClick={() => setCompareOpen(false)}>
            {t("common.close")}
          </Button>
        }
      >
        {comparedModels.length < 2 ? (
          <EmptyState
            icon={<Columns3 className="h-5 w-5" />}
            title={t("models.selectTwo")}
            description={t("models.subtitle")}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {comparedModels.map((model) => (
              <Card key={model.id} className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-accent" aria-hidden />
                  <p className="text-[0.875rem] font-semibold text-ink">{model.name}</p>
                </div>
                <dl className="space-y-1.5 text-[0.75rem]">
                  <CompareRow label={t("models.inputPrice")} value={model.pricing === "free" ? "—" : `$${model.inputPrice}`} />
                  <CompareRow label={t("models.outputPrice")} value={model.pricing === "free" ? "—" : `$${model.outputPrice}`} />
                  <CompareRow label={t("models.contextWindow")} value={formatNumber(model.contextWindow, locale)} />
                  <CompareRow label={t("models.reasoning")} value={model.capabilities.reasoning ? "✓" : "—"} />
                  <CompareRow label={t("models.vision")} value={model.capabilities.vision ? "✓" : "—"} />
                  <CompareRow label={t("models.toolCalling")} value={model.capabilities.toolCalling ? "✓" : "—"} />
                </dl>
              </Card>
            ))}
          </div>
        )}
      </Modal>

      {compare.length > 0 ? (
        <div className="sticky bottom-4 z-20 mx-auto mt-4 flex w-fit items-center gap-3 rounded-full border border-line bg-surface px-4 py-2 shadow-[var(--shadow-float)]">
          <Sparkles className="h-4 w-4 text-accent" aria-hidden />
          <span className="text-[0.75rem] text-muted">
            {compare.length} / 2 {t("models.compare")}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setCompare([])}>
            {t("common.clear")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function CapabilityDot({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-success-soft text-success">
      <Check className="h-3 w-3" aria-hidden />
    </span>
  ) : (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-surface-3 text-subtle">
      <X className="h-3 w-3" aria-hidden />
    </span>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-3 py-2">
      <p className="text-[0.6875rem] text-subtle">{label}</p>
      <p className={cn("mt-0.5 truncate text-[0.8125rem] font-medium text-ink", mono && "font-mono")}>{value}</p>
    </div>
  );
}

function ReadinessRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
      {ok ? (
        <Check className="h-4 w-4 text-success" aria-hidden />
      ) : (
        <X className="h-4 w-4 text-subtle" aria-hidden />
      )}
      <span className="text-[0.8125rem] text-ink">{label}</span>
    </div>
  );
}

function CompareRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-subtle">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
