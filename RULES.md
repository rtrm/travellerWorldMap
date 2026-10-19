# World-scale generation and editing

This implementation interprets the user-supplied Traveller5 Book 3 extract's
world-map procedure. It does not distribute the source PDF or reproduce its
artwork. All operations use the verified shared icosahedral topology: 20 faces,
12 five-neighbour vertices and `10 × Size² + 2` distinct world cells.

## Procedure

The generator places resources and relief, then applies the ocean-face method,
coastal cells, small seas and island conversion. Climate passes establish caps
and frozen terrain before agricultural and settlement placement. Rural areas
expand from cities on the globe graph. Starports and remaining overview
features complete the map. Settlement/relief placements are constrained by
available cells and may share cells with other feature types.

- Ocean selection uses `Hyd × 2` distinct triangles. A cell on several triangles
  follows the majority of their ocean assignments, with canonical-face tie
  breaking. Shared cells never have conflicting terrain fragments.
- Small seas are selected from the available continental faces. Shore is
  represented by water-side coastal cells. Mountains covered by oceans become
  islands. Land/liquid classification is retained under polar ice.
- The habitable-zone control supplies the missing orbital assumption for ice
  caps. Explicit `Ic`, `Fr`, `Tu` and `Tz` codes enable their climate passes.
  Twilight-world divisions use the flat net's longitude as an overview
  approximation, not a calculated illumination model.
- `Va`, `De`, `Ag`, `Lo`, `Ni`, `Hi` and `Ic` are inferred from the UWP where
  appropriate. Additional two-letter codes can be entered. `Di`, `Fa`, `Pe`
  and the climate codes affect the corresponding placement passes.
- Resource count defaults to zero until supplied; the app cannot infer the
  economic extension, gas-giant or belt adjustment from a UWP.
- Unpopulated worlds have no towns, cities or estates. UWP starport X places no
  starport; A–E place one. Where a populated water world has no land, its
  settlement may be placed on water as a floating/domed overview feature.
- High-population worlds receive arcologies. Cities become domes under the
  atmosphere conditions described by the chart. The number of one-per-continent
  cities is capped by available continental faces.
- Relief is placed using the chart's dice-scale counts. Chasm and precipice
  placements are capped by triangle capacity. Wasteland and exotic terrain are
  placed on available land. Exact shape/adjacency is a referee-editable
  placement choice, not a claim to reproduce every possible table outcome.

## Editing and exchange

Painting changes one canonical cell, including every drawn seam fragment.
Painting the first terrain on a blank map initializes its other cells as Clear.
Features can be added without converting a blank map into terrain. Liquid
terrain brushes set liquid classification; painting land sets land. Ice retains
the existing classification. Features are independent of terrain, allowing a
domed city, starport and other items to share a hex.

Markers show up to four feature abbreviations in a hex; all assigned features
are stored and listed in the inspector and legend. Routes are per-hex
annotations at this scale, not an automatically connected routing network.

The file format is version 2, geometry version 1. Version-1 maps normalize to
version 2 without changing their terrain. Feature types and terrain keys are
validated against the shared catalogue; future/unknown values fail explicitly.
The companion Foundry module uses the same validator and renderer, so both
terrain edits and feature edits survive importing and re-exporting.
