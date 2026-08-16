export type CanvasViewport = { scale: number; offsetX: number; offsetY: number };
export type ViewportTouchPoint = { id: number; x: number; y: number };

export function shouldNavigateTouch(touchCount: number) {
  return touchCount >= 2;
}

function center(points: ViewportTouchPoint[]) {
  const active = points.slice(0, 2);
  return active.reduce((result, point) => ({ x: result.x + point.x / active.length, y: result.y + point.y / active.length }), { x: 0, y: 0 });
}

function distance(points: ViewportTouchPoint[]) {
  if (points.length < 2) return 1;
  return Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
}

export function nextViewportFromTouchGesture(startViewport: CanvasViewport, startPoints: ViewportTouchPoint[], currentPoints: ViewportTouchPoint[]): CanvasViewport {
  if (!startPoints.length || !currentPoints.length) return startViewport;
  const from = center(startPoints);
  const to = center(currentPoints);
  const hasPinch = startPoints.length > 1 && currentPoints.length > 1;
  const scale = hasPinch ? Math.max(1, Math.min(2.5, startViewport.scale * (distance(currentPoints) / distance(startPoints)))) : startViewport.scale;
  return { scale, offsetX: startViewport.offsetX + to.x - from.x, offsetY: startViewport.offsetY + to.y - from.y };
}
