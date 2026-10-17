import { useEffect, useMemo, useState } from "react";
import { Download, Grid3x3, Heart, LayoutList, Search, Sparkles, Trash2, Wrench } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { Tooltip } from "@/components/ui/Tooltip";
import { useServices } from "@/services";
import { useI18n } from "@/i18n";
import { useUiStore } from "@/stores/uiStore";
import type { SkillInfo } from "@/types";
import { cn } from "@/utils/cn";
import { formatNumber, formatRelative } from "@/utils/format";

export default function SkillsPage() {
  const { t, locale } = useI18n();
  const services = useServices();
  const pushToast = useUiStore((state) => state.pushToast);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");

  const load = () => {
    setLoading(true);
    services.skill
      .listSkills()
      .then(setSkills)
      .catch((error) => pushToast({ title: t("common.error"), description: error instanceof Error ? error.message : String(error), variant: "error" }))
      .finally(() => setLoading(false));
  };

  useEffect(load, [services]);

  const categories = useMemo(
    () => Array.from(new Set(skills.map((skill) => skill.category))),
    [skills],
  );

  const filtered = useMemo(() => {
    let list = skills;
    if (category !== "all") list = list.filter((skill) => skill.category === category);
    if (status !== "all") list = list.filter((skill) => skill.status === status);
    const needle = query.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (skill) =>
          skill.name.toLowerCase().includes(needle) ||
          skill.nameAr.includes(needle) ||
          skill.description.toLowerCase().includes(needle) ||
          skill.descriptionAr.includes(needle),
      );
    }
    return list;
  }, [skills, category, status, query]);

  const toggleEnabled = async (skill: SkillInfo) => {
    const updated = await services.skill.setEnabled(skill.id, !skill.enabled);
    setSkills((current) => current.map((item) => (item.id === skill.id ? updated : item)));
    pushToast({
      title: updated.enabled ? t("skills.enabledToast") : t("skills.disabledToast"),
      description: skill.name,
      variant: "info",
    });
  };

  const install = async (skill: SkillInfo) => {
    try {
      const updated = await services.skill.install(skill.id);
      setSkills((current) => current.map((item) => (item.id === skill.id ? updated : item)));
      pushToast({ title: t("skills.installedToast"), description: skill.name, variant: "success" });
    } catch (error) {
      pushToast({ title: t("common.error"), description: error instanceof Error ? error.message : String(error), variant: "error" });
    }
  };

  const remove = async (skill: SkillInfo) => {
    try {
      await services.skill.remove(skill.id);
    setSkills((current) =>
      current.map((item) =>
        item.id === skill.id ? { ...item, status: "available", enabled: false } : item,
      ),
    );
    pushToast({ title: t("skills.removedToast"), variant: "info" });
    } catch (error) {
      pushToast({ title: t("common.error"), description: error instanceof Error ? error.message : String(error), variant: "error" });
    }
  };

  const toggleFavorite = async (skill: SkillInfo) => {
    const updated = await services.skill.setFavorite(skill.id, !skill.favorite);
    setSkills((current) => current.map((item) => (item.id === skill.id ? updated : item)));
  };

  return (
    <div className="mx-auto w-full max-w-[100rem]">
      <PageHeader title={t("skills.title")} description={t("skills.subtitle")} />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <div className="w-full sm:max-w-xs">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("skills.search")}
              leadingIcon={<Search className="h-4 w-4" />}
              aria-label={t("skills.search")}
            />
          </div>
          <Select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label={t("skills.categories")}
            className="w-full sm:w-44"
          >
            <option value="all">{t("skills.allCategories")}</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label={t("common.status")}
            className="w-full sm:w-44"
          >
            <option value="all">{t("common.status")}: {t("common.all")}</option>
            <option value="installed">{t("skills.installed")}</option>
            <option value="available">{t("skills.available")}</option>
            <option value="update-available">{t("skills.updateAvailable")}</option>
            <option value="disabled">{t("common.disabled")}</option>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[0.75rem] text-muted">
            {filtered.length} {t("common.resultsCount")}
          </span>
          <div className="flex rounded-lg border border-line bg-surface-2 p-0.5">
            <Tooltip content={t("skills.gridView")}>
              <button
                type="button"
                onClick={() => setView("grid")}
                aria-label={t("skills.gridView")}
                aria-pressed={view === "grid"}
                className={cn(
                  "rounded-md p-1.5 transition-colors",
                  view === "grid" ? "bg-surface text-ink shadow-sm" : "text-subtle hover:text-ink",
                )}
              >
                <Grid3x3 className="h-4 w-4" />
              </button>
            </Tooltip>
            <Tooltip content={t("skills.listView")}>
              <button
                type="button"
                onClick={() => setView("list")}
                aria-label={t("skills.listView")}
                aria-pressed={view === "list"}
                className={cn(
                  "rounded-md p-1.5 transition-colors",
                  view === "list" ? "bg-surface text-ink shadow-sm" : "text-subtle hover:text-ink",
                )}
              >
                <LayoutList className="h-4 w-4" />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Sparkles className="h-5 w-5" />} title={t("skills.noSkills")} />
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((skill) => (
            <Card key={skill.id} className="flex flex-col">
              <div className="flex items-start gap-3 p-5 pb-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <Sparkles className="h-4.5 w-4.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-[0.9375rem] font-semibold text-ink">
                      {locale === "ar" ? skill.nameAr : skill.name}
                    </h3>
                    <button
                      type="button"
                      onClick={() => void toggleFavorite(skill)}
                      aria-label={t("common.favorite")}
                      className="ms-auto"
                    >
                      <Heart
                        className={cn(
                          "h-4 w-4 transition-colors",
                          skill.favorite ? "fill-accent text-accent" : "text-subtle hover:text-ink",
                        )}
                      />
                    </button>
                  </div>
                  <p className="mt-0.5 font-mono text-[0.6875rem] text-subtle">{skill.name}</p>
                </div>
              </div>

              <div className="flex-1 px-5">
                <p className="line-clamp-2 text-[0.8125rem] leading-relaxed text-muted">
                  {locale === "ar" ? skill.descriptionAr : skill.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge variant="neutral">{skill.category}</Badge>
                  <Badge variant="outline">{skill.source}</Badge>
                  {skill.version ? <Badge variant="outline">v{skill.version}</Badge> : null}
                  {skill.status === "update-available" ? (
                    <Badge variant="warning">{t("skills.updateAvailable")}</Badge>
                  ) : null}
                </div>
                {skill.requiredTools.length > 0 ? (
                  <p className="mt-2 flex items-center gap-1.5 text-[0.6875rem] text-subtle">
                    <Wrench className="h-3 w-3" aria-hidden />
                    {t("skills.requires")}: {skill.requiredTools.join(", ")}
                  </p>
                ) : (
                  <p className="mt-2 text-[0.6875rem] text-subtle">{t("skills.noDependencies")}</p>
                )}
              </div>

              <div className="mt-4 flex items-center gap-2 border-t border-line px-5 py-3">
                {skill.status === "available" ? (
                  <Button size="sm" leadingIcon={<Download className="h-3.5 w-3.5" />} onClick={() => void install(skill)}>
                    {t("skills.install")}
                  </Button>
                ) : (
                  <>
                    <Switch
                      checked={skill.enabled}
                      onChange={() => void toggleEnabled(skill)}
                      label={t("common.enable")}
                    />
                    <span className="text-[0.75rem] text-muted">
                      {skill.enabled ? t("common.enabled") : t("common.disabled")}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ms-auto text-danger"
                      leadingIcon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={() => void remove(skill)}
                    >
                      {t("skills.remove")}
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {filtered.map((skill) => (
              <li key={skill.id} className="flex items-center gap-4 px-4 py-3">
                <Sparkles className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.875rem] font-medium text-ink">
                    {locale === "ar" ? skill.nameAr : skill.name}
                  </p>
                  <p className="truncate text-[0.75rem] text-subtle">
                    {locale === "ar" ? skill.descriptionAr : skill.description}
                  </p>
                </div>
                <div className="hidden shrink-0 items-center gap-4 text-[0.75rem] text-muted md:flex">
                  <span>
                    {t("skills.usage")}: {formatNumber(skill.usageCount, locale)}
                  </span>
                  <span className="w-28 text-end text-subtle">
                    {skill.lastUsedAt ? formatRelative(skill.lastUsedAt, locale) : t("common.never")}
                  </span>
                </div>
                <Switch
                  checked={skill.enabled}
                  onChange={() => void toggleEnabled(skill)}
                  label={t("common.enable")}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
