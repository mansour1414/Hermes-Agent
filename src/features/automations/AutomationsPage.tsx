import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CalendarClock,
  Play,
  Plus,
  Timer,
  Trash2,
  CircleCheck,
  CircleX,
  Loader2,
  Pencil,
} from "lucide-react";
import { PageHeader, DemoNotice } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useServices } from "@/services";
import { useI18n } from "@/i18n";
import { useUiStore } from "@/stores/uiStore";
import type { Automation, AutomationScheduleType } from "@/types";
import { cn } from "@/utils/cn";
import { formatDateTime, formatRelative } from "@/utils/format";

const automationSchema = z.object({
  name: z.string().min(2, "name"),
  nameAr: z.string().min(2, "nameAr"),
  description: z.string().min(3, "description"),
  command: z.string().min(5, "command"),
  scheduleType: z.enum(["daily", "weekly", "monthly", "cron"]),
  time: z.string().min(4, "time"),
  cron: z.string().optional(),
  projectId: z.string().optional(),
});

type AutomationFormValues = z.infer<typeof automationSchema>;

export default function AutomationsPage() {
  const { t, locale } = useI18n();
  const services = useServices();
  const pushToast = useUiStore((state) => state.pushToast);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Automation | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Automation | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    services.automation
      .listAutomations()
      .then(setAutomations)
      .finally(() => setLoading(false));
  };

  useEffect(load, [services]);

  const toggle = async (automation: Automation) => {
    const updated = await services.automation.setEnabled(automation.id, !automation.enabled);
    setAutomations((current) => current.map((item) => (item.id === automation.id ? updated : item)));
  };

  const runNow = async (automation: Automation) => {
    setRunningId(automation.id);
    try {
      await services.automation.runNow(automation.id);
      load();
      pushToast({ title: t("automations.ran"), description: automation.name, variant: "success" });
    } finally {
      setRunningId(null);
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    await services.automation.deleteAutomation(confirmDelete.id);
    setConfirmDelete(null);
    load();
  };

  return (
    <div className="mx-auto w-full max-w-[90rem]">
      <PageHeader
        title={t("automations.title")}
        description={t("automations.subtitle")}
        actions={
          <Button
            leadingIcon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            {t("automations.newAutomation")}
          </Button>
        }
      />

      <DemoNotice text={t("automations.noAutomationsBody")} className="mb-5" />

      {loading ? (
        <SkeletonRows rows={4} />
      ) : automations.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-5 w-5" />}
          title={t("automations.noAutomations")}
          description={t("automations.noAutomationsBody")}
          action={
            <Button leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setDialogOpen(true)}>
              {t("automations.newAutomation")}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {automations.map((automation) => (
            <Card key={automation.id}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    {locale === "ar" ? automation.nameAr : automation.name}
                    {automation.enabled ? null : (
                      <Badge variant="neutral">{t("common.disabled")}</Badge>
                    )}
                  </span>
                }
                description={automation.description}
                icon={<CalendarClock className="h-4 w-4" />}
                action={
                  <Switch
                    checked={automation.enabled}
                    onChange={() => void toggle(automation)}
                    label={t("automations.enable")}
                  />
                }
              />
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <Cell label={t("automations.schedule")} value={scheduleLabel(t, automation.scheduleType)} />
                  <Cell label={t("automations.nextRun")} value={formatRelative(automation.nextRunAt, locale)} />
                  <Cell
                    label={t("automations.lastRun")}
                    value={automation.lastRunAt ? formatRelative(automation.lastRunAt, locale) : t("common.never")}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      automation.lastStatus === "success"
                        ? "success"
                        : automation.lastStatus === "failed"
                          ? "danger"
                          : automation.lastStatus === "running"
                            ? "info"
                            : "neutral"
                    }
                    dot
                  >
                    {automation.lastStatus === "success"
                      ? t("automations.success")
                      : automation.lastStatus === "failed"
                        ? t("automations.failed")
                        : automation.lastStatus === "running"
                          ? t("automations.running")
                          : t("automations.pending")}
                  </Badge>
                  <span className="text-[0.75rem] text-muted">
                    {automation.runCount} {t("automations.executions")}
                  </span>
                  {automation.failureCount > 0 ? (
                    <span className="text-[0.75rem] text-danger">
                      {automation.failureCount} {t("automations.failed").toLowerCase()}
                    </span>
                  ) : null}
                </div>

                <div className="rounded-lg border border-line bg-surface-2 px-3 py-2">
                  <p className="text-[0.625rem] uppercase tracking-wide text-subtle">
                    {t("automations.command")}
                  </p>
                  <p className="mt-0.5 text-[0.75rem] leading-relaxed text-ink">{automation.command}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    leadingIcon={
                      runningId === automation.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )
                    }
                    onClick={() => void runNow(automation)}
                    disabled={runningId === automation.id}
                  >
                    {t("automations.runNow")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    leadingIcon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => {
                      setEditing(automation);
                      setDialogOpen(true);
                    }}
                  >
                    {t("common.edit")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ms-auto text-danger"
                    leadingIcon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => setConfirmDelete(automation)}
                  >
                    {t("common.delete")}
                  </Button>
                  <Button
                    size="sm"
                    variant="link"
                    onClick={() => setExpanded(expanded === automation.id ? null : automation.id)}
                  >
                    {t("automations.history")}
                  </Button>
                </div>

                {expanded === automation.id ? (
                  <div className="space-y-2 border-t border-line pt-3">
                    <p className="text-[0.75rem] font-semibold text-ink">{t("automations.history")}</p>
                    {automation.logs.length === 0 ? (
                      <p className="text-[0.75rem] text-subtle">{t("automations.noRuns")}</p>
                    ) : (
                      <ul className="space-y-2">
                        {automation.logs.map((run) => (
                          <li
                            key={run.id}
                            className={cn(
                              "rounded-lg border px-3 py-2",
                              run.status === "failed"
                                ? "border-danger/30 bg-danger-soft/50"
                                : "border-line bg-surface-2",
                            )}
                          >
                            <div className="flex items-center gap-2">
                              {run.status === "failed" ? (
                                <CircleX className="h-3.5 w-3.5 text-danger" aria-hidden />
                              ) : (
                                <CircleCheck className="h-3.5 w-3.5 text-success" aria-hidden />
                              )}
                              <span className="text-[0.75rem] text-ink">{formatDateTime(run.startedAt, locale)}</span>
                              <span className="ms-auto text-[0.6875rem] text-subtle">{run.durationMs} ms</span>
                            </div>
                            <p className="mt-1 text-[0.75rem] leading-relaxed text-muted">{run.output}</p>
                            {run.error ? (
                              <p className="mt-1 font-mono text-[0.6875rem] text-danger">{run.error}</p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AutomationFormDialog
        open={dialogOpen}
        automation={editing}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        onSaved={() => {
          setDialogOpen(false);
          setEditing(null);
          load();
        }}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => void remove()}
        title={t("common.delete")}
        body={t("automations.noAutomationsBody")}
        confirmLabel={t("common.delete")}
        destructive
      />
    </div>
  );
}

function scheduleLabel(t: (key: "automations.daily" | "automations.weekly" | "automations.monthly" | "automations.cron") => string, type: AutomationScheduleType) {
  const map: Record<AutomationScheduleType, "automations.daily" | "automations.weekly" | "automations.monthly" | "automations.cron"> = {
    daily: "automations.daily",
    weekly: "automations.weekly",
    monthly: "automations.monthly",
    cron: "automations.cron",
  };
  return t(map[type]);
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2">
      <p className="text-[0.625rem] uppercase tracking-wide text-subtle">{label}</p>
      <p className="mt-0.5 truncate text-[0.8125rem] font-medium text-ink">{value}</p>
    </div>
  );
}

function AutomationFormDialog({
  open,
  automation,
  onClose,
  onSaved,
}: {
  open: boolean;
  automation: Automation | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const services = useServices();
  const pushToast = useUiStore((state) => state.pushToast);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AutomationFormValues>({
    resolver: zodResolver(automationSchema),
    defaultValues: {
      name: "",
      nameAr: "",
      description: "",
      command: "",
      scheduleType: "daily",
      time: "09:00",
      cron: "0 9 * * *",
    },
  });

  useEffect(() => {
    if (!open) return;
    services.project
      .listProjects()
      .then((list) => setProjects(list.map((project) => ({ id: project.id, name: project.name }))))
      .catch(() => undefined);
    if (automation) {
      reset({
        name: automation.name,
        nameAr: automation.nameAr,
        description: automation.description,
        command: automation.command,
        scheduleType: automation.scheduleType,
        time: automation.time,
        cron: automation.cron,
        projectId: automation.projectId,
      });
    } else {
      reset({
        name: "",
        nameAr: "",
        description: "",
        command: "",
        scheduleType: "daily",
        time: "09:00",
        cron: "0 9 * * *",
      });
    }
  }, [open, automation, reset, services]);

  const scheduleType = watch("scheduleType");

  const onSubmit = handleSubmit(async (values) => {
    const nextRun = new Date(Date.now() + 86_400_000).toISOString();
    try {
      if (automation) {
        await services.automation.updateAutomation(automation.id, {
          ...values,
          cron: values.scheduleType === "cron" ? values.cron ?? "0 9 * * *" : cronFor(values.scheduleType, values.time),
        });
        pushToast({ title: t("automations.updated"), variant: "success" });
      } else {
        await services.automation.createAutomation({
          name: values.name,
          nameAr: values.nameAr,
          description: values.description,
          command: values.command,
          scheduleType: values.scheduleType,
          cron: values.scheduleType === "cron" ? values.cron ?? "0 9 * * *" : cronFor(values.scheduleType, values.time),
          time: values.time,
          days: [],
          enabled: true,
          nextRunAt: nextRun,
          lastStatus: "pending",
        });
        pushToast({ title: t("automations.created"), variant: "success" });
      }
      onSaved();
    } catch (error) {
      pushToast({
        title: t("common.error"),
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={automation ? t("automations.edit") : t("automations.newAutomation")}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="automation-form" loading={isSubmitting}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <form id="automation-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("automations.name")} htmlFor="automation-name" required error={errors.name ? t("automations.nameRequired") : undefined}>
            <Input id="automation-name" {...register("name")} invalid={Boolean(errors.name)} />
          </Field>
          <Field label={`${t("automations.name")} (عربي)`} htmlFor="automation-name-ar" required error={errors.nameAr ? t("automations.nameRequired") : undefined}>
            <Input id="automation-name-ar" {...register("nameAr")} invalid={Boolean(errors.nameAr)} dir="rtl" />
          </Field>
        </div>

        <Field label={t("common.description")} htmlFor="automation-description" required error={errors.description ? t("common.required") : undefined}>
          <Textarea id="automation-description" {...register("description")} invalid={Boolean(errors.description)} rows={2} />
        </Field>

        <Field label={t("automations.command")} htmlFor="automation-command" required error={errors.command ? t("automations.commandRequired") : undefined}>
          <Textarea id="automation-command" {...register("command")} invalid={Boolean(errors.command)} rows={2} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("automations.schedule")} htmlFor="automation-schedule">
            <Select id="automation-schedule" {...register("scheduleType")}>
              <option value="daily">{t("automations.daily")}</option>
              <option value="weekly">{t("automations.weekly")}</option>
              <option value="monthly">{t("automations.monthly")}</option>
              <option value="cron">{t("automations.cron")}</option>
            </Select>
          </Field>
          {scheduleType === "cron" ? (
            <Field label={t("automations.cron")} htmlFor="automation-cron">
              <Input id="automation-cron" {...register("cron")} className="font-mono" dir="ltr" />
            </Field>
          ) : (
            <Field label={t("common.details")} htmlFor="automation-time">
              <Input id="automation-time" type="time" {...register("time")} />
            </Field>
          )}
        </div>

        <Field label={t("projects.title")} htmlFor="automation-project">
          <Select id="automation-project" {...register("projectId")}>
            <option value="">{t("common.none")}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </Field>

        <p className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-[0.6875rem] text-muted">
          <Timer className="h-3.5 w-3.5" aria-hidden />
          {t("automations.noAutomationsBody")}
        </p>
      </form>
    </Modal>
  );
}

function cronFor(scheduleType: AutomationScheduleType, time: string): string {
  const [hour = "9", minute = "0"] = time.split(":");
  if (scheduleType === "daily") return `${Number(minute)} ${Number(hour)} * * *`;
  if (scheduleType === "weekly") return `${Number(minute)} ${Number(hour)} * * 1`;
  return `${Number(minute)} ${Number(hour)} 1 * *`;
}
