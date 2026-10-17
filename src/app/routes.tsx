import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Skeleton } from "@/components/ui/Skeleton";
import { useI18n } from "@/i18n";

const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage"));
const ChatsPage = lazy(() => import("@/features/chats/ChatsPage"));
const ProjectsPage = lazy(() => import("@/features/projects/ProjectsPage"));
const ProjectDetailPage = lazy(() => import("@/features/projects/ProjectDetailPage"));
const ModelsPage = lazy(() => import("@/features/models/ModelsPage"));
const ProvidersPage = lazy(() => import("@/features/providers/ProvidersPage"));
const McpPage = lazy(() => import("@/features/mcp/McpPage"));
const SkillsPage = lazy(() => import("@/features/skills/SkillsPage"));
const ToolsPage = lazy(() => import("@/features/tools/ToolsPage"));
const BrowserPage = lazy(() => import("@/features/browser/BrowserPage"));
const ComputerUsePage = lazy(() => import("@/features/computer-use/ComputerUsePage"));
const FilesPage = lazy(() => import("@/features/files/FilesPage"));
const MemoryPage = lazy(() => import("@/features/memory/MemoryPage"));
const AutomationsPage = lazy(() => import("@/features/automations/AutomationsPage"));
const IntegrationsPage = lazy(() => import("@/features/integrations/IntegrationsPage"));
const ActivityPage = lazy(() => import("@/features/activity/ActivityPage"));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage"));

function RouteFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-4 w-80" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

function NotFound() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center gap-3 text-center">
      <p className="text-3xl font-semibold text-ink">404</p>
      <p className="text-[0.9375rem] font-medium text-ink">{t("errors.notFound")}</p>
      <p className="max-w-sm text-[0.8125rem] leading-relaxed text-muted">{t("errors.notFoundBody")}</p>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/chats" element={<ChatsPage />} />
        <Route path="/chats/:sessionId" element={<ChatsPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/models" element={<ModelsPage />} />
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="/mcp" element={<McpPage />} />
        <Route path="/skills" element={<SkillsPage />} />
        <Route path="/tools" element={<ToolsPage />} />
        <Route path="/browser" element={<BrowserPage />} />
        <Route path="/computer-use" element={<ComputerUsePage />} />
        <Route path="/files" element={<FilesPage />} />
        <Route path="/memory" element={<MemoryPage />} />
        <Route path="/automations" element={<AutomationsPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
