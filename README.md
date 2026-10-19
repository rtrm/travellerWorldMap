# Traveller World Map

An offline Windows application for generating and editing Traveller RPG world
maps. Generate from a UWP, paint individual world hexes, place or remove
settlements and other features, and exchange editable JSON with the
`traveller-trading` Foundry module.

## Windows installation

Download either executable from this repository's Releases page:

- **Traveller-World-Map-Setup-0.1.0.exe** installs the application for your user.
- **Traveller-World-Map-Portable-0.1.0.exe** runs without installation.

Windows 10/11 x64 is the initial target. No Foundry installation, Forge account,
internet connection or separate Node.js installation is needed to use the app.

## Use

1. Enter a world name and UWP, such as `A867A74-C`, and select **Generate world**.
   Optional generation details supply trade codes, climate assumptions and
   resource hexes that cannot be determined from UWP alone.
2. Select **Terrain**, choose a terrain brush, and click or drag over hexes.
   Every fragment of a shared hex updates together across the map's seams.
3. Select **Feature** to add a starport, city, town, domed city, arcology or
   another marker. **− Feature** removes the selected marker. The inspector
   lists every feature on a selected hex and can remove one or all of them.
4. Undo/redo works for brush strokes, features and renaming. Up to 50 edit
   operations are retained. **Fit map** and zoom controls help with larger worlds.
5. **Export JSON** saves the editable document. **Import JSON** opens an
   existing map, including files exported from Traveller Trading. **Export SVG**
   saves the map image with its editable data embedded as metadata.

Maps are not automatically saved. Unsaved changes are indicated and protected
by replacement/close prompts. Export JSON before closing to keep your work.

## Foundry exchange

Install **traveller-trading 1.24.0 or newer** before importing edited maps with
features. In the World actor's Map tab use **Export Map Data**, open that JSON
here, make edits, export JSON, then use **Import Map Data** in Foundry. The
target actor must have the same UWP size. Importing does not change its UWP.

The app reads version-1 and version-2 `traveller-trading-world-map` JSON and
writes version 2. It preserves canonical cell identities, terrain, liquid/land
state, features, and available world profile metadata. The file limit is 5 MB.
Files never provide executable code, custom SVG or geometry to the importer.

The map geometry, serialization, palette and feature rendering are shared with
Traveller Trading. Copies in `src/shared/` must be updated together with its
`scripts/world-map-*.mjs` modules. Regression tests cover both formats, and the
desktop smoke test verifies an edited export against the real Foundry importer.

## Rules basis

The supplied Traveller5 2019 Book 3 extract informs world-scale mapping only:

- Pages 37–41: the 20-face globe net, world-size subdivision, constant 1,000 km
  world hexes, and zero-distance continuation across cut edges.
- Pages 46–47: terrain categories and settlements/infrastructure.
- Page 49, chart 11: relief, ocean triangles, seas, islands, climate, cropland,
  settlements, rural areas and starport placement.

Generation uses random placement within the chart's constraints, with capacity
limits on small worlds. Oceans occupy `Hyd × 2` selected faces; shared-edge
cells vote between incident faces. Source climate, economic and trade details
that UWP cannot supply are explicit inputs. Population/atmosphere determine
towns, cities, domes and arcologies. This is an overview generator, not canonical
published geography or a climate/stellar simulation. Terrain/feature symbols
use readable abbreviations and an on-map legend, not copies of the PDF artwork.

Details and deliberate placement interpretations are in [RULES.md](RULES.md).
The copyrighted rules PDF is not distributed with this application. No terrain,
local or single-hex submaps are generated.

## Development

Use Node.js 22.12 or newer, npm, and Windows:

```sh
npm ci
npm start
npm test
npm run dist
```

`dist/` contains the installer, portable executable and unpacked app. The
lockfile pins dependencies. Electron runs offline with context isolation,
sandboxing, no renderer Node integration, and narrowly scoped native file IPC.

An optional end-to-end smoke test uses Playwright with Electron:

```sh
node tests/desktop-smoke.mjs
```

Set `PLAYWRIGHT_MODULE` to an existing Playwright package, or install Playwright
locally as a development tool. Keep a sibling `traveller-trading` checkout for
the smoke test's final compatibility assertion. `TWM_EXECUTABLE` can point to
the packaged executable for the same test. It checks actual IPC file handling
with stubbed native dialogs in a separate hidden test instance.
