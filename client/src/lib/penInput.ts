export type StylusPointer = {
  pointerType?: string;
  pressure?: number;
  button?: number;
  buttons?: number;
  isPrimary?: boolean;
};

export type StylusInput = {
  isPen: boolean;
  isEraser: boolean;
  pressure: number;
  shouldIgnore: boolean;
};

/**
 * Normalizes browser Pointer Events from pen displays while retaining a useful
 * mouse/touch fallback. The eraser bit follows the Pointer Events convention.
 */
export function resolveStylusInput(event: StylusPointer, penAlreadyActive = false): StylusInput {
  const isPen = event.pointerType === "pen";
  const eraserButton = event.button === 5 || Boolean((event.buttons ?? 0) & 32);
  const rawPressure = Number.isFinite(event.pressure) ? Number(event.pressure) : 0;
  const pressure = isPen ? Math.max(0.08, Math.min(1, rawPressure || 0.5)) : 1;
  return {
    isPen,
    isEraser: isPen && eraserButton,
    pressure,
    shouldIgnore: event.isPrimary === false || (penAlreadyActive && !isPen),
  };
}

export function pressureAdjustedStroke(baseSize: number, pressure: number, isPen: boolean) {
  if (!isPen) return baseSize;
  const response = 0.28 + pressure * 0.72;
  return Math.round(Math.max(1.5, baseSize * response) * 10) / 10;
}

export function createStrokePoint(x: number, y: number, baseSize: number, pressure: number, isPen: boolean) {
  return { x, y, size: pressureAdjustedStroke(baseSize, pressure, isPen) };
}
