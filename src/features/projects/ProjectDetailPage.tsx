import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  FileText,
  MessageSquare,
  Save,
  SquareStack,
  Trash2,
  Wrench,
  Clock,
  FolderOpen,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useServices } from "@/services";
import { useI18n } from "@/i18n";
import { useUiStore } from "@/stores/uiStore";
import type { ChatSession, FileEntry, ModelInfo, Project, SkillInfo, ToolInfo } from "@/types";
import { formatDateTime, formatRelative } from "@/utils/format";

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const services = useServices();
  const pushToast = useUiStore((state) => state.pushToast);

  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState("overview");
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      services.project.getProject(projectId),
      services.chat.listSessions(),
      services.project.listProjectFiles(projectId),
      services.model.listModels(),
      services.skill.listSkills(),
      services.tool.listTools(),
    ])
      .then(([projectData, chatList, fileList, modelList, skillList, toolList]) => {
        if (cancelled) return;
        setProject(projectData);
        setChats(chatList);
        setFiles(fileList);
        setModels(modelList);
        setSkills(skillList);
        setTools(toolList);
        setInstructions(projectData.instructions);
      })
      .catch(() => {
        if (!cancelled) setProject(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, services]);

  const save = async () => {
    if (!project) return;
    setSaving(true);
    try {
      const updated = await services.project.updateProject(project.id, { instructions });
      setProject(updated);
      pushToast({ title: t("projects.updated"), variant: "success" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!project) return;
    await services.project.deleteProject(project.id);
    pushToast({ title: t("common.delete"), variant: "info" });
    navigate("/projects");
  };

  if (loading) {
    return (
      <div className="mx-auto min-w-0 w-full max-w-[76rem] space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto min-w-0 w-full max-w-[76rem]">
        <EmptyState
          title={t("errors.notFound")}
          description={t("errors.notFoundBody")}
          action={<Button onClick={() => navigate("/projects")}>{t("errors.backHome")}</Button>}
        />
      </div>
    );
  }

  const tabs: TabItem[] = [
    { id: "overview", label: t("projects.tabOverview") },
    { id: "conversations", label: t("projects.tabConversations"), badge: <Badge variant="neutral">{chats.length}</Badge> },
    { id: "files", label: t("projects.tabFiles"), badge: <Badge variant="neutral">{files.length}</Badge> },
    { id: "instructions", label: t("projects.tabInstructions") },
    { id: "models", label: t("projects.tabModels") },
    { id: "skills", label: t("projects.tabSkills") },
    { id: "settings", label: t("projects.tabSettings") },
  ];

  const projectChats = chats.filter((chat) => chat.projectId === project.id);
  const projectModels = models.filter((model) => model.id === project.preferredModelId);
  const projectSkills = skills.filter((skill) => project.skillIds.includes(skill.id));
  const projectTools = tools.filter((tool) => project.toolIds.includes(tool.id));

  return (
    <div className="mx-auto min-w-0 w-full max-w-[76rem]">
      <button
        type="button"
        onClick={() => navigate("/projects")}
        className="mb-3 inline-flex items-center gap-1.5 text-[0.8125rem] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
        {t("projects.title")}
      </button>

      <PageHeader
        title={locale === "ar" ? project.nameAr : project.name}
        description={project.description}
        actions={
          <>
            <Button variant="secondary" leadingIcon={<FolderOpen className="h-4 w-4" />} onClick={() => navigate("/files")}>
              {t("files.title")}
            </Button>
            <Button variant="danger" leadingIcon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(true)}>
              {t("common.delete")}
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2 text-[0.75rem] text-muted">
        <Badge variant="neutral" className="font-mono">{project.path}</Badge>
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {t("projects.updatedAt")}: {formatRelative(project.updatedAt, locale)}
        </span>
      </div>

      <Tabs items={tabs} value={tab} onChange={setTab} className="mb-5" />

      {tab === "overview" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={<MessageSquare className="h-4 w-4" />} label={t("projects.conversations")} value={projectChats.length} />
          <StatCard icon={<Bot className="h-4 w-4" />} label={t("projects.preferredModel")} value={projectModels[0]?.name ?? "—"} />
          <StatCard icon={<SquareStack className="h-4 w-4" />} label={t("projects.skills")} value={projectSkills.length} />
          <StatCard icon={<Wrench className="h-4 w-4" />} label={t("projects.tools")} value={projectTools.length} />
        </div>
      ) : null}

      {tab === "conversations" ? (
        <Card>
          <CardHeader title={t("projects.linkedConversations")} />
          <CardContent className="space-y-1">
            {projectChats.length === 0 ? (
              <EmptyState title={t("chats.noChats")} description={t("chats.emptyBody")} />
            ) : (
              projectChats.map((chat) => (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => navigate(`/chats/${chat.id}`)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-start transition-colors hover:bg-surface-2"
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
                  <span className="flex-1 truncate text-[0.8125rem] text-ink">{chat.title}</span>
                  <span className="text-[0.6875rem] text-subtle">{formatRelative(chat.updatedAt, locale)}</span>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === "files" ? (
        <Card>
          <CardHeader title={t("files.title")} description={t("files.readOnlyNotice")} />
          <CardContent className="space-y-1">
            {files.length === 0 ? (
              <EmptyState title={t("files.noFiles")} description={t("files.emptyFolder")} />
            ) : (
              files.map((file) => (
                <div key={file.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
                  <span className="flex-1 truncate font-mono text-[0.8125rem] text-ink">{file.path}</span>
                  <span className="text-[0.6875rem] text-subtle">{formatDateTime(file.modifiedAt, locale)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === "instructions" ? (
        <Card>
          <CardHeader title={t("projects.instructions")} description={t("projects.instructionsPlaceholder")} />
          <CardContent className="space-y-3">
            <Textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              rows={8}
              aria-label={t("projects.instructions")}
            />
            <Button onClick={() => void save()} loading={saving} leadingIcon={<Save className="h-4 w-4" />}>
              {t("common.save")}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {tab === "models" ? (
        <Card>
          <CardHeader title={t("projects.tabModels")} />
          <CardContent className="space-y-2">
            {projectModels.length === 0 ? (
              <EmptyState title={t("common.notAvailable")} />
            ) : (
              projectModels.map((model) => (
                <div key={model.id} className="rounded-lg border border-line bg-surface-2 p-3">
                  <p className="text-[0.875rem] font-medium text-ink">{model.name}</p>
                  <p className="font-mono text-[0.6875rem] text-subtle">{model.modelId}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === "skills" ? (
        <Card>
          <CardHeader title={t("projects.tabSkills")} />
          <CardContent className="space-y-2">
            {projectSkills.length === 0 ? (
              <EmptyState title={t("common.notAvailable")} />
            ) : (
              projectSkills.map((skill) => (
                <div key={skill.id} className="rounded-lg border border-line bg-surface-2 p-3">
                  <p className="text-[0.875rem] font-medium text-ink">
                    {locale === "ar" ? skill.nameAr : skill.name}
                  </p>
                  <p className="mt-0.5 text-[0.75rem] text-muted">
                    {locale === "ar" ? skill.descriptionAr : skill.description}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === "settings" ? (
        <Card>
          <CardHeader title={t("projects.tabSettings")} />
          <CardContent className="space-y-3 text-[0.8125rem] text-muted">
            <Row label={t("projects.path")} value={project.path} mono />
            <Row label={t("projects.createdAt")} value={formatDateTime(project.createdAt, locale)} />
            <Row label={t("projects.updatedAt")} value={formatDateTime(project.updatedAt, locale)} />
            <Row label={t("projects.icon")} value={project.icon} />
            <Row label={t("projects.color")} value={project.color} mono />
            <Row label={t("common.details")} value={String(project.fileCount)} />
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
        title={t("common.delete")}
        body={t("projects.deleteWarning")}
        confirmLabel={t("common.delete")}
        destructive
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-[0.75rem] font-medium text-subtle">
        <span className="text-accent">{icon}</span>
        {label}
      </div>
      <p className="mt-2 truncate text-lg font-semibold text-ink">{value}</p>
    </Card>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line pb-2 last:border-0">
      <span className="text-subtle">{label}</span>
      <span className={mono ? "font-mono text-[0.75rem] text-ink" : "text-ink"}>{value}</span>
    </div>
  );
}
