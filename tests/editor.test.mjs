import test from "node:test";
import assert from "node:assert/strict";
import { generateT5World, parseUwp } from "../src/generator.mjs";
import { MapDocument } from "../src/editor-model.mjs";
import { serializeWorldMap, deserializeWorldMap } from "../src/shared/world-map-data.mjs";
import { renderWorldMapSvg } from "../src/shared/world-map-grid.mjs";

const seeded = (seed = 1) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
for (const uwp of ["X100000-0", "B540489-B", "A867A74-C", "A800A74-C", "A86AA74-C", "A560A74-C", "XCBAA74-C", "A010000-0"]) {
  test(`T5 generation ${uwp} produces exchangeable map`, () => {
    if (uwp[1] === "0") { assert.throws(() => generateT5World({ uwp })); return; }
    const { grid, worldName } = generateT5World({ uwp, name: "Test world" }, { random: seeded() });
    const data = serializeWorldMap(grid, worldName);
    assert.deepEqual(deserializeWorldMap(data).data, data);
    assert.equal(grid.cells.length, 10 * parseUwp(uwp).size ** 2 + 2);
    if (uwp[3] === "0") assert.ok(grid.cells.every(c => c.surface === "land"));
    if (uwp[3] === "A") assert.ok(grid.cells.every(c => c.surface === "water"));
    if (uwp[0] === "X") assert.ok(grid.cells.every(c => !c.features.includes("starport")));
    else assert.equal(grid.cells.filter(c => c.features.includes("starport")).length, 1);
  });
}
test("generation profiles, climate codes and features survive serialization", () => {
  for (const tradeCodes of ["Fr", "Tu", "Ic", "Tz", "Di Pe Fa"]) {
    const { grid } = generateT5World({ uwp: "A867A74-C", tradeCodes, resourceCount: 5 }, { random: seeded() });
    const data = serializeWorldMap(grid, "World");
    assert.deepEqual(deserializeWorldMap(JSON.stringify(data)).data, data);
  }
});
test("population and atmosphere select towns, domes and arcologies", () => {
  for (const [uwp, feature] of [["A867574-C", "town"], ["A8B7A74-C", "dome"], ["A867A74-C", "arcology"]]) {
    const { grid } = generateT5World({ uwp }, { random: seeded() });
    assert.ok(grid.cells.some(c => c.features.includes(feature)));
  }
});
test("invalid profiles do not silently generate other worlds", () => {
  for (const uwp of ["", "hello", "A8I7A74-C", "A86BA74-C", "A8G7A74-C", "A000000-0"]) assert.throws(() => generateT5World({ uwp }));
});
test("painting shared cells, features, undo/redo and exact file restoration", () => {
  const { grid } = generateT5World({ uwp: "A867A74-C" }, { random: seeded() });
  const doc = new MapDocument(); doc.load(serializeWorldMap(grid, "World"));
  const id = grid.faces[0].fragments[0].cellId;
  const before = doc.data;
  doc.paint(id, "lake"); doc.feature(id, "starport"); doc.feature(id, "dome"); doc.commit();
  assert.equal(doc.cell(id).terrain, "lake"); assert.equal(doc.cell(id).surface, "water");
  assert.ok(doc.dirty);
  const edited = doc.data;
  const svg = renderWorldMapSvg(doc.grid, "World");
  assert.ok(svg.includes('data-feature="dome"'));
  doc.undo(); assert.deepEqual(doc.data, before); assert.equal(doc.dirty, false);
  doc.redo(); assert.deepEqual(doc.data, edited);
  doc.markSaved(); assert.equal(doc.dirty, false);
  doc.feature(id, "dome", true); doc.commit(); assert.ok(!doc.cell(id).features.includes("dome"));
  doc.undo(); assert.ok(doc.cell(id).features.includes("dome"));
  assert.deepEqual(deserializeWorldMap(JSON.stringify(doc.data)).data, edited);
});
test("blank painting initializes valid terrain; blank annotations remain exportable", () => {
  const { grid } = generateT5World({ uwp: "A867A74-C" }, { blank: true });
  const doc = new MapDocument(); doc.load(serializeWorldMap(grid, "Blank"));
  const id = grid.cells[0].id;
  doc.feature(id, "arcology"); doc.commit();
  assert.equal(deserializeWorldMap(doc.data).data.kind, "blank");
  doc.paint(id, "river"); doc.commit();
  assert.equal(deserializeWorldMap(doc.data).data.kind, "surface");
  doc.undo(); assert.equal(doc.data.kind, "blank");
  assert.ok(doc.cell(id).features.includes("arcology"));
});
test("new edits discard redo and invalid imports preserve the current document", () => {
  const { grid } = generateT5World({ uwp: "A867A74-C" });
  const doc = new MapDocument(); doc.load(serializeWorldMap(grid, "World"));
  const id = grid.cells[0].id;
  doc.paint(id, "clear"); doc.commit(); doc.undo();
  doc.feature(id, "city"); doc.commit(); assert.equal(doc.redoStack.length, 0);
  const before = doc.data;
  assert.throws(() => doc.load("bad JSON")); assert.deepEqual(doc.data, before);
});
