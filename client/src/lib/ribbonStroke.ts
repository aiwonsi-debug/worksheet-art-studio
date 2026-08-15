import type { StrokePoint } from "./studioTypes";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

const interpolate = (first: { x: number; y: number }, second: { x: number; y: number }, amount: number) => ({
  x: first.x + (second.x - first.x) * amount,
  y: first.y + (second.y - first.y) * amount,
});

const midpoint = (first: { x: number; y: number }, second: { x: number; y: number }) => ({
  x: (first.x + second.x) / 2,
  y: (first.y + second.y) / 2,
});

const smoothingJoin = (first: { x: number; y: number }, second: { x: number; y: number }, amount: number) =>
  interpolate(first, midpoint(first, second), amount);

/**
 * Eases stroke widths between pressure samples so the line thickens and
 * thins gradually, like ink building up instead of jumping between sizes.
 */
export function easedStrokeWidth(previous: StrokePoint, incoming: StrokePoint): number {
  if (previous.size === incoming.size) return incoming.size;
  const smaller = Math.min(previous.size, incoming.size);
  const larger = Math.max(previous.size, incoming.size);
  return Math.max(smaller, smaller + (larger - smaller) * 0.62);
}

/**
 * Converts pressure samples into one continuous closed ribbon path, like a
 * real brush mark. Each outline edge is traced with quadratic curve segments
 * anchored between edge points (same shared-join math as smoothStrokeSegments
 * but applied perpendicular to the spine), so even fast, widely spaced pen
 * samples render as true curves rather than polygonal corners. The path
 * closes with rounded tapered caps at each end and fills as a single solid
 * shape. Paths stay continuous at any smoothing strength.
 */
export function ribbonStrokePath(points: StrokePoint[], smoothing = 1, taper = 0.55): string {
  if (!points.length) return "";
  if (points.length === 1) {
    const { x, y, size } = points[0];
    return `M ${x - size / 2} ${y} a ${size / 2} ${size / 2} 0 1 0 ${size} 0 a ${size / 2} ${size / 2} 0 1 0 -${size} 0 z`;
  }

  const amount = clamp(smoothing);
  const sampleCount = points.length;

  const widths = points.map((point, index) => {
    if (index === 0 || index === sampleCount - 1) {
      const other = index === 0 ? points[1] : points[index - 1];
      const ratio = Math.min(point.size, other.size) / (Math.max(point.size, other.size) || 1);
      return point.size * Math.min(1, ratio + taper * (1 - ratio));
    }
    return point.size;
  });

  // Tangent at each sample runs from its previous shared join to its next
  // shared join, mirroring the continuous-stroke geometry.
  const tangents = points.map((point, index) => {
    const previousJoin = index > 0 ? smoothingJoin(points[index - 1], point, amount) : point;
    const nextJoin = index < sampleCount - 1 ? smoothingJoin(point, points[index + 1], amount) : point;
    const tx = nextJoin.x - previousJoin.x;
    const ty = nextJoin.y - previousJoin.y;
    const length = Math.hypot(tx, ty) || 1;
    return { x: tx / length, y: ty / length };
  });

  const leftEdge = points.map((point, index) => ({
    x: point.x - tangents[index].y * widths[index] / 2,
    y: point.y + tangents[index].x * widths[index] / 2,
  }));
  const rightEdge = points.map((point, index) => ({
    x: point.x + tangents[index].y * widths[index] / 2,
    y: point.y - tangents[index].x * widths[index] / 2,
  }));

  // Quadratic curve chains along both edges: each segment uses the current
  // edge point as control and the midpoint to the next edge point as the
  // anchor, matching the smoothStrokeSegments join formula so corners melt
  // into curves instead of angular breaks.
  const path: string[] = [];
  path.push(`M ${leftEdge[0].x} ${leftEdge[0].y}`);
  for (let index = 1; index < sampleCount; index += 1) {
    path.push(`Q ${leftEdge[index - 1].x} ${leftEdge[index - 1].y} ${(leftEdge[index - 1].x + leftEdge[index].x) / 2} ${(leftEdge[index - 1].y + leftEdge[index].y) / 2}`);
  }
  path.push(`Q ${leftEdge[sampleCount - 1].x} ${leftEdge[sampleCount - 1].y} ${rightEdge[sampleCount - 1].x} ${rightEdge[sampleCount - 1].y}`);
  for (let index = sampleCount - 2; index >= 0; index -= 1) {
    path.push(`Q ${rightEdge[index + 1].x} ${rightEdge[index + 1].y} ${(rightEdge[index + 1].x + rightEdge[index].x) / 2} ${(rightEdge[index + 1].y + rightEdge[index].y) / 2}`);
  }
  path.push(`Q ${rightEdge[0].x} ${rightEdge[0].y} ${leftEdge[0].x} ${leftEdge[0].y} Z`);
  return path.join(" ");
}

/**
 * Legacy-style segment fallback used for eraser strokes and thin lines, kept
 * for parity with exports and the history system.
 */
export function thinStrokeSegments(points: StrokePoint[], smoothing = 1): { d: string; size: number }[] {
  if (points.length < 2) return [];
  const amount = clamp(smoothing);
  if (points.length === 2) {
    const [first, last] = points;
    return [{ d: `M ${first.x} ${first.y} Q ${first.x} ${first.y} ${last.x} ${last.y}`, size: last.size }];
  }
  return points.slice(1).map((point, index) => {
    const pointIndex = index + 1;
    const previous = points[pointIndex - 1];
    const next = points[pointIndex + 1];
    const start = pointIndex === 1 ? previous : smoothingJoin(previous, point, amount);
    const end = next ? smoothingJoin(point, next, amount) : point;
    return { d: `M ${start.x} ${start.y} Q ${point.x} ${point.y} ${end.x} ${end.y}`, size: easedStrokeWidth(previous, point) };
  });
}
