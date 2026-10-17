import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en, type TranslationKey } from "@/locales/en";
import { ar } from "@/locales/ar";

export type Locale = "ar" | "en";
export type Direction = "rtl" | "ltr";

export type TranslateValues = Record<string, string | number>;

type Dictionary = Record<TranslationKey, string>;

const DICTIONARIES: Record<Locale, Dictionary> = { ar, en };

export interface I18nContextValue {
  locale: Locale;
  dir: Direction;
  t: (key: TranslationKey, values?: TranslateValues) => string;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (value: string | Date) => string;
  formatRelative: (value: string | Date) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const LOCALE_STORAGE_KEY = "hermes.locale";

function interpolate(template: string, values?: TranslateValues): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export function I18nProvider({
  children,
  initialLocale = "ar",
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return initialLocale;
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return stored === "ar" || stored === "en" ? stored : initialLocale;
  });

  const dir: Direction = locale === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = dir;
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale, dir]);

  const setLocale = useCallback((next: Locale) => setLocaleState(next), []);
  const toggleLocale = useCallback(
    () => setLocaleState((prev) => (prev === "ar" ? "en" : "ar")),
    [],
  );

  const t = useCallback(
    (key: TranslationKey, values?: TranslateValues) => {
      const dictionary = DICTIONARIES[locale];
      const template = dictionary[key] ?? en[key] ?? key;
      return interpolate(template, values);
    },
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      dir,
      t,
      setLocale,
      toggleLocale,
      formatNumber: (v, options) =>
        new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", options).format(v),
      formatDate: (v, options) =>
        new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", options ?? { dateStyle: "medium" }).format(
          typeof v === "string" ? new Date(v) : v,
        ),
      formatDateTime: (v) =>
        new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(typeof v === "string" ? new Date(v) : v),
      formatRelative: (v) => {
        const date = typeof v === "string" ? new Date(v) : v;
        const diff = date.getTime() - Date.now();
        const abs = Math.abs(diff);
        const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
          numeric: "auto",
        });
        const minute = 60_000;
        const hour = 60 * minute;
        const day = 24 * hour;
        if (abs < minute) return rtf.format(Math.round(diff / 1000), "second");
        if (abs < hour) return rtf.format(Math.round(diff / minute), "minute");
        if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
        if (abs < 30 * day) return rtf.format(Math.round(diff / day), "day");
        return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium" }).format(date);
      },
    }),
    [locale, dir, t, setLocale, toggleLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within <I18nProvider>");
  }
  return context;
}

/** Convenience hook that only exposes the translate function. */
export function useTranslation(): { t: I18nContextValue["t"]; locale: Locale; dir: Direction } {
  const { t, locale, dir } = useI18n();
  return { t, locale, dir };
}

export type { TranslationKey };
