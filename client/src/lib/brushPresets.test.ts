import { describe, expect, it } from "vitest";
import { brushPresets, isActiveBrushPreset } from "./brushPresets";

describe("brush presets", () => {
  it("offers pencil, marker, and translucent highlighter settings", () => {
    expect(brushPresets.map((preset) => preset.id)).toEqual(["pencil", "marker", "highlighter"]);
    expect(brushPresets.find((preset) => preset.id === "highlighter")?.opacity).toBeLessThan(1);
  });

  it("identifies a currently applied preset from its drawing settings", () => {
    const marker = brushPresets[1];
    expect(isActiveBrushPreset(marker, marker)).toBe(true);
    expect(isActiveBrushPreset(marker, { ...marker, size: 10 })).toBe(false);
  });
});
