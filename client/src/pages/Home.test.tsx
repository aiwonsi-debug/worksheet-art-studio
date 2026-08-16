import { cleanup, render, screen } from "@testing-library/react";
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
});
