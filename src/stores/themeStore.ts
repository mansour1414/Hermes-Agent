import { useEffect } from "react";
import { useSettingsStore, ACCENT_PRESETS } from "@/stores/settingsStore";

/** Applies the persisted appearance settings to the document root. */
export function useThemeEffect() {
  const settings = useSettingsStore((state) => state.settings);

  useEffect(() => {
    const root = document.documentElement;
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = settings.theme === "dark" || (settings.theme === "system" && prefersDark);

    root.classList.toggle("dark", dark);
    root.dataset.fontSize = settings.fontSize;
    root.dataset.animations = settings.animations ? "on" : "off";
    root.dataset.density = settings.density;
  }, [settings.theme, settings.fontSize, settings.animations, settings.density]);

  useEffect(() => {
    const root = document.documentElement;
    const preset = ACCENT_PRESETS.find((item) => item.id === settings.accent) ?? ACCENT_PRESETS[0];
    const dark = root.classList.contains("dark");
    const value = dark ? preset.dark : preset.light;
    root.style.setProperty("--cc-accent", value);
    root.style.setProperty("--cc-accent-hover", value);
    root.style.setProperty("--cc-accent-fg", dark ? "4 22 20" : "255 255 255");
    root.style.setProperty("--cc-accent-soft", dark ? "15 51 48" : "226 244 241");
  }, [settings.accent, settings.theme]);
}
