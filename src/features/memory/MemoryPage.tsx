import { useEffect, useMemo, useState } from "react";
import { Brain, Pin, Plus, Save, Search, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, Field } from "@/components/ui/Input";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useServices } from "@/services";
import { useI18n } from "@/i18n";
import { useUiStore } from "@/stores/uiStore";
import type { MemoryItem } from "@/types";
import { cn } from "@/utils/cn";
import { formatRelative } from "@/utils/format";

export default function MemoryPage() {
  const { t, locale } = useI18n();
  const services = useServices();
  const pushToast = useUiStore((state) => state.pushToast);
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<MemoryItem | null>(null);
  const [editing, setEditing] = useState<MemoryItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MemoryItem | null>(null);
  const [form, setForm] = useState({ title: "", content: "", category: "general", importance: "medium" });

  const load = () => {
    setLoading(true);
    services.memory
      .listItems()
      .then((list) => {
        setItems(list);
        setSelected((current) => list.find((item) => item.id === current?.id) ?? list[0] ?? null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [services]);

  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category))),
    [items],
  );

  const filtered = useMemo(() => {
    let list = items;
    if (category !== "all") list = list.filter((item) => item.category === category);
    const needle = query.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(needle) ||
          item.content.toLowerCase().includes(needle) ||
          item.tags.some((tag) => tag.toLowerCase().includes(needle)),
      );
    }
    return list;
  }, [items, category, query]);

  const openEdit = (item: MemoryItem | null) => {
    setEditing(item ?? ({ id: "", title: "", content: "", category: "general", tags: [], importance: "medium", pinned: false, createdAt: "", updatedAt: "", source: "manual" } as MemoryItem));
    setForm({
      title: item?.title ?? "",
      content: item?.content ?? "",
      category: item?.category ?? "general",
      importance: item?.importance ?? "medium",
    });
  };

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    const saved = await services.memory.upsertItem({
      ...(editing?.id ? { id: editing.id } : {}),
      title: form.title,
      content: form.content,
      category: form.category,
      importance: form.importance as MemoryItem["importance"],
    });
    setItems((current) => {
      const exists = current.some((item) => item.id === saved.id);
      return exists ? current.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...current];
    });
    setSelected(saved);
    setEditing(null);
    pushToast({ title: t("memory.saved"), variant: "success" });
  };

  const remove = async () => {
    if (!confirmDelete) return;
    await services.memory.deleteItem(confirmDelete.id);
    setItems((current) => current.filter((item) => item.id !== confirmDelete.id));
    setSelected(null);
    setConfirmDelete(null);
  };

  return (
    <div className="mx-auto min-w-0 w-full max-w-[76rem]">
      <PageHeader
        title={t("memory.title")}
        description={t("memory.subtitle")}
        actions={
          <Button leadingIcon={<Plus className="h-4 w-4" />} onClick={() => openEdit(null)}>
            {t("memory.edit")}
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <MiniStat label={t("memory.stored")} value={items.length} icon={<Brain className="h-4 w-4" />} />
        <MiniStat label={t("memory.pinnedItems")} value={items.filter((item) => item.pinned).length} icon={<Pin className="h-4 w-4" />} />
        <MiniStat label={t("memory.categoriesCount")} value={categories.length} icon={<Search className="h-4 w-4" />} />
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="w-full sm:max-w-xs">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("memory.search")}
            leadingIcon={<Search className="h-4 w-4" />}
            aria-label={t("memory.search")}
          />
        </div>
        <Select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label={t("memory.categories")}
          className="w-full sm:w-48"
        >
          <option value="all">{t("memory.categories")}: {t("common.all")}</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <SkeletonRows rows={5} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <div className="p-5">
                  <EmptyState icon={<Brain className="h-5 w-5" />} title={t("memory.noMemories")} />
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {filtered.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(item)}
                        className={cn(
                          "flex w-full items-start gap-3 px-4 py-3 text-start transition-colors",
                          selected?.id === item.id ? "bg-accent-soft/50" : "hover:bg-surface-2",
                        )}
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[0.875rem] font-medium text-ink">{item.title}</p>
                          <p className="mt-0.5 line-clamp-1 text-[0.75rem] text-muted">{item.content}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {item.pinned ? <Pin className="h-3.5 w-3.5 text-accent" aria-hidden /> : null}
                          <Badge
                            variant={
                              item.importance === "high"
                                ? "danger"
                                : item.importance === "medium"
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {item.importance}
                          </Badge>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader title={t("memory.detail")} icon={<Brain className="h-4 w-4" />} />
            <CardContent className="space-y-3">
              {selected ? (
                <>
                  <div>
                    <p className="text-[0.9375rem] font-semibold text-ink">{selected.title}</p>
                    <p className="mt-1 whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-muted">
                      {selected.content}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="neutral">{selected.category}</Badge>
                    <Badge variant="outline">{selected.source}</Badge>
                    {selected.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-[0.6875rem] text-subtle">
                    {t("memory.updatedAt")}: {formatRelative(selected.updatedAt, locale)}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openEdit(selected)}>
                      {t("common.edit")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      leadingIcon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={() => setConfirmDelete(selected)}
                    >
                      {t("common.delete")}
                    </Button>
                  </div>
                </>
              ) : (
                <EmptyState title={t("memory.noMemories")} />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? t("memory.edit") : t("common.add")}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void save()} leadingIcon={<Save className="h-4 w-4" />}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t("common.name")} htmlFor="memory-title" required>
            <Input
              id="memory-title"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </Field>
          <Field label={t("common.description")} htmlFor="memory-content" required>
            <Textarea
              id="memory-content"
              value={form.content}
              onChange={(event) => setForm({ ...form, content: event.target.value })}
              rows={5}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("memory.categories")} htmlFor="memory-category">
              <Input
                id="memory-category"
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              />
            </Field>
            <Field label={t("memory.importance")} htmlFor="memory-importance">
              <Select
                id="memory-importance"
                value={form.importance}
                onChange={(event) => setForm({ ...form, importance: event.target.value })}
              >
                <option value="low">{t("memory.low")}</option>
                <option value="medium">{t("memory.medium")}</option>
                <option value="high">{t("memory.high")}</option>
              </Select>
            </Field>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => void remove()}
        title={t("memory.delete")}
        body={t("memory.deleteWarning")}
        confirmLabel={t("common.delete")}
        destructive
      />
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
        {icon}
      </span>
      <div>
        <p className="text-[0.6875rem] text-subtle">{label}</p>
        <p className="text-lg font-semibold text-ink">{value}</p>
      </div>
    </Card>
  );
}
