# Diagrams for SSA Admin

This folder contains SVG diagrams you can import directly into Figma.

- Architecture Overview: `ssa-admin/docs/architecture-diagram.svg`
  - Shows App shell, feature modules, shared layer, and external services (Supabase, Storage, tesseract.js).
  - Useful for understanding code organization and dependencies.

- Runtime Flow: `ssa-admin/docs/runtime-flow.svg`
  - End-to-end flow from app mount and auth to feature data load, edit/save, CSV import, Storage uploads, and OCR (Events).
  - Useful for onboarding and explaining typical user/system interactions.

Convert to PNG/JPEG locally
- Open `ssa-admin/docs/svg-to-raster.html` in your browser.
- Drag-drop the SVGs or click the provided buttons to load them.
- Click the Download PNG/JPEG buttons; you can set max width and JPEG background.

Import Notes:
- In Figma, use File → Place Image or drag the `.svg` into a canvas.
- The diagrams are vector-based; you can ungroup/annotate as needed.
- If you need variants or additional flows, let me know and I can add them.
