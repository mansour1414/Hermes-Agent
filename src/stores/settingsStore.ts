import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppSettings } from "@/types";
import type { Locale } from "@/i18n";

export const ACCENT_PRESETS = [
  { id: "teal", name: "Teal", light: "13 148 136", dark: "45 212 191" },
  { id: "indigo", name: "Indigo", light: "79 70 229", dark: "129 140 248" },
  { id: "violet", name: "Violet", light: "124 58 237", dark: "167 139 250" },
  { id: "amber", name: "Amber", light: "217 119 6", dark: "251 191 36" },
  { id: "rose", name: "Rose", light: "225 29 72", dark: "251 113 133" },
  { id: "slate", name: "Slate", light: "51 65 85", dark: "148 163 184" },
] as const;

export type AccentId = (typeof ACCENT_PRESETS)[number]["id"];

const defaultSettings: AppSettings = {
  theme: "dark",
  locale: "ar",
  accent: "teal",
  fontSize: "md",
  density: "comfortable",
  sidebar: "expanded",
  animations: true,
  notifications: { desktop: false, sound: false, digest: true },
  defaultModelId: "m-hermes-pro",
  fallbackModelIds: ["m-hermes-mini", "m-or-llama-free", "m-or-qwen-free"],
  telemetry: false,
  sessionStorage: "memory",
  sensitiveOpsConfirmation: true,
  hermesHome: "D:\\hermes",
  apiEndpoint: "http://127.0.0.1:7717",
  developerMode: false,
  showDemoData: true,
};

interface SettingsState {
  settings: AppSettings;
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  setNotification: (key: keyof AppSettings["notifications"], value: boolean) => void;
  setLocale: (locale: Locale) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      setSetting: (key, value) =>
        set((state) => ({ settings: { ...state.settings, [key]: value } })),
      setNotification: (key, value) =>
        set((state) => ({
          settings: {
            ...state.settings,
            notifications: { ...state.settings.notifications, [key]: value },
          },
        })),
      setLocale: (locale) => set((state) => ({ settings: { ...state.settings, locale } })),
      toggleTheme: () =>
        set((state) => ({
          settings: { ...state.settings, theme: state.settings.theme === "dark" ? "light" : "dark" },
        })),
      toggleSidebar: () =>
        set((state) => ({
          settings: { ...state.settings, sidebar: state.settings.sidebar === "expanded" ? "collapsed" : "expanded" },
        })),
      resetSettings: () => set({ settings: defaultSettings }),
    }),
    {
      name: "hermes.settings.v1",
      partialize: (state) => ({ settings: state.settings }),
    },
  ),
);

export { defaultSettings };
