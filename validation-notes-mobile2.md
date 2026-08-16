# Validation — Zoom-Floor Mobile Fix (2026-08-16)

At 390x844 the worksheet paper fills the visible frame edge-to-edge: the white stage borders align with the paper edge, the green framing ring surrounds the full sheet, and no white margin sits between the sheet boundary and the visible edge. The floating brush toolbar and history controls overlay the sheet corners without occluding the drawing surface, and the bottom brush library dock remains reachable below the worksheet.

All 74 automated tests pass and TypeScript checks are clean. The pinch gesture can no longer reduce the sheet below identity scale, which removes the zoomed-out state the user encountered (the only code path that could shrink the sheet inside the stage). Pan at scale 1 remains possible and drawing registers across the entire visible sheet via the full-sheet pointer mapping.
