# VEIKK VK1200 V2 Compatibility Notes

Paperloom’s pen workflow uses browser Pointer Events so a supported operating-system driver exposes the VK1200 V2 stylus as a pen input. The application responds to stylus pressure, honors the standard pen eraser button bit, and ignores non-pen touches while an active pen stroke is in progress. Browser applications cannot identify the physical tablet model or alter its driver mapping directly; VEIKK display mapping and shortcut configuration remain in the VEIKK driver.

VEIKK’s official product information describes the VK1200 V2 as using a battery-free P05 stylus with 16,384 pressure levels and up to 60° tilt, six customizable shortcut keys, and support for Windows, macOS, and Linux. VEIKK’s download page lists current device drivers and setup guidance.

## Sources

- [Studio VK1200 V2 official product page](https://veikk.com/products/studio-vk1200-v2)
- [VEIKK driver download page](https://veikk.com/pages/download)
