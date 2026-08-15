import type { PointerEvent as ReactPointerEvent } from "react";
import { useRef, useState } from "react";
import { nanoid } from "nanoid";
import type { PathLayer, ShapeLayer, StudioLayer, StudioTool, TextLayer, WorksheetCanvasState } from "@/lib/studioTypes";
import { WORKSHEET_HEIGHT, WORKSHEET_WIDTH } from "@/lib/studioTypes";
import { createStrokePoint, pressureAdjustedStroke, resolveStylusInput } from "@/lib/penInput";

type PointerSession = { kind: "draw"; id: string; pointerId: number; baseSize: number; sensitivity: number; isPen: boolean } | { kind: "move"; id: string; pointerId: number; originX: number; originY: number; layerX: number; layerY: number; isPen: boolean } | null;

type Props = {
  state: WorksheetCanvasState;
  onChange: (state: WorksheetCanvasState) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  tool: StudioTool;
  brushColor: string;
  brushSize: number;
  pressureSensitivity: number;
  onPenDetected?: () => void;
  onEditStart?: () => void;
};

function VariableStroke({ layer }: { layer: PathLayer }) {
  const points = layer.points;
  const style = { mixBlendMode: layer.mode === "erase" ? ("destination-out" as any) : "normal" };
  if (!points?.length) return <path d={layer.d} fill="none" stroke={layer.mode === "erase" ? "#000" : layer.color} strokeWidth={layer.strokeWidth} strokeLinecap="round" strokeLinejoin="round" opacity={layer.opacity} style={style} />;
  if (points.length === 1) return <circle cx={points[0].x} cy={points[0].y} r={points[0].size / 2} fill={layer.mode === "erase" ? "#000" : layer.color} opacity={layer.opacity} style={style} />;
  return <g opacity={layer.opacity} style={style}>{points.slice(1).map((point, index) => { const previous = points[index]; return <path key={`${point.x}-${point.y}-${index}`} d={`M ${previous.x} ${previous.y} L ${point.x} ${point.y}`} fill="none" stroke={layer.mode === "erase" ? "#000" : layer.color} strokeWidth={point.size} strokeLinecap="round" strokeLinejoin="round" />; })}</g>;
}

function ShapeElement({ layer }: { layer: ShapeLayer }) {
  const common = { stroke: layer.stroke, strokeWidth: layer.strokeWidth, opacity: layer.opacity, fill: layer.fill, fillOpacity: layer.fillOpacity };
  if (layer.shape === "rectangle") return <rect x={layer.x} y={layer.y} width={layer.width} height={layer.height} rx={12} {...common} />;
  if (layer.shape === "ellipse") return <ellipse cx={layer.x + layer.width / 2} cy={layer.y + layer.height / 2} rx={Math.abs(layer.width / 2)} ry={Math.abs(layer.height / 2)} {...common} />;
  return <line x1={layer.x} y1={layer.y} x2={layer.x + layer.width} y2={layer.y + layer.height} stroke={layer.stroke} strokeWidth={layer.strokeWidth} strokeLinecap="round" opacity={layer.opacity} markerEnd={layer.shape === "arrow" ? "url(#paperloom-arrow)" : undefined} />;
}

function TextElement({ layer }: { layer: TextLayer }) {
  return <><text x={layer.x} y={layer.y + layer.fontSize} fill={layer.color} fontSize={layer.fontSize} fontWeight={layer.fontWeight} opacity={layer.opacity} fontFamily="DM Sans, sans-serif">{layer.text}</text><rect x={layer.x} y={layer.y} width={layer.width} height={layer.height} fill="transparent" /></>;
}

