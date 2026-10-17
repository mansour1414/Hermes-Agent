import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

describe("jsdom label behaviour", () => {
  it("plain label", () => {
    render(
      <div>
        <label htmlFor="x">اسم المشروع*</label>
        <input id="x" />
      </div>,
    );
    const el = screen.getByLabelText(/^اسم المشروع/);
    expect(el.id).toBe("x");
  });

  it("label inside a portal-like container", () => {
    const { container } = render(
      <div role="dialog">
        <label htmlFor="y">اسم المشروع*</label>
        <input id="y" />
      </div>,
    );
    const input = container.querySelector("input")!;
    console.log("labels prop", (input as HTMLInputElement).labels?.length);
    const label = container.querySelector("label")!;
    console.log("control", (label as HTMLLabelElement).control?.id);
    const el = screen.getByLabelText(/^اسم المشروع/);
    expect(el.id).toBe("y");
  });
});
