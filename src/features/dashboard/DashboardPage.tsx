import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity as ActivityIcon,
  ArrowRight,
  Bot,
  Boxes,
  CircleDot,
  Clock,
  Cpu,
  FolderKanban,
  MessageSquarePlus,
  Plus,
  Server,
  Settings,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader, DemoNotice } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SkeletonCard, Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useServices, isDemoMode } from "@/services";
import { useI18n } from "@/i18n";
import { useSettingsStore } from "@/stores/settingsStore";
import { useConnectionStore } from "@/stores/connectionStore";
import type {
  ActivityEvent,
  Automation,
  ChatSession,
  ModelInfo,
  Project,
  UsageSummary,
} from "@/types";
import { formatCompact, formatCurrency, formatNumber, formatRelative } from "@/utils/format";

const CHART_COLORS = ["#0d9488", "#6366f1", "#f59e0b", "#ec4899", "#0ea5e9", "#8b5cf6"];

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const services = useServices();
  const defaultModelId = useSettingsStore((state) => state.settings.defaultModelId);
  const connection = useConnectionStore((state) => state.status);
  // Demo data is never the default. The notice/badge appear only when someone
  // deliberately opts into the mock adapter, so live numbers can't be mistaken
  // for fabricated ones.
  const demoMode = isDemoMode();
  const connectionBadge = {
    connected: { variant: "success" as const, label: t("dashboard.statusConnected") },
    connecting: { variant: "info" as const, label: t("dashboard.statusConnecting") },
    error: { variant: "danger" as const, label: t("dashboard.statusError") },
    disconnected: { variant: "neutral" as const, label: t("dashboard.statusDisconnected") },
    demo: { variant: "warning" as const, label: t("demo.badge") },
  }[demoMode ? "demo" : connection.state];
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [skillsCount, setSkillsCount] = useState(0);
  const [mcpCount, setMcpCount] = useState(0);
  const [toolsCount, setToolsCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      services.model.listModels(),
      services.chat.listSessions(),
      services.project.listProjects(),
      services.activity.listEvents(),
      services.automation.listAutomations(),
      services.analytics.getUsageSummary(),
      services.skill.listSkills(),
      services.mcp.listServers(),
      services.tool.listTools(),
    ])
      .then(([modelList, chatList, projectList, eventList, automationList, usageSummary, skills, mcp, tools]) => {
        if (cancelled) return;
        setModels(modelList);
        setChats(chatList);
        setProjects(projectList);
        setEvents(eventList);
        setAutomations(automationList);
        setUsage(usageSummary);
        setSkillsCount(skills.length);
        setMcpCount(mcp.length);
        setToolsCount(tools.length);
      })
      .catch((error) => {
        // Keep the dashboard usable even if one upstream service is offline.
        if (!cancelled) console.error("[dashboard] Failed to load overview:", error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [services]);

  const activeModel = models.find((model) => model.id === defaultModelId) ?? models[0];
  const providerName = activeModel?.providerName ?? "—";
  const lastEvent = events[0];

  const stats = useMemo(
    () => [
      {
        key: "chats",
        label: t("dashboard.conversations"),
        value: formatNumber(chats.length, locale),
        icon: MessageSquarePlus,
        tone: "accent" as const,
        to: "/chats",
      },
      {
        key: "projects",
        label: t("dashboard.projects"),
        value: formatNumber(projects.length, locale),
        icon: FolderKanban,
        tone: "info" as const,
        to: "/projects",
      },
      {
        key: "skills",
        label: t("dashboard.skills"),
        value: formatNumber(skillsCount, locale),
        icon: Sparkles,
        tone: "success" as const,
        to: "/skills",
      },
      {
        key: "mcp",
        label: t("dashboard.mcpServers"),
        value: formatNumber(mcpCount, locale),
        icon: Server,
        tone: "warning" as const,
        to: "/mcp",
      },
      {
        key: "tools",
        label: t("dashboard.tools"),
        value: formatNumber(toolsCount, locale),
        icon: Wrench,
        tone: "neutral" as const,
        to: "/tools",
      },
    ],
    [chats.length, locale, mcpCount, projects.length, skillsCount, t, toolsCount],
  );

  const quickActions = [
    { label: t("dashboard.actionNewChat"), icon: Plus, to: "/chats?new=1" },
    { label: t("dashboard.actionOpenProject"), icon: FolderKanban, to: "/projects" },
    { label: t("dashboard.actionSwitchModel"), icon: Cpu, to: "/models" },
    { label: t("dashboard.actionAddMcp"), icon: Server, to: "/mcp" },
    { label: t("dashboard.actionBrowseSkills"), icon: Sparkles, to: "/skills" },
    { label: t("dashboard.actionOpenSettings"), icon: Settings, to: "/settings" },
  ];

  return (
    <div className="mx-auto w-full max-w-[100rem]">
      <PageHeader title={t("dashboard.title")} description={t("dashboard.subtitle")} />

      {demoMode ? <DemoNotice text={t("demo.bannerBody")} className="mb-6" /> : null}

      {/* System overview */}
      <section aria-labelledby="overview-heading" className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="overview-heading" className="text-[0.9375rem] font-semibold text-ink">
            {t("dashboard.systemOverview")}
          </h2>
          <Badge variant={connectionBadge.variant} dot>
            {connectionBadge.label}
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)
          ) : (
            <>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-[0.75rem] font-medium text-subtle">
                  <CircleDot className="h-3.5 w-3.5 text-warning" aria-hidden />
                  {t("dashboard.hermesStatus")}
                </div>
                <p className="mt-2 truncate text-sm font-semibold text-ink">{connectionBadge.label}</p>
                <p className="mt-0.5 truncate text-[0.75rem] text-muted" title={connection.message}>
                  {connection.message}
                </p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-[0.75rem] font-medium text-subtle">
                  <Bot className="h-3.5 w-3.5 text-accent" aria-hidden />
                  {t("dashboard.activeModel")}
                </div>
                <p className="mt-2 truncate text-sm font-semibold text-ink">
                  {activeModel?.name ?? "—"}
                </p>
                <p className="mt-0.5 truncate font-mono text-[0.6875rem] text-subtle">
                  {activeModel?.modelId}
                </p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-[0.75rem] font-medium text-subtle">
                  <Zap className="h-3.5 w-3.5 text-info" aria-hidden />
                  {t("dashboard.activeProvider")}
                </div>
                <p className="mt-2 truncate text-sm font-semibold text-ink">{providerName}</p>
                <p className="mt-0.5 text-[0.75rem] text-muted">
                  {formatNumber(models.filter((model) => model.configured).length, locale)}{" "}
                  {t("providers.configuredModels")}
                </p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-[0.75rem] font-medium text-subtle">
                  <Clock className="h-3.5 w-3.5 text-success" aria-hidden />
                  {t("dashboard.lastActivity")}
                </div>
                <p className="mt-2 truncate text-sm font-semibold text-ink">
                  {lastEvent ? formatRelative(lastEvent.timestamp, locale) : "—"}
                </p>
                <p className="mt-0.5 truncate text-[0.75rem] text-muted">
                  {lastEvent?.title ?? t("dashboard.noActivity")}
                </p>
              </Card>
            </>
          )}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {stats.map((stat) => (
            <Link
              key={stat.key}
              to={stat.to}
              className="group flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 transition-colors hover:border-line-strong hover:bg-surface-2"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-muted transition-colors group-hover:bg-accent-soft group-hover:text-accent">
                <stat.icon className="h-4.5 w-4.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.6875rem] text-subtle">{stat.label}</p>
                <p className="text-base font-semibold text-ink">{stat.value}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-subtle opacity-0 transition-opacity group-hover:opacity-100 rtl:rotate-180" />
            </Link>
          ))}
        </div>
      </section>

      {/* Quick actions */}
      <section aria-labelledby="quick-heading" className="mb-6">
        <h2 id="quick-heading" className="mb-3 text-[0.9375rem] font-semibold text-ink">
          {t("dashboard.quickActions")}
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => navigate(action.to)}
              className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-3 text-start text-[0.8125rem] font-medium text-ink transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent"
            >
              <action.icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{action.label}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Usage analytics */}
        <section className="xl:col-span-2" aria-labelledby="usage-heading">
          <Card>
            <CardHeader
              title={t("dashboard.usageAnalytics")}
              description={t("dashboard.usageSubtitle")}
              icon={<ActivityIcon className="h-4 w-4" />}
            />
            <CardContent className="space-y-5">
              {loading ? (
                <Skeleton className="h-56" />
              ) : usage ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Metric
                      label={t("dashboard.requests")}
                      value={formatNumber(usage.totalRequests, locale)}
                      hint={t("dashboard.metricSource")}
                    />
                    <Metric
                      label={t("dashboard.tokens")}
                      value={formatCompact(usage.totalTokens, locale)}
                      hint={t("dashboard.metricSource")}
                    />
                    <Metric
                      label={t("dashboard.cost")}
                      value={formatCurrency(usage.totalCost, locale)}
                      hint={t("dashboard.metricSource")}
                    />
                  </div>

                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={usage.points} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                        <defs>
                          <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgb(var(--cc-accent))" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="rgb(var(--cc-accent))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgb(var(--cc-border))" strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: "rgb(var(--cc-fg-subtle))", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(value: string) => value.slice(5)}
                        />
                        <YAxis
                          tick={{ fill: "rgb(var(--cc-fg-subtle))", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            background: "rgb(var(--cc-surface))",
                            border: "1px solid rgb(var(--cc-border))",
                            borderRadius: 12,
                            fontSize: 12,
                            color: "rgb(var(--cc-fg))",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="requests"
                          stroke="rgb(var(--cc-accent))"
                          strokeWidth={2}
                          fill="url(#usageGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <p className="mb-2 text-[0.75rem] font-semibold uppercase tracking-wide text-subtle">
                        {t("dashboard.modelUsage")}
                      </p>
                      <div className="h-44 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={usage.byModel}
                              dataKey="requests"
                              nameKey="name"
                              innerRadius={38}
                              outerRadius={62}
                              paddingAngle={2}
                              stroke="none"
                            >
                              {usage.byModel.map((entry, index) => (
                                <Cell
                                  key={entry.modelId}
                                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <RechartsTooltip
                              contentStyle={{
                                background: "rgb(var(--cc-surface))",
                                border: "1px solid rgb(var(--cc-border))",
                                borderRadius: 12,
                                fontSize: 12,
                                color: "rgb(var(--cc-fg))",
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-[0.75rem] font-semibold uppercase tracking-wide text-subtle">
                        {t("dashboard.toolActivity")}
                      </p>
                      <div className="h-44 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={usage.byTool}
                            layout="vertical"
                            margin={{ top: 0, right: 8, left: 8, bottom: 0 }}
                          >
                            <CartesianGrid stroke="rgb(var(--cc-border))" strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" hide />
                            <YAxis
                              type="category"
                              dataKey="name"
                              width={104}
                              tick={{ fill: "rgb(var(--cc-fg-subtle))", fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <RechartsTooltip
                              cursor={{ fill: "rgb(var(--cc-surface-2))" }}
                              contentStyle={{
                                background: "rgb(var(--cc-surface))",
                                border: "1px solid rgb(var(--cc-border))",
                                borderRadius: 12,
                                fontSize: 12,
                                color: "rgb(var(--cc-fg))",
                              }}
                            />
                            <Bar dataKey="calls" fill="rgb(var(--cc-accent))" radius={[0, 6, 6, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </section>

        {/* Activity */}
        <section className="space-y-4" aria-labelledby="activity-heading">
          <h2 id="activity-heading" className="sr-only">
            {t("dashboard.activity")}
          </h2>

          <Card>
            <CardHeader
              title={t("dashboard.recentChats")}
              action={
                <Link to="/chats" className="text-[0.75rem] font-medium text-accent hover:underline">
                  {t("dashboard.viewAll")}
                </Link>
              }
            />
            <CardContent className="space-y-1">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : chats.length === 0 ? (
                <EmptyState title={t("chats.noChats")} description={t("chats.emptyBody")} />
              ) : (
                chats.slice(0, 4).map((chat) => (
                  <Link
                    key={chat.id}
                    to={`/chats/${chat.id}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2"
                  >
                    <MessageSquarePlus className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.8125rem] font-medium text-ink">{chat.title}</p>
                      <p className="text-[0.6875rem] text-subtle">
                        {formatRelative(chat.updatedAt, locale)}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title={t("dashboard.recentProjects")}
              action={
                <Link to="/projects" className="text-[0.75rem] font-medium text-accent hover:underline">
                  {t("dashboard.viewAll")}
                </Link>
              }
            />
            <CardContent className="space-y-1">
              {projects.slice(0, 4).map((project) => (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2"
                >
                  <span
                    className="h-7 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: project.color }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.8125rem] font-medium text-ink">
                      {locale === "ar" ? project.nameAr : project.name}
                    </p>
                    <p className="truncate text-[0.6875rem] text-subtle">{project.path}</p>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title={t("dashboard.recentTasks")}
              action={
                <Link to="/automations" className="text-[0.75rem] font-medium text-accent hover:underline">
                  {t("dashboard.viewAll")}
                </Link>
              }
            />
            <CardContent className="space-y-1">
              {automations.slice(0, 3).map((automation) => (
                <Link
                  key={automation.id}
                  to="/automations"
                  className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2"
                >
                  <Boxes className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.8125rem] font-medium text-ink">
                      {locale === "ar" ? automation.nameAr : automation.name}
                    </p>
                    <p className="text-[0.6875rem] text-subtle">
                      {t("automations.nextRun")}: {formatRelative(automation.nextRunAt, locale)}
                    </p>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title={t("dashboard.recentEvents")}
              action={
                <Link to="/activity" className="text-[0.75rem] font-medium text-accent hover:underline">
                  {t("dashboard.viewAll")}
                </Link>
              }
            />
            <CardContent className="space-y-1">
              {events.slice(0, 5).map((event) => (
                <div key={event.id} className="flex items-start gap-3 rounded-lg px-2 py-2">
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                      event.status === "error"
                        ? "bg-danger"
                        : event.status === "warning"
                          ? "bg-warning"
                          : event.status === "success"
                            ? "bg-success"
                            : "bg-info"
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.8125rem] text-ink">{event.title}</p>
                    <p className="text-[0.6875rem] text-subtle">
                      {formatRelative(event.timestamp, locale)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 px-3.5 py-3">
      <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-subtle">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
      <p className="text-[0.6875rem] text-subtle">{hint}</p>
    </div>
  );
}