export default function WorksheetCanvas({ state, onChange, selectedId, onSelect, tool, brushColor, brushSize, pressureSensitivity, onPenDetected, onEditStart }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pointerRef = useRef<PointerSession>(null);
  const activePenPointerId = useRef<number | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const point = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(WORKSHEET_WIDTH, ((event.clientX - rect.left) / rect.width) * WORKSHEET_WIDTH)),
      y: Math.max(0, Math.min(WORKSHEET_HEIGHT, ((event.clientY - rect.top) / rect.height) * WORKSHEET_HEIGHT)),
    };
  };

  const updateLayer = (id: string, update: (layer: StudioLayer) => StudioLayer) => onChange({ ...state, layers: state.layers.map((layer) => layer.id === id ? update(layer) : layer) });

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const stylus = resolveStylusInput(event, activePenPointerId.current !== null);
    if (stylus.shouldIgnore) return;
    if (stylus.isPen) { activePenPointerId.current = event.pointerId; onPenDetected?.(); }
    const target = event.target as Element;
    const layerId = target.closest("[data-layer-id]")?.getAttribute("data-layer-id");
    const current = point(event);
    const activeTool = stylus.isEraser ? "eraser" : tool;
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
    const layer: StudioLayer = { id, type: "path", name: activeTool === "eraser" ? "Transparent erase" : stylus.isPen ? "Pressure brush stroke" : "Freehand stroke", d: `M ${current.x} ${current.y}`, color: brushColor, strokeWidth, mode: activeTool === "eraser" ? "erase" : "draw", x: 0, y: 0, width: 0, height: 0, rotation: 0, opacity: 1, points: [createStrokePoint(current.x, current.y, brushSize, stylus.pressure, stylus.isPen, pressureSensitivity)] };
    onEditStart?.();
    onChange({ ...state, layers: [...state.layers, layer] });
    onSelect(id);
    pointerRef.current = { kind: "draw", id, pointerId: event.pointerId, baseSize: brushSize, sensitivity: pressureSensitivity, isPen: stylus.isPen };
    setIsDrawing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const session = pointerRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const stylus = resolveStylusInput(event, session.isPen);
    if (stylus.shouldIgnore || (session.isPen && !stylus.isPen)) return;
    const current = point(event);
    if (session.kind === "draw") {
      updateLayer(session.id, (layer) => layer.type === "path" ? { ...layer, d: `${layer.d} L ${current.x} ${current.y}`, strokeWidth: pressureAdjustedStroke(session.baseSize, stylus.pressure, session.isPen, session.sensitivity), points: [...(layer.points ?? []), createStrokePoint(current.x, current.y, session.baseSize, stylus.pressure, session.isPen, session.sensitivity)] } : layer);
      return;
    }
    updateLayer(session.id, (layer) => ({ ...layer, x: Math.max(-layer.width / 2, Math.min(WORKSHEET_WIDTH - layer.width / 2, session.layerX + current.x - session.originX)), y: Math.max(-layer.height / 2, Math.min(WORKSHEET_HEIGHT - layer.height / 2, session.layerY + current.y - session.originY)) }));
  };

  const stopPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (pointerRef.current && pointerRef.current.pointerId !== event.pointerId) return;
    if (activePenPointerId.current === event.pointerId) activePenPointerId.current = null;
    pointerRef.current = null;
    setIsDrawing(false);
  };

  return (
    <div className={`worksheet-stage ${isDrawing ? "is-drawing" : ""}`}>
      <svg ref={svgRef} viewBox={`0 0 ${WORKSHEET_WIDTH} ${WORKSHEET_HEIGHT}`} className={`worksheet-paper ${state.transparentBackground ? "is-transparent" : ""}`} style={{ touchAction: "none" }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={stopPointer} onPointerCancel={stopPointer} onLostPointerCapture={stopPointer} aria-label="Editable worksheet canvas">
        <defs>
          <pattern id="checker" width="28" height="28" patternUnits="userSpaceOnUse"><rect width="28" height="28" fill="#fff"/><rect width="14" height="14" fill="#f5f4f1"/><rect x="14" y="14" width="14" height="14" fill="#f5f4f1"/></pattern>
          <marker id="paperloom-arrow" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M 0 0 L 8 4 L 0 8 z" fill="#42634f"/></marker>
        </defs>
        <rect width={WORKSHEET_WIDTH} height={WORKSHEET_HEIGHT} fill={state.transparentBackground ? "url(#checker)" : "#fff"} />
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
      </svg>
    </div>
  );
}
