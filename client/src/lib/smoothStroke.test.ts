import { describe, expect, it } from "vitest";
import { smoothStrokeSegments, stabilizeStrokePoint } from "./smoothStroke";

describe("smoothStrokeSegments", () => {
  it("joins a freehand series through midpoint-fitted quadratic curves", () => {
    const segments = smoothStrokeSegments([
      { x: 0, y: 0, size: 4 },
      { x: 10, y: 20, size: 8 },
      { x: 30, y: 20, size: 12 },
      { x: 40, y: 0, size: 10 },
    ]);

    expect(segments).toEqual([
      { d: "M 0 0 Q 10 20 20 20", size: 8 },
      { d: "M 20 20 Q 30 20 35 10", size: 12 },
      { d: "M 35 10 Q 40 0 40 0", size: 10 },
    ]);
  });

  it("keeps the latest pressure width for a two-point stroke", () => {
    expect(smoothStrokeSegments([{ x: 1, y: 2, size: 4 }, { x: 8, y: 9, size: 15 }])).toEqual([
      { d: "M 1 2 Q 1 2 8 9", size: 15 },
    ]);
  });

  it("allows zero smoothing for direct point-to-point strokes", () => {
    expect(smoothStrokeSegments([{ x: 1, y: 2, size: 4 }, { x: 8, y: 9, size: 15 }], 0)).toEqual([
      { d: "M 1 2 L 8 9", size: 15 },
    ]);
  });

  it("reuses exact join coordinates between consecutive segments at partial smoothing", () => {
    expect(smoothStrokeSegments([
      { x: 0, y: 0, size: 4 },
      { x: 20, y: 0, size: 8 },
      { x: 20, y: 20, size: 12 },
      { x: 40, y: 20, size: 10 },
    ], 0.35)).toEqual([
      { d: "M 0 0 Q 20 0 20 3.5", size: 8 },
      { d: "M 20 3.5 Q 20 20 23.5 20", size: 12 },
      { d: "M 23.5 20 Q 40 20 40 20", size: 10 },
    ]);
  });

  it("damps incoming point positions without changing their pressure width", () => {
    expect(stabilizeStrokePoint({ x: 0, y: 0, size: 4 }, { x: 10, y: 20, size: 15 }, 0.5)).toEqual({ x: 6.4, y: 12.8, size: 15 });
  });
});
