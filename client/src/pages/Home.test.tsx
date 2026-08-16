import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FloatingBrushToolbar, QuickClipartDialog } from "./Home";
import { presetPromptForSubject } from "@/lib/clipartPresets";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

import fs from "node:fs";
import path from "node:path";

function injectToolbarStylesheet() {
  // Vitest does not inject CSS imports into jsdom, so load the stylesheet
  // manually so computed-style assertions resolve the real rules.
  const css = fs.readFileSync(path.resolve(import.meta.dirname, "../styles/artStudio.css"), "utf8");
  if (css && !document.querySelector('style[data-injected="artStudio"]')) {
    const style = document.createElement("style");
    style.setAttribute("data-injected", "artStudio");
    style.textContent = css;
    document.head.appendChild(style);
  }
}

injectToolbarStylesheet();

afterEach(() => cleanup());

describe("QuickClipartDialog", () => {
  it("uses the selected subject preset as the custom clipart generation prompt", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    render(<QuickClipartDialog open onOpenChange={vi.fn()} loading={false} onGenerate={onGenerate} />);

    await user.click(screen.getByRole("button", { name: "Science" }));
    const prompt = screen.getByLabelText("Describe your clipart") as HTMLInputElement;
    expect(prompt.value).toBe(presetPromptForSubject("Science"));

    await user.click(screen.getByRole("button", { name: /generate & insert clipart/i }));
    expect(onGenerate).toHaveBeenCalledWith(presetPromptForSubject("Science"));
  });
});

describe("FloatingBrushToolbar", () => {
  it("shows the active brush values and updates size and opacity with its live sliders", async () => {
    const user = userEvent.setup();
    const onSizeChange = vi.fn();
    const onOpacityChange = vi.fn();
    render(<FloatingBrushToolbar size={12} opacity={0.5} onSizeChange={onSizeChange} onOpacityChange={onOpacityChange} />);

    expect(screen.getByRole("group", { name: "Live brush controls" })).toBeTruthy();
    expect(screen.getByLabelText("Current brush size").textContent).toContain("12 px");
    expect(screen.getByLabelText("Current brush opacity").textContent).toContain("50%");

    const sizeThumb = screen.getByLabelText("Brush size").querySelector<HTMLElement>("[role=slider]");
    const opacityThumb = screen.getByLabelText("Brush opacity").querySelector<HTMLElement>("[role=slider]");
    expect(sizeThumb).toBeTruthy();
    expect(opacityThumb).toBeTruthy();

    sizeThumb!.focus();
    await user.keyboard("{ArrowRight}");
    expect(onSizeChange).toHaveBeenCalledWith(13);

    opacityThumb!.focus();
    await user.keyboard("{ArrowRight}");
    expect(onOpacityChange).toHaveBeenCalledWith(0.51);
  });

  it("passes drawing pointer events through the panel body while keeping the sliders interactive", async () => {
    const user = userEvent.setup();
    const onSizeChange = vi.fn();
    const onOpacityChange = vi.fn();
    render(<FloatingBrushToolbar size={12} opacity={0.5} onSizeChange={onSizeChange} onOpacityChange={onOpacityChange} />);
    const panel = screen.getByRole("group", { name: "Live brush controls" });

    const slider = screen.getByLabelText("Brush size").querySelector<HTMLElement>("[role=slider]")!;
    const heading = panel.querySelector<HTMLElement>(".floating-brush-toolbar__heading")!;

    // The panel body is pass-through (pointer-events:none) so drawing gestures
    // reach the canvas beneath the floating toolbar, while the slider rows
    // stay interactive (pointer-events:auto). jsdom cannot model CSS
    // hit-testing, so we assert the pointer-events rules and control layout.
    expect(getComputedStyle(panel).pointerEvents).toBe("none");
    expect(getComputedStyle(slider).pointerEvents).toBe("auto");
    expect(heading).toBeTruthy();
    expect(slider).toBeTruthy();

    slider.focus();
    await user.keyboard("{ArrowRight}");
    expect(onSizeChange).toHaveBeenCalledWith(13);
  });

  it("routes panel-body pointer gestures to the worksheet SVG in JavaScript so drawing continues under the toolbar", async () => {
    const onSizeChange = vi.fn();
    const onOpacityChange = vi.fn();
    render(<FloatingBrushToolbar size={12} opacity={0.5} onSizeChange={onSizeChange} onOpacityChange={onOpacityChange} />);
    const panel = screen.getByRole("group", { name: "Live brush controls" });

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("data-worksheet-svg", "");
    document.body.appendChild(svg);
    try {
      const dispatched: string[] = [];
      svg.addEventListener("pointerdown", (event) => dispatched.push(`down:${event.clientX},${event.clientY},${event.pointerId}`));
      svg.addEventListener("pointermove", (event) => dispatched.push(`move:${event.clientX},${event.clientY}`));
      svg.addEventListener("pointerup", (event) => dispatched.push(`up:${event.pointerId}`));

      // Gesture that starts over the panel heading (panel body, not a control row)
      const nativeDown = new PointerEvent("pointerdown", { bubbles: true, pointerId: 7, clientX: 110, clientY: 80, isPrimary: true });
      const heading = panel.querySelector<HTMLElement>(".floating-brush-toolbar__heading")!;
      heading.dispatchEvent(nativeDown);
      // Subsequent move/end keep routing for the same pointer id
      const panelEl = panel.querySelector<HTMLElement>("[style]") ?? panel;
      const nativeMove = new PointerEvent("pointermove", { bubbles: true, pointerId: 7, clientX: 115, clientY: 85 });
      panelEl.dispatchEvent(nativeMove);
      const nativeUp = new PointerEvent("pointerup", { bubbles: true, pointerId: 7 });
      panelEl.dispatchEvent(nativeUp);

      expect(dispatched).toEqual(["down:110,80,7", "move:115,85", "up:7"]);

      // Sliders keep their own events — a pointerdown on a control row is not redirected
      const controlRow = panel.querySelector<HTMLElement>("[data-floating-brush-control]")!;
      controlRow.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 9, clientX: 99, clientY: 99 }));
      expect(dispatched.length).toBe(3);
    } finally {
      svg.remove();
    }
  });
});
