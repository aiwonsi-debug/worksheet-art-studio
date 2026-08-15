export type BrushPreset = {
  id: "pencil" | "marker" | "highlighter";
  label: string;
  color: string;
  size: number;
  opacity: number;
};

export const brushPresets: BrushPreset[] = [
  { id: "pencil", label: "Pencil", color: "#303632", size: 4, opacity: 0.9 },
  { id: "marker", label: "Marker", color: "#4263eb", size: 12, opacity: 1 },
  { id: "highlighter", label: "Highlighter", color: "#f3c94f", size: 24, opacity: 0.36 },
];

export function isActiveBrushPreset(preset: BrushPreset, settings: Pick<BrushPreset, "color" | "size" | "opacity">) {
  return preset.color === settings.color && preset.size === settings.size && preset.opacity === settings.opacity;
}
