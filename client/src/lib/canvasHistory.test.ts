import { describe, expect, it } from "vitest";
import { historyControlAvailability } from "./canvasHistory";

describe("canvas history controls", () => {
  it("only enables undo or redo when the corresponding canvas stack has an entry", () => {
    expect(historyControlAvailability(0, 0)).toEqual({ canUndo: false, canRedo: false });
    expect(historyControlAvailability(1, 0)).toEqual({ canUndo: true, canRedo: false });
    expect(historyControlAvailability(0, 2)).toEqual({ canUndo: false, canRedo: true });
  });
});
