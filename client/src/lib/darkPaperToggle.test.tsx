// Regression tests for the dock paper toggle button (JSX requires the .tsx transform).
import { afterEach, describe, expect, it } from "vitest";
import React from "react";
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

afterEach(() => cleanup());

function DockPaperToggleHarness({ initial = false }: { initial?: boolean }) {
  const [darkPaper, setDarkPaper] = useState(initial);
  return (
    <button
      className={`art-dock-paper-toggle ${darkPaper ? "is-on" : ""}`}
      onClick={() => setDarkPaper(!darkPaper)}
      aria-label={darkPaper ? "Switch to light paper" : "Switch to dark paper"}
      title={darkPaper ? "Dark paper" : "Light paper"}
      data-testid="dock-paper-toggle"
    >
      <span>{darkPaper ? "Dark paper" : "Light paper"}</span>
    </button>
  );
}

describe("dock paper toggle button", () => {
  it("renders a light paper button by default and toggles to dark paper on click", async () => {
    const user = userEvent.setup();
    render(<DockPaperToggleHarness />);
    const button = screen.getByTestId("dock-paper-toggle");
    expect(button.getAttribute("aria-label")).toBe("Switch to dark paper");
    expect(button.classList.contains("is-on")).toBe(false);
    await user.click(button);
    expect(button.getAttribute("aria-label")).toBe("Switch to light paper");
    expect(button.textContent).toBe("Dark paper");
    expect(button.classList.contains("is-on")).toBe(true);
    await user.click(button);
    expect(button.getAttribute("aria-label")).toBe("Switch to dark paper");
    expect(button.classList.contains("is-on")).toBe(false);
  });

  it("starts dark paper on when initialized that way", () => {
    render(<DockPaperToggleHarness initial />);
    const button = screen.getByTestId("dock-paper-toggle");
    expect(button.getAttribute("aria-label")).toBe("Switch to light paper");
    expect(button.classList.contains("is-on")).toBe(true);
  });
});
