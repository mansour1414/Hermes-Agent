import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Book,
  Bot,
  Boxes,
  Code2,
  Database,
  FlaskConical,
  FolderKanban,
  Grid3x3,
  LayoutList,
  MessageSquare,
  Plus,
  Rocket,
  Search,
  Sparkles,
  SquareStack,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Tooltip } from "@/components/ui/Tooltip";
import { useServices } from "@/services";
import { useI18n } from "@/i18n";
import type { Project, ProjectIcon } from "@/types";
import { cn } from "@/utils/cn";
import { formatRelative } from "@/utils/format";
import { ProjectFormDialog } from "@/features/projects/ProjectFormDialog";

const ICONS: Record<ProjectIcon, typeof Rocket> = {
  rocket: Rocket,
  code: Code2,
  sparkles: Sparkles,
  database: Database,
  book: Book,
  flask: FlaskConical,
  cube: Boxes,
  bolt: Zap,
};

export const PROJECT_ICON_OPTIONS = Object.keys(ICONS) as ProjectIcon[];

export const PROJECT_COLORS = [
  "#0d9488",
  "#6366f1",
  "#f59e0b",
  "#ec4899",
  "#0ea5e9",
  "#8b5cf6",
  "#ef4444",
  "#22c55e",
];

export default function ProjectsPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const services = useServices();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = () => {
    setLoading(true);
    services.project
      .listProjects()
      .then(setProjects)
      .finally(() => setLoading(false));
  };

  useEffect(load, [services]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(needle) ||
        project.nameAr.includes(needle) ||
        project.description.toLowerCase().includes(needle) ||
        project.path.toLowerCase().includes(needle),
    );
  }, [projects, query]);

  return (
    <div className="mx-auto w-full max-w-[100rem]">
      <PageHeader
        title={t("projects.title")}
        description={t("projects.subtitle")}
        actions={
          <Button leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setDialogOpen(true)}>
            {t("projects.newProject")}
          </Button>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-xs">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("projects.search")}
              leadingIcon={<Search className="h-4 w-4" />}
              aria-label={t("projects.search")}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[0.75rem] text-muted">
              {filtered.length} {t("common.resultsCount")}
            </span>
            <div className="flex rounded-lg border border-line bg-surface-2 p-0.5">
              <Tooltip content={t("projects.grid")}>
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  aria-label={t("projects.grid")}
                  aria-pressed={view === "grid"}
                  className={cn(
                    "rounded-md p-1.5 transition-colors",
                    view === "grid" ? "bg-surface text-ink shadow-sm" : "text-subtle hover:text-ink",
                  )}
                >
                  <Grid3x3 className="h-4 w-4" />
                </button>
              </Tooltip>
              <Tooltip content={t("projects.list")}>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  aria-label={t("projects.list")}
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
      </PageHeader>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-5 w-5" />}
          title={t("projects.noProjects")}
          description={t("projects.noProjectsBody")}
          action={
            <Button leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setDialogOpen(true)}>
              {t("projects.newProject")}
            </Button>
          }
        />
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} onOpen={() => navigate(`/projects/${project.id}`)} />
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {filtered.map((project) => {
              const Icon = ICONS[project.icon] ?? Rocket;
              return (
                <li key={project.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="flex w-full items-center gap-4 px-4 py-3 text-start transition-colors hover:bg-surface-2"
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                      style={{ backgroundColor: project.color }}
                      aria-hidden
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.875rem] font-medium text-ink">
                        {locale === "ar" ? project.nameAr : project.name}
                      </p>
                      <p className="truncate text-[0.75rem] text-subtle">{project.path}</p>
                    </div>
                    <div className="hidden shrink-0 items-center gap-4 text-[0.75rem] text-muted sm:flex">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                        {project.conversationIds.length}
                      </span>
                      <span className="flex items-center gap-1">
                        <SquareStack className="h-3.5 w-3.5" aria-hidden />
                        {project.skillIds.length}
                      </span>
                      <span className="w-28 text-end text-subtle">
                        {formatRelative(project.updatedAt, locale)}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <ProjectFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={() => {
          setDialogOpen(false);
          load();
        }}
      />
    </div>
  );
}

function ProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const { locale } = useI18n();
  const Icon = ICONS[project.icon] ?? Rocket;
  return (
    <Card
      className="group cursor-pointer overflow-hidden transition-colors hover:border-line-strong"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="h-1 w-full" style={{ backgroundColor: project.color }} aria-hidden />
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ backgroundColor: project.color }}
            aria-hidden
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[0.9375rem] font-semibold text-ink">
              {locale === "ar" ? project.nameAr : project.name}
            </h3>
            <p className="truncate font-mono text-[0.6875rem] text-subtle">{project.path}</p>
          </div>
        </div>

        <p className="mt-3 line-clamp-2 min-h-[2.4rem] text-[0.8125rem] leading-relaxed text-muted">
          {project.description}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <Badge variant="neutral">
            <MessageSquare className="h-3 w-3" aria-hidden />
            {project.conversationIds.length}
          </Badge>
          <Badge variant="neutral">
            <Bot className="h-3 w-3" aria-hidden />
            {project.toolIds.length}
          </Badge>
          <Badge variant="neutral">
            <SquareStack className="h-3 w-3" aria-hidden />
            {project.skillIds.length}
          </Badge>
          <span className="ms-auto text-[0.6875rem] text-subtle">
            {formatRelative(project.updatedAt, locale)}
          </span>
        </div>
      </div>
    </Card>
  );
}
