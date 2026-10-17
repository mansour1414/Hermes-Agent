import { useState } from "react";
import { Info, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { isDemoMode } from "@/services";
import { Tooltip } from "@/components/ui/Tooltip";

export function DemoBanner() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(true);
  // Real data in use: this banner must never show. It exists to make demo data
  // unmistakable when someone deliberately opts into the mock adapter.
  if (!isDemoMode()) return null;
  if (!visible) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-warning/20 bg-warning-soft px-4 py-1.5 text-[0.75rem] text-warning"
    >
      <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate font-medium">{t("demo.bannerTitle")}</span>
      <Tooltip content={t("demo.bannerBody")}>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="ms-1 rounded p-0.5 transition-colors hover:bg-warning/10"
          aria-label={t("demo.dismiss")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
    </div>
  );
}
