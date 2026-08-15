import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuickClipartDialog } from "./Home";
import { presetPromptForSubject } from "@/lib/clipartPresets";

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
