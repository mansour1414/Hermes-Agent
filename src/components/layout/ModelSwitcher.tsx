import { useEffect, useState } from "react";
import { Check, Cpu, Loader2 } from "lucide-react";
import { useServices } from "@/services";
import { useI18n } from "@/i18n";
import type { ModelInfo } from "@/types";
import { Dropdown } from "@/components/ui/Dropdown";
import { useSettingsStore } from "@/stores/settingsStore";

export function ModelSwitcher() {
  const { t } = useI18n();
  const services = useServices();
  const defaultModelId = useSettingsStore((state) => state.settings.defaultModelId);
  const setSetting = useSettingsStore((state) => state.setSetting);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [activeId, setActiveId] = useState<string>(defaultModelId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([services.model.listModels(), services.model.getActiveModel()])
      .then(([list, active]) => {
        if (cancelled) return;
        setModels(list);
        setActiveId(active.id);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [services]);

  const active = models.find((model) => model.id === activeId);

  const select = async (model: ModelInfo) => {
    setActiveId(model.id);
    setSetting("defaultModelId", model.id);
    await services.model.setActiveModel(model.id);
  };

  return (
    <Dropdown
      align="end"
      trigger={
        <button
          type="button"
          className="flex h-9 max-w-[12rem] items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 text-[0.8125rem] font-medium text-ink transition-colors hover:bg-surface-3"
          aria-label={t("topbar.modelSelector")}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-subtle" />
          ) : (
            <Cpu className="h-4 w-4 text-accent" />
          )}
          <span className="hidden truncate md:inline">
            {active?.name ?? t("topbar.modelSelector")}
          </span>
        </button>
      }
      items={models.map((model) => ({
        id: model.id,
        label: model.name,
        icon: model.id === activeId ? <Check className="h-4 w-4 text-accent" /> : <span className="h-4 w-4" />,
        onSelect: () => {
          void select(model);
        },
      }))}
    />
  );
}
