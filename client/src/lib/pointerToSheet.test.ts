import { describe, expect, it } from 'vitest';
import { CanvasViewport } from './canvasViewport';
import { defaultViewport, pointerAsViewport, pointerToSheet, PointerRect } from './pointerToSheet';
import { WORKSHEET_HEIGHT, WORKSHEET_WIDTH } from './studioTypes';

describe('full-sheet pointer coordinate mapping', () => {
  // A tablet-sized artboard frame (paper fills the frame edge-to-edge after
  // the flush layout change). The SVG rect covers the entire visible sheet.
  const rect: PointerRect = { left: 40, top: 100, width: 680, height: 880 };

  it('maps the top-left corner of the visible sheet to sheet origin', () => {
    const p = pointerToSheet(rect.left, rect.top, rect, defaultViewport);
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
  });

  it('maps the bottom-right corner of the visible sheet to the full sheet size', () => {
    const p = pointerToSheet(rect.left + rect.width, rect.top + rect.height, rect, defaultViewport);
    expect(p.x).toBe(WORKSHEET_WIDTH);
    expect(p.y).toBe(WORKSHEET_HEIGHT);
  });

  it('keeps mid-sheet points inside the drawable bounds', () => {
    const p = pointerToSheet(rect.left + rect.width / 2, rect.top + rect.height / 2, rect, defaultViewport);
    expect(p.x).toBe(WORKSHEET_WIDTH / 2);
    expect(p.y).toBe(WORKSHEET_HEIGHT / 2);
  });

  it('clamps pointers outside the sheet rather than producing NaN', () => {
    const outside = pointerToSheet(rect.left - 50, rect.top - 50, rect, defaultViewport);
    const insideBottom = pointerToSheet(rect.left + rect.width + 50, rect.top + rect.height + 50, rect, defaultViewport);
    expect(outside.x).toBe(0);
    expect(outside.y).toBe(0);
    expect(insideBottom.x).toBe(WORKSHEET_WIDTH);
    expect(insideBottom.y).toBe(WORKSHEET_HEIGHT);
  });

  it('applies zoom-out uniformly so edge-to-edge coverage is preserved', () => {
    const zoomed: CanvasViewport = { scale: 0.6, offsetX: 60, offsetY: 40 };
    // A zoomed-out corner would map beyond the sheet; clamping keeps every
    // screen coordinate a valid drawable point (full-sheet drawing).
    const corner = pointerToSheet(rect.left + rect.width, rect.top + rect.height, rect, zoomed);
    expect(corner.x).toBe(WORKSHEET_WIDTH);
    expect(corner.y).toBe(WORKSHEET_HEIGHT);
    // A mid-frame pointer under zoom lands strictly inside the sheet.
    const mid = pointerToSheet(rect.left + rect.width * 0.4, rect.top + rect.height * 0.4, rect, zoomed);
    expect(mid.x).toBeCloseTo((WORKSHEET_WIDTH * 0.4 - zoomed.offsetX) / zoomed.scale, 5);
    expect(mid.y).toBeCloseTo((WORKSHEET_HEIGHT * 0.4 - zoomed.offsetY) / zoomed.scale, 5);
    expect(mid.x).toBeGreaterThan(0);
    expect(mid.y).toBeGreaterThan(0);
  });

  it('anchors two-finger gestures as fractions of the full visible sheet', () => {
    const a = pointerAsViewport(rect.left, rect.top, rect);
    const b = pointerAsViewport(rect.left + rect.width, rect.top + rect.height, rect);
    expect(a.x).toBe(0);
    expect(a.y).toBe(0);
    expect(b.x).toBe(WORKSHEET_WIDTH);
    expect(b.y).toBe(WORKSHEET_HEIGHT);
  });
});
