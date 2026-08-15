import type { StrokePoint } from "./studioTypes";

export type SmoothStrokeSegment = {
  d: string;
  size: number;
};

type StrokePosition = Pick<StrokePoint, "x" | "y">;

const midpoint = (first: StrokePosition, second: StrokePosition) => ({
  x: (first.x + second.x) / 2,
  y: (first.y + second.y) / 2,
});

const clamp = (value: number) => Math.max(0, Math.min(1, value));

const interpolate = (first: StrokePosition, second: StrokePosition, amount: number) => ({
  x: first.x + (second.x - first.x) * amount,
  y: first.y + (second.y - first.y) * amount,
});

/**
 * Moves an incoming point toward the prior sample. Higher values apply more
 * damping, reducing tiny hand or device movements while retaining the raw
 * pressure-derived width on the incoming point.
 */
export function stabilizeStrokePoint(previous: StrokePoint, incoming: StrokePoint, strength: number): StrokePoint {
  const followAmount = 1 - clamp(strength) * 0.72;
  return {
    ...incoming,
    x: previous.x + (incoming.x - previous.x) * followAmount,
    y: previous.y + (incoming.y - previous.y) * followAmount,
  };
}

/**
 * Fits joined quadratic curves through raw pointer samples. Adjacent segments
 * meet at shared midpoints, which removes the sharp corner created by drawing
 * each sample pair as a standalone straight line. Point sizes stay attached to
 * the sampled pressure so the pen remains variable-width.
 */
export function smoothStrokeSegments(points: StrokePoint[], smoothing = 1): SmoothStrokeSegment[] {
  if (points.length < 2) return [];
  const amount = clamp(smoothing);
  if (amount === 0) return points.slice(1).map((point, index) => {
    const previous = points[index];
    return { d: `M ${previous.x} ${previous.y} L ${point.x} ${point.y}`, size: point.size };
  });
  if (points.length === 2) {
    const [first, last] = points;
    return [{ d: `M ${first.x} ${first.y} Q ${first.x} ${first.y} ${last.x} ${last.y}`, size: last.size }];
  }

  return points.slice(1).map((point, index) => {
    const pointIndex = index + 1;
    const previous = points[pointIndex - 1];
    const next = points[pointIndex + 1];
    const start = pointIndex === 1 ? previous : interpolate(point, midpoint(previous, point), amount);
    const end = next ? interpolate(point, midpoint(point, next), amount) : point;
    return {
      d: `M ${start.x} ${start.y} Q ${point.x} ${point.y} ${end.x} ${end.y}`,
      size: point.size,
    };
  });
}
