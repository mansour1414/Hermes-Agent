import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  PlugZap,
  Plus,
  Server,
  Trash2,
  Wrench,
  ZapOff,
  Eye,
  EyeOff,
} from "lucide-react";
import { PageHeader, DemoNotice } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, Field } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useServices } from "@/services";
import { useI18n } from "@/i18n";
import { useUiStore } from "@/stores/uiStore";
import type { McpServer } from "@/types";
import { cn } from "@/utils/cn";
import { formatRelative } from "@/utils/format";

const mcpSchema = z
  .object({
    name: z.string().min(2, "name"),
    nameAr: z.string().min(1, "nameAr"),
    description: z.string().min(3, "description"),
    transport: z.enum(["stdio", "sse", "http", "websocket"]),
    command: z.string().optional(),
    args: z.string().optional(),
    url: z.string().optional(),
    authType: z.enum(["none", "header", "bearer", "oauth"]),
    envKey: z.string().optional(),
    envValue: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.transport === "stdio" && !value.command?.trim()) {
      ctx.addIssue({ code: "custom", path: ["command"], message: "command" });
    }
    if (value.transport !== "stdio" && !value.url?.trim()) {
      ctx.addIssue({ code: "custom", path: ["url"], message: "url" });
    }
  });

type McpFormValues = z.infer<typeof mcpSchema>;

