import { useRef, useState, type KeyboardEvent } from "react";
import { Paperclip, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { useI18n } from "@/i18n";

export interface ComposerAttachment {
  name: string;
  size: number;
  mime: string;
  content?: string;
}

export function ChatComposer({
  onSend,
  onStop,
  streaming,
  disabled,
  attachments,
  onRemoveAttachment,
  onAddAttachment,
}: {
  onSend: (value: string) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
  attachments: ComposerAttachment[];
  onRemoveAttachment: (index: number) => void;
  onAddAttachment: (file: File) => void;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    if (!value.trim() || streaming || disabled) return;
    onSend(value.trim());
    setValue("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="shrink-0 border-t border-line bg-surface px-3 py-3 sm:px-5">
      <div className="mx-auto w-full max-w-[46rem]">
        {attachments.length > 0 ? (
          <ul className="mb-2 flex flex-wrap gap-2">
            {attachments.map((attachment, index) => (
              <li
                key={`${attachment.name}-${index}`}
                className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-[0.75rem] text-ink"
              >
                <Paperclip className="h-3.5 w-3.5 text-subtle" aria-hidden />
                <span className="max-w-40 truncate">{attachment.name}</span>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(index)}
                  className="text-subtle transition-colors hover:text-danger"
                  aria-label={t("common.remove")}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="rounded-xl border border-line bg-canvas focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/20">
          <label htmlFor="composer-input" className="sr-only">
            {t("chats.messagePlaceholder")}
          </label>
          <textarea
            id="composer-input"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            disabled={disabled}
            placeholder={t("chats.messagePlaceholder")}
            className="cc-scroll max-h-36 min-h-[3rem] w-full resize-y bg-transparent px-3 py-2.5 text-[0.875rem] leading-relaxed text-ink outline-none placeholder:text-subtle sm:px-4"
          />
          <div className="flex items-center justify-between gap-2 px-2.5 pb-2">
            <div className="flex items-center gap-1">
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  files.forEach((file) => onAddAttachment(file));
                  event.target.value = "";
                }}
              />
              <Tooltip content={t("chats.attachFile")}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => fileRef.current?.click()}
                  aria-label={t("chats.attachFile")}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </Tooltip>
              {streaming ? (
                <span className="ms-1 flex items-center gap-1.5 text-[0.6875rem] text-accent">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                  {t("chats.streaming")}
                </span>
              ) : null}
            </div>

            {streaming ? (
              <Button variant="secondary" size="sm" onClick={onStop} leadingIcon={<Square className="h-3 w-3" />}>
                {t("chats.stop")}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={submit}
                disabled={!value.trim() || disabled}
                trailingIcon={<Send className="h-3.5 w-3.5 rtl:-scale-x-100" />}
              >
                {t("chats.send")}
              </Button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
