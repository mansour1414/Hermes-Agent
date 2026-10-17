import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, X, TriangleAlert } from "lucide-react";
import { useUiStore, type Toast as ToastModel } from "@/stores/uiStore";
import { cn } from "@/utils/cn";

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: TriangleAlert,
};

const tones = {
  success: "text-success",
  error: "text-danger",
  info: "text-info",
  warning: "text-warning",
};

function ToastItem({ toast }: { toast: ToastModel }) {
  const dismiss = useUiStore((state) => state.dismissToast);
  const Icon = icons[toast.variant];

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(toast.id), toast.duration ?? 4200);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.duration, dismiss]);

  return (
    <div
      role="status"
      className="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-[var(--shadow-float)] animate-[slide-up_0.2s_cubic-bezier(0.22,1,0.36,1)]"
    >
      <Icon className={cn("mt-0.5 h-4.5 w-4.5 shrink-0", tones[toast.variant])} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[0.8125rem] font-semibold text-ink">{toast.title}</p>
        {toast.description ? (
          <p className="mt-0.5 text-[0.75rem] leading-relaxed text-muted">{toast.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        className="rounded-md p-1 text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
        aria-label="close"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useUiStore((state) => state.toasts);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="pointer-events-none fixed bottom-4 end-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>,
    document.body,
  );
}
