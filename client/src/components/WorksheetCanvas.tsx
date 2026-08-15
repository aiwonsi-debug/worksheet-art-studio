import type { PointerEvent as ReactPointerEvent } from "react";
import { useRef, useState } from "react";
import { nanoid } from "nanoid";
import type { PathLayer, ShapeLayer, StudioLayer, StudioTool, TextLayer, WorksheetCanvasState } from "@/lib/studioTypes";
import { WORKSHEET_HEIGHT, WORKSHEET_WIDTH } from "@/lib/studioTypes";
import { createStrokePoint, pressureAdjustedStroke, resolveStylusInput } from "@/lib/penInput";
import { fillSelectedShape, sampleLayerColor } from "@/lib/advancedDrawingTools";
import { shapePoints } from "@/lib/drawingElements";
import { smoothStrokeSegments, stabilizeStrokePoint } from "@/lib/smoothStroke";
import { ribbonStrokePath } from "@/lib/ribbonStroke";
import { nextViewportFromTouchGesture, shouldNavigateTouch, type CanvasViewport, type ViewportTouchPoint } from "@/lib/canvasViewport";

type PointerSession = { kind: "draw"; id: string; pointerId: number; baseSize: number; sensitivity: number; stabilizer: number; isPen: boolean } | { kind: "move"; id: string; pointerId: number; originX: number; originY: number; layerX: number; layerY: number; isPen: boolean } | null;

type Props = {
  state: WorksheetCanvasState;
  onChange: (state: WorksheetCanvasState) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  tool: StudioTool;
  brushColor: string;
  brushSize: number;
  brushOpacity: number;
  pressureSensitivity: number;
  smoothingStrength: number;
  stabilizerStrength: number;
  onPenDetected?: () => void;
  onEditStart?: () => void;
  onPickColor?: (color: string) => void;
};

function VariableStroke({ layer }: { layer: PathLayer }) {
  const points = layer.points;
  const isEraser = layer.mode === "erase";
  const style = { mixBlendMode: isEraser ? ("destination-out" as any) : "normal" };
  if (!points?.length) return <path d={layer.d} fill="none" stroke={isEraser ? "#000" : layer.color} strokeWidth={layer.strokeWidth} strokeLinecap="round" strokeLinejoin="round" opacity={layer.opacity} style={style} />;
  if (points.length === 1) return <circle cx={points[0].x} cy={points[0].y} r={points[0].size / 2} fill={isEraser ? "#000" : layer.color} opacity={layer.opacity} style={style} />;
  // Ink strokes render as one filled ribbon with tapered ends, easing width
  // gradually between pressure samples like a real brush. Eraser marks keep
  // the legacy segments since the destination-out mask blends additively.
  if (!isEraser) return <g opacity={layer.opacity} style={style}><path d={ribbonStrokePath(points, layer.smoothing ?? 1)} fill={layer.color} /></g>;
  return <g opacity={layer.opacity} style={style}>{smoothStrokeSegments(points, layer.smoothing ?? 1).map((segment, index) => <path key={`${layer.id}-segment-${index}`} d={segment.d} fill="none" stroke="#000" strokeWidth={segment.size} strokeLinecap="round" strokeLinejoin="round" />)}</g>;
}

function ShapeElement({ layer }: { layer: ShapeLayer }) {
  const common = { stroke: layer.stroke, strokeWidth: layer.strokeWidth, opacity: layer.opacity, fill: layer.fill, fillOpacity: layer.fillOpacity };
  if (layer.shape === "rectangle") return <rect x={layer.x} y={layer.y} width={layer.width} height={layer.height} rx={12} {...common} />;
  if (layer.shape === "ellipse") return <ellipse cx={layer.x + layer.width / 2} cy={layer.y + layer.height / 2} rx={Math.abs(layer.width / 2)} ry={Math.abs(layer.height / 2)} {...common} />;
  const points = shapePoints(layer.shape, layer.x, layer.y, layer.width, layer.height);
  if (points) return <polygon points={points} {...common} />;
  return <line x1={layer.x} y1={layer.y} x2={layer.x + layer.width} y2={layer.y + layer.height} stroke={layer.stroke} strokeWidth={layer.strokeWidth} strokeLinecap="round" opacity={layer.opacity} markerEnd={layer.shape === "arrow" ? "url(#paperloom-arrow)" : undefined} />;
}

function TextElement({ layer }: { layer: TextLayer }) {
  return <><text x={layer.x} y={layer.y + layer.fontSize} fill={layer.color} fontSize={layer.fontSize} fontWeight={layer.fontWeight} opacity={layer.opacity} fontFamily="DM Sans, sans-serif">{layer.text}</text><rect x={layer.x} y={layer.y} width={layer.width} height={layer.height} fill="transparent" /></>;
}

