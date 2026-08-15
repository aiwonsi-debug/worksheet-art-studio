import { describe, expect, it } from "vitest";
import { renderWorksheetSvg } from "./exportWorksheet";
import { WORKSHEET_HEIGHT, WORKSHEET_WIDTH, type WorksheetCanvasState } from "./studioTypes";

describe("worksheet SVG export", () => {
  it("preserves a transparent canvas and renders editable image layers", () => {
    const state: WorksheetCanvasState = {
      transparentBackground: true,
      layers: [{ id: "asset-1", type: "image", name: "Fox", src: "data:image/png;base64,Zm94", x: 30, y: 45, width: 210, height: 190, rotation: 0, opacity: 1 }],
    };
    const svg = renderWorksheetSvg(state);

    expect(svg).toContain(`viewBox="0 0 ${WORKSHEET_WIDTH} ${WORKSHEET_HEIGHT}"`);
    expect(svg).not.toContain("<rect width=\"920\" height=\"1160\" fill=\"#ffffff\"/>");
    expect(svg).toContain("data:image/png;base64,Zm94");
  });

  it("adds an opaque white paper background when transparency is turned off", () => {
    const svg = renderWorksheetSvg({ transparentBackground: false, layers: [] });
    expect(svg).toContain("fill=\"#ffffff\"");
  });
});
