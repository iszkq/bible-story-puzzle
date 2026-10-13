# Project rules

Read docs/design-system/manifest.json, design-system.md, component-map.md,
reference-board.md, and docs/设计流程与iOS页面规划.md before changing UI.
Update the design contract before introducing a new visual or interaction rule.
User instructions take precedence.

Shared game lives in web/; iOS/ hosts it with SwiftUI and WKWebView. Keep
12/24/48 grids, neutral snapping and submit-only correctness. Never reveal a
correct cell during dragging. Preserve immutable user image versions and trial
isolation. Keep all imported content local; do not add remote calls.

Run npm test for browser changes, python scripts/validate-project.py for package
changes, and macOS CI for native changes. Do not commit signing credentials.
