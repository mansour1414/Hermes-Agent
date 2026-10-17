import { describe, expect, it } from "vitest";
import { en } from "@/locales/en";
import { ar } from "@/locales/ar";

describe("locales", () => {
  it("exposes the same keys in both languages", () => {
    const enKeys = Object.keys(en).sort();
    const arKeys = Object.keys(ar).sort();
    expect(arKeys).toEqual(enKeys);
  });

  it("has no empty translations", () => {
    const empty = Object.entries(ar).filter(([, value]) => value.trim().length === 0);
    expect(empty).toEqual([]);
  });

  it("keeps the same interpolation placeholders", () => {
    const placeholders = (value: string) => (value.match(/\{(\w+)\}/g) ?? []).sort();
    Object.keys(en).forEach((key) => {
      expect(placeholders(ar[key as keyof typeof ar])).toEqual(
        placeholders(en[key as keyof typeof en]),
      );
    });
  });
});
