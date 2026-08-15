import { describe, expect, it } from "vitest";
import { insertAssetOnCanvas } from "./assetInsertion";
import { createEmptyCanvas } from "./studioTypes";

describe("direct custom clipart insertion", () => {
  it("adds generated clipart to the active canvas and selects the new layer", () => {
    const result = insertAssetOnCanvas(createEmptyCanvas(), { id: 7, name: "Cheerful owl", url: "https://example.test/owl.png", kind: "clipart" }, "generated-owl");
    expect(result.selectedId).toBe("generated-owl");
    expect(result.canvas.layers).toHaveLength(1);
    expect(result.layer).toMatchObject({ id: "generated-owl", name: "Cheerful owl", width: 250, height: 250, x: 335, y: 455 });
  });
});
