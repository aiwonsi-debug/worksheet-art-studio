import { WORKSHEET_HEIGHT, WORKSHEET_WIDTH } from './studioTypes';
import { CanvasViewport } from './canvasViewport';

export type PointerRect = { left: number; top: number; width: number; height: number };

/**
 * Converts a screen-space pointer coordinate into worksheet (paper) space.
 *
 * This is the pure contract behind the freehand pointer handler in
 * WorksheetCanvas so the full-sheet coordinate mapping can be regression
 * tested without mounting the component.
 *
 * - rect is the getBoundingClientRect() of the SVG element covering the
 *   visible worksheet.
 * - At the identity viewport the top-left screen corner of the sheet must
 *   map to sheet (0,0) and the bottom-right corner must map to
 *   (WORKSHEET_WIDTH, WORKSHEET_HEIGHT): the complete visible paper is the
 *   drawable area.
 */
export function pointerToSheet(clientX: number, clientY: number, rect: PointerRect, viewport: CanvasViewport) {
  const x = (((clientX - rect.left) / rect.width) * WORKSHEET_WIDTH - viewport.offsetX) / viewport.scale;
  const y = (((clientY - rect.top) / rect.height) * WORKSHEET_HEIGHT - viewport.offsetY) / viewport.scale;
  return { x: Math.max(0, Math.min(WORKSHEET_WIDTH, x)), y: Math.max(0, Math.min(WORKSHEET_HEIGHT, y)) };
}

/**
 * Converts a pointer into viewport coordinates for pinch/pan gesture anchoring
 * (identity viewport behavior: fraction of the SVG element times sheet size).
 */
export function pointerAsViewport(clientX: number, clientY: number, rect: PointerRect) {
  return { x: ((clientX - rect.left) / rect.width) * WORKSHEET_WIDTH, y: ((clientY - rect.top) / rect.height) * WORKSHEET_HEIGHT };
}

export const defaultViewport: CanvasViewport = { scale: 1, offsetX: 0, offsetY: 0 };
