import { describe, expect, it } from "vitest";
import { resolveStudioShortcut } from "./studioShortcuts";

describe("VEIKK shortcut command map", () => {
  it("maps brush and eraser keys without overriding browser command chords", () => {
    expect(resolveStudioShortcut({ key: "b" })).toBe("brush");
    expect(resolveStudioShortcut({ key: "e" })).toBe("eraser");
    expect(resolveStudioShortcut({ key: "b", ctrlKey: true })).toBeNull();
  });

  it("maps the driver-friendly undo, redo, save, and export chords", () => {
    expect(resolveStudioShortcut({ key: "z", ctrlKey: true })).toBe("undo");
    expect(resolveStudioShortcut({ key: "z", metaKey: true, shiftKey: true })).toBe("redo");
    expect(resolveStudioShortcut({ key: "s", ctrlKey: true })).toBe("save");
    expect(resolveStudioShortcut({ key: "e", metaKey: true, shiftKey: true })).toBe("export");
  });
});