export default function WorksheetCanvas({ state, onChange, selectedId, onSelect, tool, brushColor, brushSize, brushOpacity, pressureSensitivity, smoothingStrength, stabilizerStrength, onPenDetected, onEditStart, onPickColor }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pointerRef = useRef<PointerSession>(null);
  const activePenPointerId = useRef<number | null>(null);
  const touchPointsRef = useRef<Map<number, ViewportTouchPoint>>(new Map());
  const touchStartRef = useRef<{ viewport: CanvasViewport; points: ViewportTouchPoint[] } | null>(null);
  const viewportRef = useRef<CanvasViewport>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [viewport, setViewport] = useState<CanvasViewport>(viewportRef.current);
  const [isDrawing, setIsDrawing] = useState(false);

  const setCanvasViewport = (next: CanvasViewport) => {
    viewportRef.current = next;
    setViewport(next);
  };

  const asViewportTouch = (event: ReactPointerEvent<SVGSVGElement>): ViewportTouchPoint => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { id: event.pointerId, x: 0, y: 0 };
    return { id: event.pointerId, x: ((event.clientX - rect.left) / rect.width) * WORKSHEET_WIDTH, y: ((event.clientY - rect.top) / rect.height) * WORKSHEET_HEIGHT };
  };

  const resetTouchBaseline = () => {
    touchStartRef.current = { viewport: viewportRef.current, points: Array.from(touchPointsRef.current.values()) };
  };

  const point = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const x = (((event.clientX - rect.left) / rect.width) * WORKSHEET_WIDTH - viewportRef.current.offsetX) / viewportRef.current.scale;
    const y = (((event.clientY - rect.top) / rect.height) * WORKSHEET_HEIGHT - viewportRef.current.offsetY) / viewportRef.current.scale;
    return { x: Math.max(0, Math.min(WORKSHEET_WIDTH, x)), y: Math.max(0, Math.min(WORKSHEET_HEIGHT, y)) };
  };

  const updateLayer = (id: string, update: (layer: StudioLayer) => StudioLayer) => onChange({ ...state, layers: state.layers.map((layer) => layer.id === id ? update(layer) : layer) });

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType === "touch") {
      touchPointsRef.current.set(event.pointerId, asViewportTouch(event));
      event.currentTarget.setPointerCapture(event.pointerId);
      if (shouldNavigateTouch(touchPointsRef.current.size)) {
        const activeSession = pointerRef.current;
        if (activeSession?.kind === "draw") {
          onChange({ ...state, layers: state.layers.filter((layer) => layer.id !== activeSession.id) });
          onSelect(null);
        }
        pointerRef.current = null;
        setIsDrawing(false);
        resetTouchBaseline();
        return;
      }
    }
    const stylus = resolveStylusInput(event, activePenPointerId.current !== null);
    if (stylus.shouldIgnore) return;
    if (stylus.isPen) { activePenPointerId.current = event.pointerId; onPenDetected?.(); }
    const target = event.target as Element;
    const layerId = target.closest("[data-layer-id]")?.getAttribute("data-layer-id");
    const current = point(event);
    const activeTool = stylus.isEraser ? "eraser" : tool;
    if (activeTool === "bucket" || activeTool === "eyedropper") {
      const layer = layerId ? state.layers.find((item) => item.id === layerId) : undefined;
      if (!layer) { onSelect(null); return; }
      if (activeTool === "bucket" && layer.type === "shape") {
        const next = fillSelectedShape(state, layer.id, brushColor);
        if (next !== state) { onEditStart?.(); onChange(next); onSelect(layer.id); }
      }
      if (activeTool === "eyedropper") {
        const color = sampleLayerColor(layer);
        if (color) { onPickColor?.(color); onSelect(layer.id); }
      }
      return;
    }
    if (activeTool === "select" && layerId) {
      const layer = state.layers.find((item) => item.id === layerId);
      if (!layer) return;
      onEditStart?.();
      onSelect(layerId);
      pointerRef.current = { kind: "move", id: layerId, pointerId: event.pointerId, originX: current.x, originY: current.y, layerX: layer.x, layerY: layer.y, isPen: stylus.isPen };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (activeTool === "select") {
      onSelect(null);
      return;
    }
    const id = nanoid();
    const strokeWidth = pressureAdjustedStroke(brushSize, stylus.pressure, stylus.isPen, pressureSensitivity);
    const layer: StudioLayer = { id, type: "path", name: activeTool === "eraser" ? "Transparent erase" : stylus.isPen ? "Pressure brush stroke" : "Freehand stroke", d: `M ${current.x} ${current.y}`, color: brushColor, strokeWidth, mode: activeTool === "eraser" ? "erase" : "draw", x: 0, y: 0, width: 0, height: 0, rotation: 0, opacity: activeTool === "eraser" ? 1 : brushOpacity, smoothing: smoothingStrength, points: [createStrokePoint(current.x, current.y, brushSize, stylus.pressure, stylus.isPen, pressureSensitivity)] };
    onEditStart?.();
    onChange({ ...state, layers: [...state.layers, layer] });
    onSelect(id);
    pointerRef.current = { kind: "draw", id, pointerId: event.pointerId, baseSize: brushSize, sensitivity: pressureSensitivity, stabilizer: stabilizerStrength, isPen: stylus.isPen };
    setIsDrawing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType === "touch" && touchPointsRef.current.has(event.pointerId) && shouldNavigateTouch(touchPointsRef.current.size)) {
      touchPointsRef.current.set(event.pointerId, asViewportTouch(event));
      const start = touchStartRef.current;
      if (start) setCanvasViewport(nextViewportFromTouchGesture(start.viewport, start.points, Array.from(touchPointsRef.current.values())));
      return;
    }
    const session = pointerRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const stylus = resolveStylusInput(event, session.isPen);
    if (stylus.shouldIgnore || (session.isPen && !stylus.isPen)) return;
    const current = point(event);
    if (session.kind === "draw") {
      updateLayer(session.id, (layer) => {
        if (layer.type !== "path") return layer;
        const rawPoint = createStrokePoint(current.x, current.y, session.baseSize, stylus.pressure, session.isPen, session.sensitivity);
        const priorPoint = layer.points?.at(-1);
        const nextPoint = priorPoint ? stabilizeStrokePoint(priorPoint, rawPoint, session.stabilizer) : rawPoint;
        return { ...layer, d: `${layer.d} L ${nextPoint.x} ${nextPoint.y}`, strokeWidth: nextPoint.size, points: [...(layer.points ?? []), nextPoint] };
      });
      return;
    }
    updateLayer(session.id, (layer) => ({ ...layer, x: Math.max(-layer.width / 2, Math.min(WORKSHEET_WIDTH - layer.width / 2, session.layerX + current.x - session.originX)), y: Math.max(-layer.height / 2, Math.min(WORKSHEET_HEIGHT - layer.height / 2, session.layerY + current.y - session.originY)) }));
  };

  const stopPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType === "touch") {
      touchPointsRef.current.delete(event.pointerId);
      resetTouchBaseline();
      if (!pointerRef.current || pointerRef.current.pointerId !== event.pointerId) return;
    }
    if (pointerRef.current && pointerRef.current.pointerId !== event.pointerId) return;
    if (activePenPointerId.current === event.pointerId) activePenPointerId.current = null;
    pointerRef.current = null;
    setIsDrawing(false);
  };

  return (
    <div className={`worksheet-stage ${isDrawing ? "is-drawing" : ""}`}>
      <svg ref={svgRef} viewBox={`0 0 ${WORKSHEET_WIDTH} ${WORKSHEET_HEIGHT}`} className={`worksheet-paper ${state.transparentBackground ? "is-transparent" : ""}`} style={{ touchAction: "none" }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={stopPointer} onPointerCancel={stopPointer} onLostPointerCapture={stopPointer} onDoubleClick={() => setCanvasViewport({ scale: 1, offsetX: 0, offsetY: 0 })} aria-label="Editable worksheet canvas">
        <defs>
          <pattern id="checker" width="28" height="28" patternUnits="userSpaceOnUse"><rect width="28" height="28" fill="#fff"/><rect width="14" height="14" fill="#f5f4f1"/><rect x="14" y="14" width="14" height="14" fill="#f5f4f1"/></pattern>
          <marker id="paperloom-arrow" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M 0 0 L 8 4 L 0 8 z" fill="#42634f"/></marker>
        </defs>
        <rect width={WORKSHEET_WIDTH} height={WORKSHEET_HEIGHT} fill={state.transparentBackground ? "url(#checker)" : "#fff"} />
        <g transform={`translate(${viewport.offsetX} ${viewport.offsetY}) scale(${viewport.scale})`}>
        <g style={{ isolation: "isolate" }}>
          {state.layers.map((layer) => {
            const active = layer.id === selectedId;
            const transform = `rotate(${layer.rotation} ${layer.x + layer.width / 2} ${layer.y + layer.height / 2})`;
            return <g key={layer.id} data-layer-id={layer.id} transform={layer.type === "path" ? undefined : transform} className={`canvas-layer ${active ? "is-selected" : ""}`}>
              {layer.type === "image" ? <image href={layer.src} x={layer.x} y={layer.y} width={layer.width} height={layer.height} opacity={layer.opacity} preserveAspectRatio="none" /> : layer.type === "path" ? <VariableStroke layer={layer} /> : layer.type === "shape" ? <ShapeElement layer={layer} /> : <TextElement layer={layer} />}
              {active && layer.type !== "path" ? <rect className="selection-box" x={layer.x} y={layer.y} width={layer.width} height={layer.height || Math.max(layer.type === "shape" ? layer.strokeWidth : 0, 18)} fill="none" /> : null}
            </g>;
          })}
        </g>
        </g>
      </svg>
    </div>
  );
}
