import { describe, expect, it } from "vitest";
import { createStrokePoint, pressureAdjustedStroke, resolveStylusInput } from "./penInput";

describe("stylus input normalization", () => {
  it("uses pen pressure while retaining a stable default for drivers that report zero on pointer down", () => {
    expect(resolveStylusInput({ pointerType: "pen", pressure: 0 })).toMatchObject({ isPen: true, pressure: 0.5, shouldIgnore: false });
    expect(pressureAdjustedStroke(20, 0.5, true)).toBe(12.8);
  });

  it("recognizes the standard pen eraser button and blocks palm/touch input during an active pen stroke", () => {
    expect(resolveStylusInput({ pointerType: "pen", buttons: 32, pressure: 0.8 }).isEraser).toBe(true);
    expect(resolveStylusInput({ pointerType: "touch", isPrimary: true }, true).shouldIgnore).toBe(true);
  });

  it("keeps mouse fallback strokes at the selected brush size", () => {
    expect(resolveStylusInput({ pointerType: "mouse" }).pressure).toBe(1);
    expect(pressureAdjustedStroke(14, 0.2, false)).toBe(14);
  });

  it("preserves distinct pressure-derived widths for sampled stylus points", () => {
    const light = createStrokePoint(10, 10, 20, 0.2, true);
    const firm = createStrokePoint(20, 20, 20, 0.9, true);
    expect(firm.size).toBeGreaterThan(light.size);
  });

  it("lets the user choose a gentler or more expressive pressure response", () => {
    const gentle = pressureAdjustedStroke(20, 0.2, true, 0.45);
    const expressive = pressureAdjustedStroke(20, 0.2, true, 1.45);
    expect(gentle).toBeGreaterThan(expressive);
    expect(pressureAdjustedStroke(20, 0.2, false, 1.45)).toBe(20);
  });
});
