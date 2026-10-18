import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AppRoot } from "@/app/AppRoot";
import { useSettingsStore, defaultSettings } from "@/stores/settingsStore";
import { demoStore } from "@/services/adapters/mock/store";
import { useUiStore } from "@/stores/uiStore";

beforeEach(() => {
  window.localStorage.clear();
  // The i18n provider restores the locale from localStorage — pin it to Arabic
  // so the assertions below stay deterministic regardless of test order.
  window.localStorage.setItem("hermes.locale", "ar");
  // UI tests intentionally run against the deterministic demo adapter.
  window.localStorage.setItem("cc.adapter-mode", "mock");
  useSettingsStore.setState({ settings: defaultSettings });
  // Zustand UI state is in-memory and survives component cleanup between tests.
  useUiStore.setState({ commandPaletteOpen: false, mobileSidebarOpen: false, toasts: [] });
  demoStore.reset();
});

function renderApp(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoot />
    </MemoryRouter>,
  );
}

const main = () => within(screen.getByRole("main"));

describe("application shell", () => {
  it("renders without crashing and shows the dashboard", async () => {
    renderApp("/");
    expect((await screen.findAllByText("لوحة التحكم")).length).toBeGreaterThan(0);
    expect(await main().findByText("نظرة عامة على النظام", {}, { timeout: 10000 })).toBeInTheDocument();
  });

  it("renders the demo mode banner", async () => {
    renderApp("/");
    expect(
      (await screen.findAllByText(/الوضع التجريبي — غير متصل بهيرميس/)).length,
    ).toBeGreaterThan(0);
  });

  it("shows the sidebar navigation entries", async () => {
    renderApp("/");
    const nav = await screen.findByRole("navigation", { name: /التنقل الرئيسي|Primary navigation/ });
    expect(within(nav).getAllByRole("link").length).toBeGreaterThan(10);
  });

  it("has no broken routes — the 404 page renders for unknown paths", async () => {
    renderApp("/does-not-exist");
    expect(await screen.findByText("404")).toBeInTheDocument();
  });
});

describe("navigation", () => {
  it("navigates to the models page", async () => {
    const user = userEvent.setup();
    renderApp("/");
    const link = await screen.findByRole("link", { name: "النماذج" });
    await user.click(link);
    expect(
      await main().findByText("الفهرس والإعداد والتسعير لكل نموذج", { exact: false }, { timeout: 10000 }),
    ).toBeInTheDocument();
  });

  it("navigates to the settings page", async () => {
    const user = userEvent.setup();
    renderApp("/");
    const link = await screen.findByRole("link", { name: "الإعدادات" });
    await user.click(link);
    expect(await main().findByText("تفضيلات مركز التحكم")).toBeInTheDocument();
  });

  it("navigates to the skills page", async () => {
    const user = userEvent.setup();
    renderApp("/");
    const link = await screen.findByRole("link", { name: "المهارات" });
    await user.click(link);
    expect(await main().findByText("قدرات قابلة لإعادة الاستخدام يمكنك تثبيتها وتفعيلها")).toBeInTheDocument();
  });
});

describe("theme and language", () => {
  it("switches to light mode", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await screen.findAllByText("لوحة التحكم");
    const toggle = screen.getByRole("button", { name: "تبديل المظهر" });
    await user.click(toggle);
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });

  it("switches the interface language to English", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await screen.findAllByText("لوحة التحكم");
    const menu = screen.getByRole("button", { name: "قائمة المستخدم" });
    await user.click(menu);
    const english = await screen.findByRole("menuitem", { name: "English" });
    await user.click(english);
    expect((await screen.findAllByText("Dashboard")).length).toBeGreaterThan(0);
  });
});

describe("command palette", () => {
  it("opens with Ctrl+K and filters commands", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await screen.findAllByText("لوحة التحكم");
    await user.keyboard("{Control>}k{/Control}");
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByRole("textbox");
    await user.type(input, "النماذج");
    expect(await within(dialog).findByText("النماذج")).toBeInTheDocument();
  });
});

