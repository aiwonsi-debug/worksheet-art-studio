import { describe, expect, it } from "vitest";
import { patchCanvasLayer, removeCanvasLayer, duplicateCanvasLayer, reorderCanvasLayer } from "./selectedElementActions";
import type { WorksheetCanvasState } from "./studioTypes";

const canvas: WorksheetCanvasState = {
  transparentBackground: false,
  layers: [
    { id: "shape-1", type: "shape", name: "Rectangle", shape: "rectangle", x: 10, y: 20, width: 100, height: 80, rotation: 0, opacity: 1, fill: "#ffffff", fillOpacity: 1, stroke: "#334455", strokeWidth: 2 },
    { id: "text-1", type: "text", name: "Heading", text: "Heading", x: 40, y: 50, width: 160, height: 36, rotation: 0, opacity: 1, color: "#223344", fontSize: 24, fontWeight: "normal" },
  ],
};

describe("selected element actions", () => {
  it("applies fill, stroke, and opacity edits to only the selected layer", () => {
    const updated = patchCanvasLayer(canvas, "shape-1", { fill: "#f9d764", stroke: "#126b5f", opacity: 0.65, fillOpacity: 0.4 });
    const shape = updated.layers[0];
    expect(shape).toMatchObject({ fill: "#f9d764", stroke: "#126b5f", opacity: 0.65, fillOpacity: 0.4 });
    expect(updated.layers[1]).toEqual(canvas.layers[1]);
  });

  it("duplicates, removes, and reorders selected elements without mutating the source canvas", () => {
    const duplicated = duplicateCanvasLayer(canvas, "shape-1", "shape-copy");
    expect(duplicated?.selectedId).toBe("shape-copy");
    expect(duplicated?.canvas.layers.at(-1)).toMatchObject({ id: "shape-copy", x: 36, y: 46, name: "Rectangle copy" });

    const reordered = reorderCanvasLayer(canvas, "shape-1", "forward");
    expect(reordered.layers.map((layer) => layer.id)).toEqual(["text-1", "shape-1"]);
    expect(removeCanvasLayer(reordered, "text-1").layers.map((layer) => layer.id)).toEqual(["shape-1"]);
    expect(canvas.layers.map((layer) => layer.id)).toEqual(["shape-1", "text-1"]);
  });
});
