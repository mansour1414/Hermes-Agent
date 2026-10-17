import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In a real build this is where a telemetry/report hook would be called.
    console.error("Hermes Control Center — unhandled error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} onReset={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[24rem] items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-danger/30 bg-danger-soft/40 p-6 text-center">
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-danger-soft text-danger">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </span>
        <h1 className="text-[0.9375rem] font-semibold text-ink">{t("errors.boundaryTitle")}</h1>
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">{t("errors.boundaryBody")}</p>
        <pre className="cc-scroll mt-3 max-h-32 overflow-auto rounded-lg bg-canvas-alt p-2.5 text-start font-mono text-[0.6875rem] text-subtle" dir="ltr">
          {error.message}
        </pre>
        <Button className="mt-4" leadingIcon={<RefreshCw className="h-4 w-4" />} onClick={onReset}>
          {t("errors.reload")}
        </Button>
      </div>
    </div>
  );
}
