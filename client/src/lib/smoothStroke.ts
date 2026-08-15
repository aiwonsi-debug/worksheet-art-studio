import type { StrokePoint } from "./studioTypes";

export type SmoothStrokeSegment = {
  d: string;
  size: number;
};

const midpoint = (first: StrokePoint, second: StrokePoint) => ({
  x: (first.x + second.x) / 2,
  y: (first.y + second.y) / 2,
});

/**
 * Fits joined quadratic curves through raw pointer samples. Adjacent segments
 * meet at shared midpoints, which removes the sharp corner created by drawing
 * each sample pair as a standalone straight line. Point sizes stay attached to
 * the sampled pressure so the pen remains variable-width.
 */
export function smoothStrokeSegments(points: StrokePoint[]): SmoothStrokeSegment[] {
  if (points.length < 2) return [];
  if (points.length === 2) {
    const [first, last] = points;
    return [{ d: `M ${first.x} ${first.y} Q ${first.x} ${first.y} ${last.x} ${last.y}`, size: last.size }];
  }

  return points.slice(1).map((point, index) => {
    const pointIndex = index + 1;
    const previous = points[pointIndex - 1];
    const next = points[pointIndex + 1];
    const start = pointIndex === 1 ? previous : midpoint(previous, point);
    const end = next ? midpoint(point, next) : point;
    return {
      d: `M ${start.x} ${start.y} Q ${point.x} ${point.y} ${end.x} ${end.y}`,
      size: point.size,
    };
  });
}
