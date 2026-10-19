# Traveller World Map 0.1.0

First Windows release of the offline Traveller world-map generator and editor.

- Generate a 1,000 km world-hex map from UWP using the supplied Traveller5
  world-scale mapping procedure and terrain catalogue.
- Paint individual hexes, including matching fragments across globe seams.
- Add/remove starports, cities, towns, domed cities, arcologies and other features.
- Undo/redo edits; zoom, fit, inspect hexes and export an SVG image.
- Import existing Traveller Trading JSON and export edited maps back to Foundry.
- Native JSON open/save dialogs and unsaved-change prompts.

**Foundry compatibility:** update `traveller-trading` to **1.24.0 or newer**
before importing edited files with features. Both old version-1 maps and the
new version-2 format are supported. The Foundry target world's size must match.

Choose the **Setup** executable to install, or **Portable** to run without
installation. Both are Windows x64 builds. Runtime use is offline.

Generation is an editable overview, not canonical geography or a full climate
simulation. See RULES.md for the procedure, inputs and placement interpretations.

Validation: 93 automated checks across the app and companion module, plus a
desktop smoke test covering terrain/feature editing, native file IPC,
save/reopen, SVG export and compatibility with the actual Foundry importer.
