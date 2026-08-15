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

  it("keeps pressure-sampled path widths in SVG exports", () => {
    const svg = renderWorksheetSvg({ transparentBackground: true, layers: [{ id: "p", type: "path", name: "stroke", d: "M 0 0", color: "#4263eb", strokeWidth: 12, mode: "draw", x: 0, y: 0, width: 0, height: 0, rotation: 0, opacity: 1, points: [{ x: 1, y: 2, size: 4 }, { x: 8, y: 9, size: 15 }] }] });
    expect(svg).toContain('stroke-width="15"');
    expect(svg).toContain('Q 1 2 8 9');
  });

  it("renders editable shapes and text in worksheet SVG exports", () => {
    const svg = renderWorksheetSvg({ transparentBackground: true, layers: [
      { id: "shape", type: "shape", name: "Rectangle", shape: "rectangle", x: 40, y: 50, width: 140, height: 90, rotation: 0, opacity: 1, fill: "#ffeeaa", fillOpacity: 0.5, stroke: "#222", strokeWidth: 4 },
      { id: "text", type: "text", name: "Title", text: "Hello & learn", x: 40, y: 170, width: 240, height: 48, rotation: 0, opacity: 1, color: "#222", fontSize: 32, fontWeight: "bold" },
    ] });
    expect(svg).toContain('<rect x="40" y="50" width="140" height="90"');
    expect(svg).toContain('fill-opacity="0.5"');
    expect(svg).toContain('Hello &amp; learn');
  });
});
