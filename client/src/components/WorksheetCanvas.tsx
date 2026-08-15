import type { PointerEvent as ReactPointerEvent } from "react";
import { useRef, useState } from "react";
import { nanoid } from "nanoid";
import type { StudioLayer, StudioTool, WorksheetCanvasState } from "@/lib/studioTypes";
import { WORKSHEET_HEIGHT, WORKSHEET_WIDTH } from "@/lib/studioTypes";
import { pressureAdjustedStroke, resolveStylusInput } from "@/lib/penInput";

type PointerSession = { kind: "draw"; id: string; pointerId: number; baseSize: number; isPen: boolean } | { kind: "move"; id: string; pointerId: number; originX: number; originY: number; layerX: number; layerY: number; isPen: boolean } | null;

type Props = {
  state: WorksheetCanvasState;
  onChange: (state: WorksheetCanvasState) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  tool: StudioTool;
  brushColor: string;
  brushSize: number;
  onPenDetected?: () => void;
};

export default function WorksheetCanvas({ state, onChange, selectedId, onSelect, tool, brushColor, brushSize, onPenDetected }: Props) {
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
    const strokeWidth = pressureAdjustedStroke(brushSize, stylus.pressure, stylus.isPen);
    const layer: StudioLayer = { id, type: "path", name: activeTool === "eraser" ? "Transparent erase" : stylus.isPen ? "Pressure brush stroke" : "Freehand stroke", d: `M ${current.x} ${current.y}`, color: brushColor, strokeWidth, mode: activeTool === "eraser" ? "erase" : "draw", x: 0, y: 0, width: 0, height: 0, rotation: 0, opacity: 1 };
    onChange({ ...state, layers: [...state.layers, layer] });
    onSelect(id);
    pointerRef.current = { kind: "draw", id, pointerId: event.pointerId, baseSize: brushSize, isPen: stylus.isPen };
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
      updateLayer(session.id, (layer) => layer.type === "path" ? { ...layer, d: `${layer.d} L ${current.x} ${current.y}`, strokeWidth: pressureAdjustedStroke(session.baseSize, stylus.pressure, session.isPen) } : layer);
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
        </defs>
        <rect width={WORKSHEET_WIDTH} height={WORKSHEET_HEIGHT} fill={state.transparentBackground ? "url(#checker)" : "#fff"} />
        <g style={{ isolation: "isolate" }}>
          {state.layers.map((layer) => {
            const active = layer.id === selectedId;
            const transform = `rotate(${layer.rotation} ${layer.x + layer.width / 2} ${layer.y + layer.height / 2})`;
            return <g key={layer.id} data-layer-id={layer.id} transform={layer.type === "image" ? transform : undefined} className={`canvas-layer ${active ? "is-selected" : ""}`}>
              {layer.type === "image" ? <image href={layer.src} x={layer.x} y={layer.y} width={layer.width} height={layer.height} opacity={layer.opacity} preserveAspectRatio="none" /> : <path d={layer.d} fill="none" stroke={layer.mode === "erase" ? "#000" : layer.color} strokeWidth={layer.strokeWidth} strokeLinecap="round" strokeLinejoin="round" opacity={layer.opacity} style={{ mixBlendMode: layer.mode === "erase" ? ("destination-out" as any) : "normal" }} />}
              {active && layer.type === "image" ? <rect className="selection-box" x={layer.x} y={layer.y} width={layer.width} height={layer.height} fill="none" transform={transform} /> : null}
            </g>;
          })}
        </g>
      </svg>
    </div>
  );
}
