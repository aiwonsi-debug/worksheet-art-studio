import { describe, expect, it } from "vitest";
import { pressureAdjustedStroke, resolveStylusInput } from "./penInput";

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
});
