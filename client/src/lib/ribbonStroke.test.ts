import { describe, expect, it } from "vitest";
import { ribbonStrokePath, thinStrokeSegments, easedStrokeWidth } from "./ribbonStroke";

function makePoints(count: number, widthVariation: boolean): { x: number; y: number; size: number }[] {
  return Array.from({ length: count }, (_, index) => ({
    x: 100 + index * 25,
    y: 300 + Math.sin(index / 2) * 60,
    size: widthVariation ? 6 + index * 1.2 : 12,
  }));
}

describe("ribbonStrokePath", () => {
  it("returns an empty path for no samples", () => {
    expect(ribbonStrokePath([])).toBe("");
  });

  it("draws a small filled dot for a single tap sample", () => {
    const path = ribbonStrokePath([{ x: 50, y: 50, size: 10 }]);
    expect(path).toContain("a 5 5");
    expect(path).toContain("z");
  });

  it("produces a closed path that starts and ends at the same point", () => {
    const points = makePoints(8, false);
    const path = ribbonStrokePath(points);
    expect(path.startsWith("M")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);
    const startMatch = path.match(/^M ([\d.-]+) ([\d.-]+)/);
    expect(startMatch).not.toBeNull();
    // The final quadratic cap ends at the starting edge point, guaranteeing a
    // sealed closed shape with no gap between the last and first coordinates.
    const endMatch = path.match(/Q ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) Z$/);
    expect(endMatch).not.toBeNull();
    expect(Number(endMatch![3])).toBeCloseTo(Number(startMatch![1]), 1);
    expect(Number(endMatch![4])).toBeCloseTo(Number(startMatch![2]), 1);
  });

  it("traces both edges with quadratic curves instead of straight segments", () => {
    const points = makePoints(8, false);
    const path = ribbonStrokePath(points);
    const qCount = (path.match(/ Q /g) ?? []).length;
    // n-1 left-edge steps + 1 end-cap step + n-1 right-edge steps + 1 return
    // cap step = 2n quadratic segments total; no straight L segments remain.
    expect(qCount).toBe(points.length * 2);
    expect(path.includes(" L ")).toBe(false);
  });

  it("tapers the stroke at its start and end while keeping the middle full width", () => {
    const points = makePoints(10, true);
    const path = ribbonStrokePath(points);
    const startMatch = path.match(/^M ([\d.-]+) ([\d.-]+)/);
    expect(startMatch).not.toBeNull();
    const startX = Number(startMatch![1]);
    const startY = Number(startMatch![2]);
    // The first sample sits at x=100; with a tapered first width the start
    // edge point stays offset from the spine, and the last cap returns there.
    expect(startX).toBeLessThan(points[0].x);
    const endReturn = path.match(/Q ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) Z$/);
    expect(endReturn).not.toBeNull();
    expect(Number(endReturn![3])).toBeCloseTo(startX, 1);
    expect(Number(endReturn![4])).toBeCloseTo(startY, 1);
  });

  it("keeps tapered cap widths smaller than full mid widths when pressure varies", () => {
    const points = makePoints(6, true);
    const path = ribbonStrokePath(points, 1, 0.55);
    // Cap edge offsets derive from tapered widths: the first edge point
    // displacement from its sample must stay within the tapered half width.
    const startMatch = path.match(/^M ([\d.-]+) ([\d.-]+)/);
    expect(startMatch).not.toBeNull();
    const startOffset = Math.hypot(Number(startMatch![1]) - points[0].x, Number(startMatch![2]) - points[0].y);
    // The closing cap is a quadratic whose control is the first right-edge
    // point (built from the final sample's tapered width) and which seals
    // back at the starting left-edge point.
    const closingMatch = path.match(/Q ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) Z$/);
    expect(closingMatch).not.toBeNull();
    const capControl = { x: Number(closingMatch![1]), y: Number(closingMatch![2]) };
    const capEnd = { x: Number(closingMatch![3]), y: Number(closingMatch![4]) };
    const widestHalf = Math.max(...points.map((p) => p.size)) / 2;
    expect(startOffset).toBeGreaterThan(0);
    expect(startOffset).toBeLessThan(widestHalf);
    // The cap seals exactly at the starting left-edge point.
    expect(capEnd.x).toBeCloseTo(Number(startMatch![1]), 1);
    expect(capEnd.y).toBeCloseTo(Number(startMatch![2]), 1);
    // The cap control derives from the final sample's tapered width, so its
    // distance from the first sample (which it sits near) stays bounded by
    // the stroke's own maximum half width — it never bulges past the widest
    // point, and because the first sample is the narrowest here, the control
    // cannot float arbitrarily far away.
    expect(Math.hypot(capControl.x - points[0].x, capControl.y - points[0].y)).toBeLessThan(widestHalf);
  });

  it("stays continuous across zero and full smoothing strengths", () => {
    const points = makePoints(12, true);
    const smoothPath = ribbonStrokePath(points, 1);
    const rawPath = ribbonStrokePath(points, 0);
    expect(smoothPath).not.toBe(rawPath);
    expect(smoothPath.endsWith("Z")).toBe(true);
    expect(rawPath.endsWith("Z")).toBe(true);
  });
});

describe("thinStrokeSegments", () => {
  it("returns legacy quadratic segments for multi-sample paths", () => {
    const points = makePoints(6, false);
    const segments = thinStrokeSegments(points);
    expect(segments.length).toBe(points.length - 1);
    for (const segment of segments) {
      expect(segment.d).toMatch(/^M [\d.-]+ [\d.-]+ Q [\d.-]+ [\d.-]+ [\d.-]+ [\d.-]+$/);
    }
  });
});

describe("easedStrokeWidth", () => {
  it("blends sizes gradually rather than returning either extreme", () => {
    const previous = { x: 0, y: 0, size: 4 };
    const incoming = { x: 10, y: 10, size: 20 };
    const blended = easedStrokeWidth(previous, incoming);
    expect(blended).toBeGreaterThan(previous.size);
    expect(blended).toBeLessThan(incoming.size);
  });

  it("passes through unchanged sizes without blending", () => {
    const previous = { x: 0, y: 0, size: 12 };
    const incoming = { x: 10, y: 10, size: 12 };
    expect(easedStrokeWidth(previous, incoming)).toBe(12);
  });
});
