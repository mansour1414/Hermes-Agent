import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Code2,
  File,
  FileJson,
  FileText,
  Folder,
  Image as ImageIcon,
  Search,
  FileCode,
} from "lucide-react";
import { PageHeader, DemoNotice } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useServices } from "@/services";
import { useI18n } from "@/i18n";
import type { FileEntry, Project } from "@/types";
import { cn } from "@/utils/cn";
import { formatBytes, formatDateTime } from "@/utils/format";

function iconFor(file: FileEntry) {
  if (file.type === "folder") return Folder;
  if (file.extension === "json" || file.extension === "yaml" || file.extension === "yml") return FileJson;
  if (file.extension === "tsx" || file.extension === "ts" || file.extension === "css" || file.extension === "gradle") {
    return FileCode;
  }
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(file.extension)) return ImageIcon;
  if (file.extension === "md") return FileText;
  return File;
}

export default function FilesPage() {
  const { t, locale } = useI18n();
  const services = useServices();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState<FileEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([services.file.list(""), services.project.listProjects()])
      .then(([fileList, projectList]) => {
        if (cancelled) return;
        setFiles(fileList);
        setProjects(projectList);
        setSelected(fileList[0] ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [services]);

  const filtered = useMemo(() => {
    let list = files;
    if (projectFilter !== "all") list = list.filter((file) => file.projectId === projectFilter);
    if (typeFilter !== "all") list = list.filter((file) => file.extension === typeFilter);
    const needle = query.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (file) => file.name.toLowerCase().includes(needle) || file.path.toLowerCase().includes(needle),
      );
    }
    return list;
  }, [files, projectFilter, typeFilter, query]);

  const tree = useMemo(() => {
    const roots = new Map<string, FileEntry[]>();
    filtered.forEach((file) => {
      const root = file.path.split("/")[0];
      const list = roots.get(root) ?? [];
      list.push(file);
      roots.set(root, list);
    });
    return Array.from(roots.entries());
  }, [filtered]);

  const extensions = useMemo(
    () => Array.from(new Set(files.map((file) => file.extension))).filter(Boolean),
    [files],
  );

  return (
    <div className="mx-auto min-w-0 w-full max-w-[76rem]">
      <PageHeader title={t("files.title")} description={t("files.subtitle")} />

      <DemoNotice text={t("files.readOnlyNotice")} className="mb-5" />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="w-full sm:max-w-xs">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("files.searchPlaceholder")}
            leadingIcon={<Search className="h-4 w-4" />}
            aria-label={t("files.searchPlaceholder")}
          />
        </div>
        <Select
          value={projectFilter}
          onChange={(event) => setProjectFilter(event.target.value)}
          aria-label={t("files.project")}
          className="w-full sm:w-52"
        >
          <option value="all">{t("files.allProjects")}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {locale === "ar" ? project.nameAr : project.name}
            </option>
          ))}
        </Select>
        <Select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          aria-label={t("files.filter")}
          className="w-full sm:w-44"
        >
          <option value="all">{t("files.filter")}: {t("common.all")}</option>
          {extensions.map((extension) => (
            <option key={extension} value={extension}>
              .{extension}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <SkeletonRows rows={5} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <Card className="h-fit">
            <CardHeader title={t("files.tree")} icon={<Folder className="h-4 w-4" />} />
            <CardContent className="space-y-1">
              {tree.length === 0 ? (
                <EmptyState title={t("files.noFiles")} />
              ) : (
                tree.map(([root, items]) => (
                  <div key={root}>
                    <p className="flex items-center gap-1.5 px-1.5 py-1 text-[0.8125rem] font-medium text-ink">
                      <ChevronRight className="h-3.5 w-3.5 text-subtle" aria-hidden />
                      <Folder className="h-3.5 w-3.5 text-subtle" aria-hidden />
                      {root}
                    </p>
                    <ul className="space-y-0.5 ps-6">
                      {items.map((file) => {
                        const Icon = iconFor(file);
                        return (
                          <li key={file.id}>
                            <button
                              type="button"
                              onClick={() => setSelected(file)}
                              className={cn(
                                "flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-start text-[0.75rem] transition-colors",
                                selected?.id === file.id ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2",
                              )}
                            >
                              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              <span className="truncate">{file.name}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[1fr_18rem]">
            <Card className="overflow-hidden">
              <CardHeader title={t("files.list")} description={`${filtered.length} ${t("common.resultsCount")}`} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-start text-sm">
                  <thead className="border-y border-line bg-surface-2/60">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 text-start text-[0.75rem] font-semibold uppercase tracking-wide text-subtle">
                        {t("common.name")}
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-start text-[0.75rem] font-semibold uppercase tracking-wide text-subtle">
                        {t("files.type")}
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-start text-[0.75rem] font-semibold uppercase tracking-wide text-subtle">
                        {t("files.size")}
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-start text-[0.75rem] font-semibold uppercase tracking-wide text-subtle">
                        {t("files.modified")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filtered.map((file) => {
                      const Icon = iconFor(file);
                      return (
                        <tr
                          key={file.id}
                          className={cn(
                            "cursor-pointer transition-colors hover:bg-surface-2/60",
                            selected?.id === file.id && "bg-accent-soft/40",
                          )}
                          onClick={() => setSelected(file)}
                        >
                          <td className="px-4 py-2.5">
                            <span className="flex items-center gap-2">
                              <Icon className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
                              <span className="truncate text-[0.8125rem] text-ink">{file.name}</span>
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant="outline">.{file.extension}</Badge>
                          </td>
                          <td className="px-4 py-2.5 text-[0.8125rem] text-muted">
                            {formatBytes(file.size, locale)}
                          </td>
                          <td className="px-4 py-2.5 text-[0.8125rem] text-muted">
                            {formatDateTime(file.modifiedAt, locale)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="h-fit">
              <CardHeader title={t("files.preview")} icon={<Code2 className="h-4 w-4" />} />
              <CardContent className="space-y-3">
                {selected ? (
                  <>
                    <div>
                      <p className="truncate text-[0.875rem] font-semibold text-ink">{selected.name}</p>
                      <p className="truncate font-mono text-[0.6875rem] text-subtle" dir="ltr">
                        {selected.path}
                      </p>
                    </div>
                    {selected.content ? (
                      <pre className="cc-scroll max-h-80 overflow-auto rounded-lg border border-line bg-canvas-alt p-3 font-mono text-[0.6875rem] leading-relaxed text-ink" dir="ltr">
                        {selected.content}
                      </pre>
                    ) : (
                      <EmptyState title={t("files.selectFile")} />
                    )}
                  </>
                ) : (
                  <EmptyState title={t("files.selectFile")} />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
