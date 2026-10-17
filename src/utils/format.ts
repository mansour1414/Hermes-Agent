import type { Locale } from "@/i18n";

const numberFormatters = new Map<string, Intl.NumberFormat>();

function numberFormatter(locale: Locale, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  let fmt = numberFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", options);
    numberFormatters.set(key, fmt);
  }
  return fmt;
}

export function formatNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions): string {
  return numberFormatter(locale, options ?? {}).format(value);
}

export function formatCompact(value: number, locale: Locale): string {
  return numberFormatter(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatCurrency(value: number, locale: Locale): string {
  return numberFormatter(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 1 ? 4 : 2,
  }).format(value);
}

export function formatPercent(value: number, locale: Locale, digits = 0): string {
  return numberFormatter(locale, {
    style: "percent",
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatDate(value: string | Date, locale: Locale): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
  }).format(date);
}

export function formatDateTime(value: string | Date, locale: Locale): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatTime(value: string | Date, locale: Locale): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    timeStyle: "short",
  }).format(date);
}

export function formatRelative(value: string | Date, locale: Locale): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { numeric: "auto" });
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < minute) return rtf.format(Math.round(diff / 1000), "second");
  if (abs < hour) return rtf.format(Math.round(diff / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), "day");
  return formatDate(date, locale);
}

export function formatBytes(bytes: number, locale: Locale): string {
  if (bytes <= 0) return `0 B`;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exp);
  return `${formatNumber(Number(value.toFixed(exp === 0 ? 0 : 1)), locale)} ${units[exp]}`;
}

export function formatDuration(ms: number, locale: Locale): string {
  if (ms < 1000) return `${formatNumber(ms, locale)} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${formatNumber(Number(seconds.toFixed(1)), locale)} s`;
  const minutes = Math.floor(seconds / 60);
  return `${formatNumber(minutes, locale)} min ${formatNumber(Math.round(seconds % 60), locale)} s`;
}

export function formatNumberTokens(value: number, locale: Locale): string {
  return formatCompact(value, locale);
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
