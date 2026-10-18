import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  Archive,
  ChevronDown,
  Copy,
  Check,
  MoreHorizontal,
  Pin,
  RefreshCw,
  Trash2,
  MessageSquarePlus,
  Cpu,
  FolderKanban,
  Wrench,
  Clock,
  Coins,
  AlertCircle,
} from "lucide-react";
import { useServices } from "@/services";
import { useI18n } from "@/i18n";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import type { ChatMessage, ChatSession, ModelInfo, Project } from "@/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dropdown, type DropdownItem } from "@/components/ui/Dropdown";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Tooltip } from "@/components/ui/Tooltip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { MarkdownMessage } from "@/features/chats/MarkdownMessage";
import { ChatComposer, type ComposerAttachment } from "@/features/chats/ChatComposer";
import { cn } from "@/utils/cn";
import { formatNumber, formatRelative } from "@/utils/format";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

export function ChatPanel() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const services = useServices();
  const defaultModelId = useSettingsStore((state) => state.settings.defaultModelId);
  const pushToast = useUiStore((state) => state.pushToast);
  const { copied, copy } = useCopyToClipboard();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [draftMessages, setDraftMessages] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      services.chat.listSessions(),
      services.model.listModels(),
      services.project.listProjects(),
    ])
      .then(([sessionList, modelList, projectList]) => {
        if (cancelled) return;
        setSessions(sessionList);
        setModels(modelList);
        setProjects(projectList);
      })
      .catch((error) => {
        if (!cancelled) {
          pushToast({ title: t("chats.errorTitle"), description: error instanceof Error ? error.message : t("common.error"), variant: "error" });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [services, pushToast, t]);

  // Load active session
  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      return;
    }
    let cancelled = false;
    services.chat
      .getSession(sessionId)
      .then((result) => {
        if (!cancelled) setSession(result);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, services]);

  // Create a new session when ?new=1
  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    let cancelled = false;
    services.chat
      .createSession({ modelId: defaultModelId })
      .then((created) => {
        if (cancelled) return;
        navigate(`/chats/${created.id}`, { replace: true });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [searchParams, services, defaultModelId, navigate]);

  useEffect(() => {
    const panel = messageScrollRef.current;
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, [session?.messages.length, streaming]);

  const handleSend = async (content: string) => {
    if (!session) return;
    setStreaming(true);
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
      demo: false,
    };
    setSession((current) =>
      current ? { ...current, messages: [...current.messages, optimistic] } : current,
    );

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      for await (const event of services.chat.sendMessage({
        sessionId: session.id,
        content,
        attachments: attachments.map((attachment) => ({
          name: attachment.name,
          size: attachment.size,
          mime: attachment.mime,
          content: attachment.content,
        })),
      })) {
        if (controller.signal.aborted) break;
        if (event.type === "message-delta") {
          setDraftMessages((current) => ({
            ...current,
            [event.messageId]: (current[event.messageId] ?? "") + event.delta,
          }));
        }
        if (event.type === "message-end") {
          setDraftMessages((current) => {
            const next = { ...current };
            delete next[event.messageId];
            return next;
          });
          const refreshed = await services.chat.getSession(session.id);
          setSession(refreshed);
          setSessions((current) =>
            current.map((item) => (item.id === refreshed.id ? refreshed : item)),
          );
        }
      }
    } catch (error) {
      pushToast({
        title: t("chats.errorTitle"),
        description: error instanceof Error ? error.message : t("common.error"),
        variant: "error",
      });
    } finally {
      setStreaming(false);
      setAttachments([]);
      abortRef.current = null;
    }
  };

  const handleStop = async () => {
    const active = session;
    if (active) {
      try {
        await services.chat.stopGeneration(active.id);
      } catch {
        /* the stream reader is aborted either way */
      }
    }
    abortRef.current?.abort();
    setStreaming(false);
    // A stopped turn never emits `message-end`, so clear the drafts here and
    // resync from Hermes so the transcript matches the persisted session.
    setDraftMessages({});
    if (active) {
      try {
        const refreshed = await services.chat.getSession(active.id);
        setSession(refreshed);
        setSessions((current) => current.map((item) => (item.id === refreshed.id ? refreshed : item)));
      } catch {
        /* stop already ended the stream; keep the local transcript */
      }
    }
  };

  const handleRegenerate = async (message: ChatMessage) => {
    if (!session) return;
    setStreaming(true);
    try {
      for await (const event of services.chat.regenerate(message.id, session.id)) {
        if (event.type === "message-delta") {
          setDraftMessages((current) => ({
            ...current,
            [event.messageId]: (current[event.messageId] ?? "") + event.delta,
          }));
        }
        if (event.type === "message-end") {
          const refreshed = await services.chat.getSession(session.id);
          setSession(refreshed);
          setSessions((current) => current.map((item) => (item.id === refreshed.id ? refreshed : item)));
        }
      }
    } finally {
      setStreaming(false);
    }
  };

  const renameSession = async () => {
    if (!session) return;
    const next = window.prompt(t("chats.rename"), session.title);
    if (!next) return;
    const updated = await services.chat.renameSession(session.id, next.trim());
    setSession(updated);
    setSessions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  };

  const togglePinned = async () => {
    if (!session) return;
    const updated = await services.chat.setPinned(session.id, !session.pinned);
    setSession(updated);
    setSessions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  };

  const archiveSession = async () => {
    if (!session) return;
    const updated = await services.chat.setArchived(session.id, true);
    setSessions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    navigate("/chats");
  };

  const deleteSession = async () => {
    if (!session) return;
    await services.chat.deleteSession(session.id);
    setConfirmDelete(false);
    navigate("/chats");
  };

  const sessionMenu: DropdownItem[] = session
    ? [
        { id: "rename", label: t("chats.rename"), icon: <MoreHorizontal className="h-4 w-4" />, onSelect: () => void renameSession() },
        {
          id: "pin",
          label: session.pinned ? t("common.unpin") : t("chats.pin"),
          icon: <Pin className="h-4 w-4" />,
          onSelect: () => void togglePinned(),
        },
        {
          id: "archive",
          label: t("chats.archive"),
          icon: <Archive className="h-4 w-4" />,
          onSelect: () => void archiveSession(),
        },
        {
          id: "delete",
          label: t("chats.delete"),
          icon: <Trash2 className="h-4 w-4" />,
          danger: true,
          separatorBefore: true,
          onSelect: () => setConfirmDelete(true),
        },
      ]
    : [];

  const visibleMessages = session?.messages ?? [];
  const hasDraft = Object.keys(draftMessages).length > 0;

  return (
    <div className="flex h-full min-h-0 min-w-0 overflow-hidden rounded-2xl border border-line bg-surface">
      {/* Session list */}
      <aside className="hidden w-72 shrink-0 flex-col border-e border-line bg-canvas-alt lg:flex">
        <div className="border-b border-line p-3">
          <Button
            className="w-full"
            leadingIcon={<MessageSquarePlus className="h-4 w-4" />}
            onClick={() => navigate("/chats?new=1")}
          >
            {t("chats.newChat")}
          </Button>
        </div>
        <div className="cc-scroll min-h-0 flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="space-y-2 p-1">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : sessions.length === 0 ? (
            <EmptyState title={t("chats.noChats")} description={t("chats.emptyBody")} />
          ) : (
            <ul className="space-y-0.5">
              {sessions.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/chats/${item.id}`)}
                    className={cn(
                      "w-full rounded-lg px-2.5 py-2.5 text-start transition-colors",
                      item.id === sessionId
                        ? "bg-accent-soft"
                        : "hover:bg-surface-2",
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      {item.pinned ? <Pin className="h-3 w-3 shrink-0 text-accent" aria-hidden /> : null}
                      <span
                        className={cn(
                          "flex-1 truncate text-[0.8125rem] font-medium",
                          item.id === sessionId ? "text-accent" : "text-ink",
                        )}
                      >
                        {item.title}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[0.6875rem] text-subtle">
                      {formatRelative(item.updatedAt, locale)} · {item.messageCount}{" "}
                      {t("chats.messageCount")}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Conversation */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        {session ? (
          <>
            <header className="flex items-center gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-[0.9375rem] font-semibold text-ink">
                    {session.title}
                  </h2>
                  {session.pinned ? <Badge variant="accent">{t("chats.pinned")}</Badge> : null}
                  {session.demo ? <Badge variant="warning">{t("demo.badge")}</Badge> : null}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[0.6875rem] text-subtle">
                  <span className="flex items-center gap-1">
                    <Cpu className="h-3 w-3" aria-hidden />
                    {models.find((model) => model.id === session.modelId)?.name ?? "—"}
                  </span>
                  {session.projectId ? (
                    <span className="flex items-center gap-1">
                      <FolderKanban className="h-3 w-3" aria-hidden />
                      {projects.find((project) => project.id === session.projectId)?.name ?? "—"}
                    </span>
                  ) : null}
                </div>
              </div>
              <Dropdown
                trigger={
                  <Button variant="ghost" size="icon" aria-label={t("common.actions")}>
                    <MoreHorizontal className="h-4.5 w-4.5" />
                  </Button>
                }
                items={sessionMenu}
              />
            </header>

            <div ref={messageScrollRef} className="cc-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-5">
              <div className="mx-auto w-full max-w-3xl space-y-5">
                {visibleMessages.length === 0 && !hasDraft ? (
                  <EmptyState
                    icon={<MessageSquarePlus className="h-5 w-5" />}
                    title={t("chats.emptyChatTitle")}
                    description={t("chats.emptyChatBody")}
                  />
                ) : null}

                {visibleMessages.map((message) => (
                  <MessageBlock
                    key={message.id}
                    message={message}
                    locale={locale}
                    onCopy={() => void copy(message.content)}
                    copied={copied}
                    onRegenerate={() => void handleRegenerate(message)}
                    expandedTools={expandedTools}
                    setExpandedTools={setExpandedTools}
                    streaming={false}
                  />
                ))}

                {Object.entries(draftMessages).map(([id, delta]) => (
                  <MessageBlock
                    key={id}
                    message={{
                      id,
                      role: "assistant",
                      content: delta,
                      createdAt: new Date().toISOString(),
                      demo: false,
                      streaming: true,
                    }}
                    locale={locale}
                    onCopy={() => undefined}
                    copied={false}
                    onRegenerate={() => undefined}
                    expandedTools={expandedTools}
                    setExpandedTools={setExpandedTools}
                    streaming
                  />
                ))}

                <div aria-hidden="true" />
              </div>
            </div>

            <ChatComposer
              onSend={(value) => void handleSend(value)}
              onStop={() => void handleStop()}
              streaming={streaming}
              attachments={attachments}
              onRemoveAttachment={(index) =>
                setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))
              }
              onAddAttachment={(file) =>
                setAttachments((current) => [
                  ...current,
                  { name: file.name, size: file.size, mime: file.type || "text/plain" },
                ])
              }
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <EmptyState
              icon={<MessageSquarePlus className="h-5 w-5" />}
              title={t("chats.emptyTitle")}
              description={t("chats.emptyBody")}
              action={
                <Button onClick={() => navigate("/chats?new=1")} leadingIcon={<MessageSquarePlus className="h-4 w-4" />}>
                  {t("chats.newChat")}
                </Button>
              }
            />
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void deleteSession()}
        title={t("chats.delete")}
        body={t("chats.deleteWarning")}
        confirmLabel={t("common.delete")}
        destructive
      />
    </div>
  );
}

function MessageBlock({
  message,
  locale,
  onCopy,
  copied,
  onRegenerate,
  expandedTools,
  setExpandedTools,
  streaming,
}: {
  message: ChatMessage;
  locale: string;
  onCopy: () => void;
  copied: boolean;
  onRegenerate: () => void;
  expandedTools: Record<string, boolean>;
  setExpandedTools: (value: Record<string, boolean>) => void;
  streaming: boolean;
}) {
  const { t } = useI18n();
  const isUser = message.role === "user";

  return (
    <article
      className={cn(
        "group relative rounded-2xl border px-4 py-3.5",
        isUser
          ? "ms-auto max-w-[85%] border-accent/25 bg-accent-soft/50"
          : "me-auto w-full max-w-[92%] border-line bg-surface-2/60",
      )}
      aria-label={isUser ? t("chats.user") : t("chats.assistant")}
    >
      <header className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md text-[0.625rem] font-bold",
            isUser ? "bg-accent text-accent-fg" : "bg-surface-3 text-muted",
          )}
          aria-hidden
        >
          {isUser ? "YOU" : "AI"}
        </span>
        <span className="text-[0.75rem] font-semibold text-ink">
          {isUser ? t("chats.user") : t("chats.assistant")}
        </span>
        {message.demo ? <Badge variant="warning">{t("chats.demoResponse")}</Badge> : null}
        <span className="ms-auto text-[0.6875rem] text-subtle">
          {formatRelative(message.createdAt, locale as "ar" | "en")}
        </span>
      </header>

      {isUser ? (
        <p className="whitespace-pre-wrap text-[0.875rem] leading-[1.85] text-ink">{message.content}</p>
      ) : (
        <>
          <MarkdownMessage content={message.content} />
          {streaming ? (
            <span className="mt-2 flex items-center gap-1.5 text-[0.6875rem] text-accent">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              {t("chats.thinking")}
            </span>
          ) : null}
        </>
      )}

      {message.attachments && message.attachments.length > 0 ? (
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {message.attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="rounded-md border border-line bg-surface px-2 py-1 text-[0.6875rem] text-muted"
            >
              {attachment.name}
            </li>
          ))}
        </ul>
      ) : null}

      {message.toolCalls && message.toolCalls.length > 0 ? (
        <div className="mt-3 space-y-1.5">
          {message.toolCalls.map((tool) => {
            const open = expandedTools[tool.id] ?? false;
            return (
              <div key={tool.id} className="overflow-hidden rounded-lg border border-line bg-surface">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedTools({ ...expandedTools, [tool.id]: !open })
                  }
                  className="flex w-full items-center gap-2 px-2.5 py-2 text-start text-[0.75rem] transition-colors hover:bg-surface-2"
                  aria-expanded={open}
                >
                  <Wrench className="h-3.5 w-3.5 text-subtle" aria-hidden />
                  <span className="font-medium text-ink">{tool.name}</span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[0.625rem]",
                      tool.status === "success"
                        ? "bg-success-soft text-success"
                        : tool.status === "error"
                          ? "bg-danger-soft text-danger"
                          : "bg-info-soft text-info",
                    )}
                  >
                    {tool.status}
                  </span>
                  <span className="ms-auto flex items-center gap-1 text-subtle">
                    {formatNumber(tool.durationMs, "en")} ms
                    <ChevronDown
                      className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
                      aria-hidden
                    />
                  </span>
                </button>
                {open ? (
                  <div className="border-t border-line px-2.5 py-2 text-[0.75rem] text-muted">
                    <p className="font-medium text-ink">{tool.summary}</p>
                    {tool.output ? (
                      <pre className="cc-scroll mt-1.5 overflow-x-auto whitespace-pre-wrap rounded-md bg-canvas-alt p-2 font-mono text-[0.6875rem]">
                        {tool.output}
                      </pre>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {!isUser && !streaming ? (
        <footer className="mt-3 flex flex-wrap items-center gap-3 text-[0.6875rem] text-subtle">
          {message.durationMs ? (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden />
              {formatNumber(message.durationMs, "en")} ms
            </span>
          ) : null}
          {message.tokens ? (
            <span className="flex items-center gap-1">
              <Coins className="h-3 w-3" aria-hidden />
              {formatNumber(message.tokens.total, "en")} {t("chats.tokens")}
            </span>
          ) : null}
          <div className="ms-auto flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <Tooltip content={copied ? t("common.copied") : t("chats.copyMessage")}>
              <Button variant="ghost" size="icon-sm" onClick={onCopy} aria-label={t("chats.copyMessage")}>
                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </Tooltip>
            <Tooltip content={t("chats.regenerate")}>
              <Button variant="ghost" size="icon-sm" onClick={onRegenerate} aria-label={t("chats.regenerate")}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          </div>
        </footer>
      ) : null}

      {message.error === "stopped" ? (
        <p className="mt-2 flex items-center gap-1.5 text-[0.6875rem] text-warning">
          <AlertCircle className="h-3 w-3" aria-hidden />
          {t("chats.stopped")}
        </p>
      ) : null}
    </article>
  );
}
