import { describe, expect, it } from "vitest";
import { createShapeLayer, createTextLayer, layerKindLabel } from "./drawingElements";

describe("drawing element factories", () => {
  it("creates editable filled and line-like shape layers", () => {
    expect(createShapeLayer("rectangle", "rectangle")).toMatchObject({ id: "rectangle", type: "shape", fill: "#dfeccf", fillOpacity: 0.78, strokeWidth: 5 });
    expect(createShapeLayer("arrow", "arrow")).toMatchObject({ id: "arrow", type: "shape", fill: "none", fillOpacity: 0, strokeWidth: 7, height: 0 });
  });

  it("creates an editable text label with a clear layer label", () => {
    const layer = createTextLayer("label");
    expect(layer).toMatchObject({ id: "label", type: "text", text: "Add your text", fontSize: 42 });
    expect(layerKindLabel(layer)).toBe("Text");
  });
});
