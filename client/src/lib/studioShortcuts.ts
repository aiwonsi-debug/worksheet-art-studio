export type StudioShortcut = "brush" | "eraser" | "undo" | "redo" | "save" | "export" | null;

export type ShortcutEvent = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
};

export function resolveStudioShortcut(event: ShortcutEvent): StudioShortcut {
  const key = event.key.toLowerCase();
  const command = Boolean(event.ctrlKey || event.metaKey);
  if (!command && key === "b") return "brush";
  if (!command && key === "e") return "eraser";
  if (command && key === "z") return event.shiftKey ? "redo" : "undo";
  if (command && key === "s") return "save";
  if (command && event.shiftKey && key === "e") return "export";
  return null;
}
