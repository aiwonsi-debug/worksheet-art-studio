// Regression tests for the dark paper (dark canvas) feature.
import { describe, expect, it } from "vitest";
import { createEmptyCanvas, type WorksheetCanvasState } from "@/lib/studioTypes";
import { renderWorksheetSvg } from "@/lib/exportWorksheet";

describe("darkPaper canvas state", () => {
  it("starts with a light canvas", () => {
    const canvas = createEmptyCanvas();
    expect(canvas.darkPaper).toBe(false);
    expect(canvas.transparentBackground).toBe(false);
  });

  it("can be toggled without losing layers", () => {
    const base: WorksheetCanvasState = { transparentBackground: false, darkPaper: false, layers: [] };
    const dark: WorksheetCanvasState = { ...base, darkPaper: true };
    expect(dark.darkPaper).toBe(true);
    expect(dark.transparentBackground).toBe(false);
  });

  it("keeps darkPaper and transparency as distinct modes", () => {
    const canvas: WorksheetCanvasState = { transparentBackground: true, darkPaper: true, layers: [] };
    expect(canvas.transparentBackground).toBe(true);
    expect(canvas.darkPaper).toBe(true);
  });
});

describe("dark paper in SVG export", () => {
  it("renders a dark paper rectangle when darkPaper is on", () => {
    const svg = renderWorksheetSvg({ transparentBackground: false, darkPaper: true, layers: [] });
    expect(svg).toContain('fill="#1e2422"');
  });

  it("renders a white rectangle when darkPaper is off", () => {
    const svg = renderWorksheetSvg({ transparentBackground: false, darkPaper: false, layers: [] });
    expect(svg).toContain('fill="#ffffff"');
  });

  it("omits the background rectangle when transparency is on, regardless of darkPaper", () => {
    const svg = renderWorksheetSvg({ transparentBackground: true, darkPaper: true, layers: [] });
    // No fill rect at all when exporting transparent
    expect(svg).not.toContain('fill="#1e2422"');
    expect(svg).not.toContain('fill="#ffffff"');
  });
});
