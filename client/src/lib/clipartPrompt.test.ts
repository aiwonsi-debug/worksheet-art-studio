import { describe, expect, it } from "vitest";
import { prepareCustomClipartPrompt } from "./clipartPrompt";

describe("prepareCustomClipartPrompt", () => {
  it("normalizes a custom clipart request before generation", () => {
    expect(prepareCustomClipartPrompt("  friendly   red fox  ")).toBe("friendly red fox");
  });

  it("requires a meaningful clipart description", () => {
    expect(() => prepareCustomClipartPrompt("  ")).toThrow("at least three");
  });
});