describe("projects", () => {
  it("creates a project through the form dialog", async () => {
    const user = userEvent.setup();
    renderApp("/projects");
    await main().findByText("مساحات عمل تجمع المحادثات", { exact: false });
    await user.click(screen.getByRole("button", { name: "مشروع جديد" }));

    const dialog = await screen.findByRole("dialog", { name: /مشروع/ });
    await user.type(within(dialog).getByRole("textbox", { name: /^اسم المشروع\s*\*?$/ }), "Test Project");
    await user.type(within(dialog).getByRole("textbox", { name: /اسم المشروع \(عربي\)/ }), "مشروع تجريبي");
    await user.type(
      within(dialog).getByLabelText(/^الوصف/),
      "A demo project created from the test suite.",
    );
    await user.click(within(dialog).getByRole("button", { name: "حفظ المشروع" }));

    await waitFor(() => {
      expect(within(screen.getByRole("main")).getAllByText("مشروع تجريبي").length).toBeGreaterThan(0);
    }, { timeout: 10000 });
  }, 15000);

  it("validates the project form", async () => {
    const user = userEvent.setup();
    renderApp("/projects");
    await main().findByText("مساحات عمل تجمع المحادثات", { exact: false });
    await user.click(screen.getByRole("button", { name: "مشروع جديد" }));
    const dialog = (await screen.findAllByRole("dialog"))[0];
    await user.click(within(dialog).getByRole("button", { name: "حفظ المشروع" }));
    expect((await within(dialog).findAllByText(/مطلوب/)).length).toBeGreaterThan(0);
  });
});

describe("mcp form validation", () => {
  it("requires a command for the stdio transport", async () => {
    const user = userEvent.setup();
    renderApp("/mcp");
    await main().findByText("خوادم بروتوكول MCP والأدوات التي تتيحها");
    await user.click(screen.getByRole("button", { name: "إضافة خادم" }));
    const dialog = await screen.findByRole("dialog", { name: "إضافة خادم" });
    await user.type(within(dialog).getByRole("textbox", { name: /^الاسم\s*\*?$/ }), "demo");
    await user.type(within(dialog).getByRole("textbox", { name: /الاسم \(عربي\)/ }), "تجريبي");
    await user.type(within(dialog).getByLabelText(/^الوصف/), "demo server description");
    await user.click(within(dialog).getByRole("button", { name: "حفظ" }));
    expect(await within(dialog).findByText(/الأمر مطلوب/)).toBeInTheDocument();
  });
});

describe("skills", () => {
  it("filters skills by search term", async () => {
    const user = userEvent.setup();
    renderApp("/skills");
    await main().findByText("قدرات قابلة لإعادة الاستخدام يمكنك تثبيتها وتفعيلها");
    const search = screen.getByRole("textbox", { name: "ابحث في المهارات" });
    await user.type(search, "refactor");
    await waitFor(() => {
      expect(screen.getAllByText("refactor").length).toBeGreaterThan(0);
    });
    expect(main().queryByText("doc-writer")).not.toBeInTheDocument();
  });
});

describe("models", () => {
  it("renders the model table and filters by provider", async () => {
    const user = userEvent.setup();
    renderApp("/models");
    await main().findByText("الفهرس والإعداد والتسعير لكل نموذج", { exact: false });
    await waitFor(() => {
      expect(screen.getAllByText("Hermes Pro").length).toBeGreaterThan(0);
    });

    const providerSelect = screen.getByLabelText("المزوّد");
    await waitFor(() => {
      expect(within(providerSelect).getByRole("option", { name: "OpenRouter" })).toBeInTheDocument();
    });
    await user.selectOptions(providerSelect, "OpenRouter");
    await waitFor(() => {
      expect(main().queryByText("Hermes Pro")).not.toBeInTheDocument();
    });
  });
});

describe("chats", () => {
  it("creates a demo conversation and streams a reply", async () => {
    const user = userEvent.setup();
    renderApp("/chats");
    await main().findAllByRole("button", { name: "محادثة جديدة" }, { timeout: 10000 });
    await user.click(screen.getAllByRole("button", { name: "محادثة جديدة" })[0]);

    const composer = await screen.findByLabelText("أرسل رسالة إلى هيرميس…");
    await user.type(composer, "اختبر البث التجريبي");
    await user.click(screen.getByRole("button", { name: "إرسال" }));

    await waitFor(
      () => {
        expect(screen.getAllByText(/رد تجريبي|سأحلّل طلبك/).length).toBeGreaterThan(0);
      },
      { timeout: 6000 },
    );
  }, 15000);
});
