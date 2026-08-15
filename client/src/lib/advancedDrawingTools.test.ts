import { describe, expect, it } from "vitest";
import { createShapeLayer } from "./drawingElements";
import { fillSelectedShape, sampleLayerColor } from "./advancedDrawingTools";
import type { WorksheetCanvasState } from "./studioTypes";

describe("advanced drawing tools", () => {
  it("creates reusable advanced closed shape primitives", () => {
    expect(createShapeLayer("triangle", "triangle").name).toBe("Triangle");
    expect(createShapeLayer("diamond", "diamond").fill).toBe("#dfeccf");
    expect(createShapeLayer("star", "star").shape).toBe("star");
  });

  it("fills only closed shapes without mutating the source canvas", () => {
    const triangle = createShapeLayer("triangle", "triangle");
    const line = createShapeLayer("line", "line");
    const state: WorksheetCanvasState = { transparentBackground: true, layers: [triangle, line] };
    const filled = fillSelectedShape(state, "triangle", "#ffcc4d");
    expect((filled.layers[0] as typeof triangle).fill).toBe("#ffcc4d");
    expect((filled.layers[0] as typeof triangle).fillOpacity).toBeGreaterThanOrEqual(0.78);
    expect(state.layers[0]).toBe(triangle);
    expect(fillSelectedShape(state, "line", "#ffcc4d")).toBe(state);
  });

  it("samples the visible color from editable drawing elements", () => {
    const star = { ...createShapeLayer("star", "star"), fill: "#805ad5", fillOpacity: 0.8 };
    expect(sampleLayerColor(star)).toBe("#805ad5");
    expect(sampleLayerColor({ ...star, fill: "none", fillOpacity: 0 })).toBe(star.stroke);
    expect(sampleLayerColor({ id: "text", type: "text", name: "Label", text: "Hi", x: 0, y: 0, width: 30, height: 20, rotation: 0, opacity: 1, color: "#123456", fontSize: 16, fontWeight: "normal" })).toBe("#123456");
  });
});