export default function McpPage() {
  const { t, locale } = useI18n();
  const services = useServices();
  const pushToast = useUiStore((state) => state.pushToast);
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<McpServer | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<McpServer | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const load = () => {
    setLoading(true);
    services.mcp
      .listServers()
      .then(setServers)
      .finally(() => setLoading(false));
  };

  useEffect(load, [services]);

  const toggleEnabled = async (server: McpServer) => {
    const updated = await services.mcp.setEnabled(server.id, !server.enabled);
    setServers((current) => current.map((item) => (item.id === server.id ? updated : item)));
  };

  const testConnection = async (server: McpServer) => {
    setTestingId(server.id);
    setTestResult(null);
    try {
      const result = await services.mcp.testConnection(server.id);
      setTestResult({ ok: result.ok, message: result.message });
    } finally {
      setTestingId(null);
    }
  };

  const remove = async () => {
    if (!confirmRemove) return;
    await services.mcp.removeServer(confirmRemove.id);
    setConfirmRemove(null);
    load();
    pushToast({ title: t("mcp.removed"), variant: "info" });
  };

  return (
    <div className="mx-auto w-full max-w-[90rem]">
      <PageHeader
        title={t("mcp.title")}
        description={t("mcp.subtitle")}
        actions={
          <Button
            leadingIcon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            {t("mcp.addServer")}
          </Button>
        }
      />

      <DemoNotice text={t("mcp.manageNotice")} className="mb-5" />

      {loading ? (
        <SkeletonRows rows={4} />
      ) : servers.length === 0 ? (
        <EmptyState
          icon={<Server className="h-5 w-5" />}
          title={t("mcp.noServers")}
          description={t("mcp.noServersBody")}
          action={
            <Button leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setDialogOpen(true)}>
              {t("mcp.addServer")}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {servers.map((server) => (
            <Card key={server.id} className="flex flex-col">
              <div className="flex items-start gap-3 border-b border-line p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-muted">
                  <Server className="h-4.5 w-4.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.875rem] font-semibold text-ink">
                    {locale === "ar" ? server.nameAr : server.name}
                  </p>
                  <p className="truncate font-mono text-[0.6875rem] text-subtle">{server.name}</p>
                </div>
                <Switch
                  checked={server.enabled}
                  onChange={() => void toggleEnabled(server)}
                  label={t("mcp.enable")}
                />
              </div>

              <div className="flex-1 space-y-3 p-4">
                <div className="flex flex-wrap gap-1.5">
                  <Badge
                    variant={
                      server.status === "connected"
                        ? "success"
                        : server.status === "error"
                          ? "danger"
                          : server.status === "starting"
                            ? "info"
                            : "neutral"
                    }
                    dot
                  >
                    {server.status === "connected"
                      ? t("mcp.connected")
                      : server.status === "error"
                        ? t("mcp.error")
                        : server.status === "starting"
                          ? t("mcp.starting")
                          : server.status === "disabled"
                            ? t("mcp.disabled")
                            : t("mcp.disconnected")}
                  </Badge>
                  <Badge variant="outline">{server.transport.toUpperCase()}</Badge>
                  <Badge variant="neutral">
                    <Wrench className="h-3 w-3" aria-hidden />
                    {server.toolsCount} {t("mcp.toolsCount")}
                  </Badge>
                  <Badge variant="outline">
                    {server.scope === "local" ? t("mcp.local") : t("mcp.remote")}
                  </Badge>
                </div>

                <p className="text-[0.75rem] leading-relaxed text-muted">{server.description}</p>

                {server.command ? (
                  <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2">
                    <p className="text-[0.625rem] uppercase tracking-wide text-subtle">{t("mcp.command")}</p>
                    <p className="truncate font-mono text-[0.6875rem] text-ink" dir="ltr">
                      {server.command} {server.args?.join(" ")}
                    </p>
                  </div>
                ) : server.url ? (
                  <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2">
                    <p className="text-[0.625rem] uppercase tracking-wide text-subtle">{t("mcp.url")}</p>
                    <p className="truncate font-mono text-[0.6875rem] text-ink" dir="ltr">
                      {server.url}
                    </p>
                  </div>
                ) : null}

                {server.envVars.length > 0 ? (
                  <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2">
                    <p className="mb-1 text-[0.625rem] uppercase tracking-wide text-subtle">
                      {t("mcp.envVars")}
                    </p>
                    <ul className="space-y-0.5">
                      {server.envVars.map((variable) => (
                        <li key={variable.key} className="flex items-center gap-2 font-mono text-[0.6875rem]">
                          <span className="text-ink">{variable.key}</span>
                          <span className="truncate text-subtle" dir="ltr">
                            {variable.secret && !showSecrets[server.id]
                              ? "••••••••"
                              : variable.value}
                          </span>
                          {variable.secret ? (
                            <button
                              type="button"
                              onClick={() =>
                                setShowSecrets((current) => ({
                                  ...current,
                                  [server.id]: !current[server.id],
                                }))
                              }
                              className="text-subtle transition-colors hover:text-ink"
                              aria-label={showSecrets[server.id] ? t("providers.hide") : t("providers.reveal")}
                            >
                              {showSecrets[server.id] ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {server.tools.length > 0 ? (
                  <div>
                    <p className="mb-1 text-[0.625rem] uppercase tracking-wide text-subtle">
                      {t("mcp.exposedTools")}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {server.tools.slice(0, 5).map((tool) => (
                        <Badge key={tool} variant="outline">
                          {tool}
                        </Badge>
                      ))}
                      {server.tools.length > 5 ? (
                        <Badge variant="neutral">+{server.tools.length - 5}</Badge>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {testResult && testingId === null ? (
                  <p
                    className={cn(
                      "rounded-lg px-2.5 py-1.5 text-[0.6875rem]",
                      testResult.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
                    )}
                  >
                    {testResult.message}
                  </p>
                ) : null}

                {server.lastCheckedAt ? (
                  <p className="text-[0.6875rem] text-subtle">
                    {t("models.connection")}: {formatRelative(server.lastCheckedAt, locale)}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-2 border-t border-line p-3">
                <Button
                  size="sm"
                  variant="secondary"
                  leadingIcon={<PlugZap className="h-3.5 w-3.5" />}
                  onClick={() => void testConnection(server)}
                  loading={testingId === server.id}
                >
                  {t("mcp.testConnection")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(server);
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
                  onClick={() => setConfirmRemove(server)}
                >
                  {t("common.delete")}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <McpFormDialog
        open={dialogOpen}
        server={editing}
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
        open={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        onConfirm={() => void remove()}
        title={t("mcp.removeServer")}
        body={t("mcp.removeWarning")}
        confirmLabel={t("common.delete")}
        destructive
      />
    </div>
  );
}

function McpFormDialog({
  open,
  server,
  onClose,
  onSaved,
}: {
  open: boolean;
  server: McpServer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const services = useServices();
  const pushToast = useUiStore((state) => state.pushToast);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<McpFormValues>({
    resolver: zodResolver(mcpSchema),
    defaultValues: {
      name: "",
      nameAr: "",
      description: "",
      transport: "stdio",
      command: "",
      args: "",
      url: "",
      authType: "none",
      envKey: "",
      envValue: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (server) {
      reset({
        name: server.name,
        nameAr: server.nameAr,
        description: server.description,
        transport: server.transport,
        command: server.command ?? "",
        args: server.args?.join(" ") ?? "",
        url: server.url ?? "",
        authType: server.authType,
        envKey: server.envVars[0]?.key ?? "",
        envValue: server.envVars[0]?.value ?? "",
      });
    } else {
      reset({
        name: "",
        nameAr: "",
        description: "",
        transport: "stdio",
        command: "",
        args: "",
        url: "",
        authType: "none",
        envKey: "",
        envValue: "",
      });
    }
  }, [open, server, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const envVars =
      values.envKey?.trim()
        ? [{ key: values.envKey.trim(), value: values.envValue ?? "", secret: true }]
        : [];
    try {
      if (server) {
        await services.mcp.updateServer(server.id, {
          name: values.name,
          nameAr: values.nameAr,
          description: values.description,
          transport: values.transport,
          command: values.transport === "stdio" ? values.command : undefined,
          args: values.transport === "stdio" ? values.args?.split(" ").filter(Boolean) : undefined,
          url: values.transport === "stdio" ? undefined : values.url,
          authType: values.authType,
          envVars,
        });
        pushToast({ title: t("mcp.updated"), variant: "success" });
      } else {
        await services.mcp.addServer({
          name: values.name,
          nameAr: values.nameAr,
          description: values.description,
          transport: values.transport,
          enabled: true,
          command: values.transport === "stdio" ? values.command : undefined,
          args: values.transport === "stdio" ? values.args?.split(" ").filter(Boolean) : undefined,
          url: values.transport === "stdio" ? undefined : values.url,
          authType: values.authType,
          envVars,
          scope: values.transport === "stdio" ? "local" : "remote",
        });
        pushToast({ title: t("mcp.added"), variant: "success" });
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

  const currentTransport = watch("transport");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={server ? t("mcp.editServer") : t("mcp.addServer")}
      description={t("mcp.noServersBody")}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="mcp-form" loading={isSubmitting}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <form id="mcp-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("common.name")} htmlFor="mcp-name" required error={errors.name ? t("mcp.nameRequired") : undefined}>
            <Input id="mcp-name" {...register("name")} invalid={Boolean(errors.name)} placeholder="filesystem" dir="ltr" />
          </Field>
          <Field label={`${t("common.name")} (عربي)`} htmlFor="mcp-name-ar" required error={errors.nameAr ? t("mcp.nameRequired") : undefined}>
            <Input id="mcp-name-ar" {...register("nameAr")} invalid={Boolean(errors.nameAr)} dir="rtl" />
          </Field>
        </div>

        <Field label={t("common.description")} htmlFor="mcp-description" required error={errors.description ? t("common.required") : undefined}>
          <Textarea id="mcp-description" {...register("description")} invalid={Boolean(errors.description)} rows={2} />
        </Field>

        <Field label={t("mcp.transport")} htmlFor="mcp-transport" required>
          <Select
            id="mcp-transport"
            {...register("transport")}
          >
            <option value="stdio">{t("mcp.stdio")}</option>
            <option value="sse">{t("mcp.sse")}</option>
            <option value="http">{t("mcp.http")}</option>
            <option value="websocket">{t("mcp.websocket")}</option>
          </Select>
        </Field>

        {currentTransport === "stdio" ? (
          <>
            <Field label={t("mcp.command")} htmlFor="mcp-command" required error={errors.command ? t("mcp.commandRequired") : undefined}>
              <Input id="mcp-command" {...register("command")} invalid={Boolean(errors.command)} placeholder="npx" dir="ltr" className="font-mono" />
            </Field>
            <Field label={t("mcp.args")} htmlFor="mcp-args">
              <Input id="mcp-args" {...register("args")} placeholder="-y @modelcontextprotocol/server-filesystem" dir="ltr" className="font-mono" />
            </Field>
          </>
        ) : (
          <Field label={t("mcp.url")} htmlFor="mcp-url" required error={errors.url ? t("mcp.urlRequired") : undefined}>
            <Input id="mcp-url" {...register("url")} invalid={Boolean(errors.url)} placeholder="http://127.0.0.1:8787/sse" dir="ltr" className="font-mono" />
          </Field>
        )}

        <Field label={t("mcp.authType")} htmlFor="mcp-auth">
          <Select id="mcp-auth" {...register("authType")}>
            <option value="none">{t("mcp.authNone")}</option>
            <option value="header">{t("mcp.authHeader")}</option>
            <option value="bearer">{t("mcp.authBearer")}</option>
            <option value="oauth">{t("mcp.authOauth")}</option>
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("mcp.envVars")} htmlFor="mcp-env-key">
            <Input id="mcp-env-key" {...register("envKey")} placeholder="API_KEY" dir="ltr" className="font-mono" />
          </Field>
          <Field label={t("common.optional")} htmlFor="mcp-env-value">
            <Input id="mcp-env-value" {...register("envValue")} placeholder="••••••" dir="ltr" className="font-mono" type="password" />
          </Field>
        </div>

        <p className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-[0.6875rem] text-muted">
          <ZapOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {t("mcp.testHint")}
        </p>
      </form>
    </Modal>
  );
}
