import { describe, expect, it } from "vitest";
import { nextViewportFromTouchGesture, shouldNavigateTouch } from "./canvasViewport";

describe("nextViewportFromTouchGesture", () => {
  it("keeps a single finger available to the active drawing tool and uses two fingers for navigation", () => {
    expect(shouldNavigateTouch(1)).toBe(false);
    expect(shouldNavigateTouch(2)).toBe(true);
  });

  it("pans a one-finger navigation gesture without changing zoom", () => {
    expect(nextViewportFromTouchGesture({ scale: 1, offsetX: 0, offsetY: 0 }, [{ id: 1, x: 30, y: 40 }], [{ id: 1, x: 75, y: 62 }])).toEqual({ scale: 1, offsetX: 45, offsetY: 22 });
  });

  it("zooms around a two-finger gesture and respects the configured zoom ceiling", () => {
    const zoomed = nextViewportFromTouchGesture({ scale: 1, offsetX: 0, offsetY: 0 }, [{ id: 1, x: 20, y: 50 }, { id: 2, x: 80, y: 50 }], [{ id: 1, x: 0, y: 50 }, { id: 2, x: 120, y: 50 }]);
    expect(zoomed.scale).toBe(2);
    expect(nextViewportFromTouchGesture({ scale: 2.4, offsetX: 0, offsetY: 0 }, [{ id: 1, x: 0, y: 0 }, { id: 2, x: 10, y: 0 }], [{ id: 1, x: 0, y: 0 }, { id: 2, x: 80, y: 0 }]).scale).toBe(2.5);
  });

  it("never zooms below identity scale so the sheet always fills the visible frame", () => {
    const zoomedOut = nextViewportFromTouchGesture({ scale: 1, offsetX: 0, offsetY: 0 }, [{ id: 1, x: 0, y: 50 }, { id: 2, x: 100, y: 50 }], [{ id: 1, x: 40, y: 50 }, { id: 2, x: 60, y: 50 }]);
    expect(zoomedOut.scale).toBe(1);
    expect(nextViewportFromTouchGesture({ scale: 1.6, offsetX: 10, offsetY: 8 }, [{ id: 1, x: 0, y: 50 }, { id: 2, x: 100, y: 50 }], [{ id: 1, x: 40, y: 50 }, { id: 2, x: 60, y: 50 }]).scale).toBe(1);
  });
});
