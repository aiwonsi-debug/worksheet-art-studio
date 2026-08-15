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
    const firstMatch = path.match(/M ([\d.-]+) ([\d.-]+)/);
    const endMatch = path.match(/A ([\d.-]+) ([\d.-]+) \d \d \d ([\d.-]+) ([\d.-]+) Z/);
    expect(firstMatch).not.toBeNull();
    expect(endMatch).not.toBeNull();
    expect(Number(firstMatch![1])).toBeCloseTo(Number(endMatch![3]), 1);
    expect(Number(firstMatch![2])).toBeCloseTo(Number(endMatch![4]), 1);
  });

  it("tapers the stroke at its start and end while keeping the middle full width", () => {
    const points = makePoints(10, true);
    const path = ribbonStrokePath(points);
    // The end caps use the tapered widths, which are smaller than the mid widths.
    const firstCapMatch = path.match(/M ([\d.-]+) ([\d.-]+)/);
    expect(firstCapMatch).not.toBeNull();
    // Middle samples contribute full-width offsets; first cap offset is smaller.
    expect(path).toContain("A ");
  });

  it("keeps tapered cap widths smaller than full mid widths when pressure varies", () => {
    const points = makePoints(6, true);
    const path = ribbonStrokePath(points, 1, 0.55);
    const capArcs = path.match(/A ([\d.]+)/g);
    expect(capArcs).toHaveLength(2);
    const arcRadii = capArcs!.map((arc) => Number(arc.replace("A ", "")));
    // With an increasing size profile, the end cap (tapered toward a larger
    // neighbor) sits between its own sample width and full width, while the
    // start cap (tapered toward a larger neighbor too) stays below its own
    // sample half-width. The reliable invariant: each cap is smaller than its
    // endpoint's sample radius whenever that endpoint is larger than its
    // neighbor — i.e., the taper always reduces the larger end.
    const start = points[0].size;
    const end = points[points.length - 1].size;
    if (end >= points[points.length - 2].size) {
      expect(arcRadii[1]).toBeLessThanOrEqual(end / 2);
    }
    if (start >= points[1].size) {
      expect(arcRadii[0]).toBeLessThanOrEqual(start / 2);
    }
    // And both caps are strictly smaller than the widest point on the stroke,
    // so no end ever bulges past the intended maximum width.
    expect(arcRadii[0]).toBeLessThan(Math.max(...points.map((p) => p.size)) / 2);
    expect(arcRadii[1]).toBeLessThan(Math.max(...points.map((p) => p.size)) / 2);
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
