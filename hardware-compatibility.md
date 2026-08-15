# VEIKK VK1200 V2 Compatibility Notes

Paperloom’s pen workflow uses browser Pointer Events so a supported operating-system driver exposes the VK1200 V2 stylus as a pen input. The application responds to stylus pressure, honors the standard pen eraser button bit, and ignores non-pen touches while an active pen stroke is in progress. Browser applications cannot identify the physical tablet model or alter its driver mapping directly; VEIKK display mapping and shortcut configuration remain in the VEIKK driver.

VEIKK’s official product information describes the VK1200 V2 as using a battery-free P05 stylus with 16,384 pressure levels and up to 60° tilt, six customizable shortcut keys, and support for Windows, macOS, and Linux. VEIKK’s download page lists current device drivers and setup guidance.

## Recommended six-key mapping

Configure these assignments in the VEIKK driver while Paperloom has focus. The application handles the corresponding browser commands; it cannot write these assignments into the device driver.

| VK1200 V2 shortcut key | Suggested driver assignment | Paperloom action |
|---|---|---|
| 1 | `B` | Select Brush |
| 2 | `E` | Select Eraser |
| 3 | `Ctrl`/`Cmd` + `Z` | Undo latest canvas edit |
| 4 | `Ctrl`/`Cmd` + `Shift` + `Z` | Redo latest canvas edit |
| 5 | `Ctrl`/`Cmd` + `S` | Save worksheet |
| 6 | `Ctrl`/`Cmd` + `Shift` + `E` | Export PDF |

## On-device validation

Use a current Chromium-based browser after installing the VEIKK driver. First confirm the pen cursor meets the center and corner targets in Paperloom’s **Pen display setup** panel. Next draw one light-to-firm continuous stroke and confirm it visibly widens as pressure increases; flip the pen or use its eraser mapping to confirm transparent erasing. Finally, test all six configured keys while the canvas, rather than a text field, has focus.

## Sources

- [Studio VK1200 V2 official product page](https://veikk.com/products/studio-vk1200-v2)
- [VEIKK driver download page](https://veikk.com/pages/download)
