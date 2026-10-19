import { MapDocument } from "./editor-model.mjs";
import { generateT5World, parseUwp } from "./generator.mjs";
import { renderWorldMapSvg } from "./shared/world-map-grid.mjs";
import { serializeWorldMap, deserializeWorldMap, embedWorldMapData } from "./shared/world-map-data.mjs";
import { TERRAIN_STYLES } from "./shared/world-map-terrain.mjs";
import { MAP_FEATURES } from "./shared/world-map-features.mjs";

const $ = id => document.getElementById(id);
const doc = new MapDocument();
let selected = null, tool = "inspect", zoom = 1, drawing = false, frame = null;
const toolHelp = { inspect: "Click any hex to inspect its terrain and features.", paint: "Click or drag to paint terrain. Shared fragments change together.", add: "Click or drag to add the selected feature. Existing terrain stays in place.", erase: "Click or drag to remove the selected feature. Use the inspector to remove all features." };
const status = (text, error = false) => { $("status").textContent = text; $("status").classList.toggle("error", error); };
const run = fn => async event => { try { await fn(event); } catch (error) { console.error(error); status(error.message || String(error), true); } };
function requireMap() { if (!doc.grid) throw new Error("Generate a world or import a map first."); }
function allowReplace() { return !doc.dirty || window.confirm("This map has unsaved changes. Replace it? Export JSON first to keep your edits."); }
function setTool(value) {
  tool = value;
  document.querySelectorAll("[data-tool]").forEach(button => { button.classList.toggle("active", button.dataset.tool === tool); button.setAttribute("aria-pressed", button.dataset.tool === tool); });
  $("tool-help").textContent = toolHelp[tool];
}
function options(select, entries) {
  for (const [key, style] of Object.entries(entries)) { const option = document.createElement("option"); option.value = key; option.textContent = style.label; select.append(option); }
}
options($("terrain"), TERRAIN_STYLES); options($("selected-terrain-input"), TERRAIN_STYLES); options($("feature"), MAP_FEATURES);
$("terrain").value = "clear";
for (const [key, style] of Object.entries(TERRAIN_STYLES)) {
  const button = document.createElement("button"); button.style.background = style.color; button.title = style.label; button.setAttribute("aria-label", style.label); button.dataset.terrain = key;
  button.onclick = () => { $("terrain").value = key; setTool("paint"); refreshSwatches(); };
  $("terrain-swatches").append(button);
}
for (const [key, style] of Object.entries(MAP_FEATURES)) {
  const button = document.createElement("button"); button.dataset.feature = key;
  const mark = document.createElement("span"); mark.textContent = style.mark; button.append(mark, style.label);
  button.onclick = run(() => { if (!selected) return; doc.feature(selected, key); doc.commit(); render(); status(`${style.label} added to selected hex.`); });
  $("feature-picker").append(button);
}
function refreshSwatches() { document.querySelectorAll("[data-terrain]").forEach(button => button.classList.toggle("active", button.dataset.terrain === $("terrain").value)); }
function profileSummary() {
  try { const p = parseUwp($("uwp").value); $("profile-summary").textContent = `Size ${p.size} · ${p.hydrographics * 10}% hydrographics · Population code ${p.population}`; }
  catch { $("profile-summary").textContent = "Enter a complete UWP to generate a new world."; }
}
function updateFields() {
  $("world-name").value = doc.worldName;
  $("uwp").value = doc.grid.profile?.uwp || "";
  $("trade-codes").value = doc.grid.profile?.tradeCodes.join(" ") || "";
  $("climate").value = doc.grid.profile?.habitableZone === false ? "hot" : "hz";
  $("resources").value = doc.grid.profile?.resourceCount || 0;
  profileSummary();
}
function inspector() {
  const cell = doc.cell(selected);
  $("selection").hidden = !cell; $("selection-empty").hidden = Boolean(cell);
  if (!cell) return;
  const style = TERRAIN_STYLES[cell.terrain] || { label: "Blank terrain", color: "#fff" };
  $("selected-terrain").textContent = style.label;
  $("selected-color").style.background = style.color;
  $("selected-surface").textContent = `${cell.surface || "Unspecified surface"} · ${cell.neighbors.size} neighbours`;
  $("selected-terrain-input").value = cell.terrain || "clear";
  $("feature-list").replaceChildren();
  if (!cell.features?.length) $("feature-list").textContent = "No features";
  for (const key of cell.features || []) {
    const button = document.createElement("button"); button.textContent = `${MAP_FEATURES[key].label} ×`; button.title = `Remove ${MAP_FEATURES[key].label}`;
    button.onclick = run(() => { doc.feature(selected, key, true); doc.commit(); render(); }); $("feature-list").append(button);
  }
  $("clear-features").disabled = !cell.features?.length;
}
function applyZoom() {
  const svg = $("map").querySelector("svg"); if (!svg) return;
  svg.style.width = `${Number(svg.getAttribute("width")) * zoom}px`;
  $("zoom-label").textContent = `${Math.round(zoom * 100)}%`;
}
function fit() {
  const svg = $("map").querySelector("svg"); if (!svg) return;
  zoom = Math.max(0.1, Math.min(3, ($("viewport").clientWidth - 56) / Number(svg.getAttribute("width")))); applyZoom();
}
function render() {
  frame = null;
  if (!doc.grid) return;
  $("empty").hidden = true;
  $("map").innerHTML = renderWorldMapSvg(doc.grid, doc.worldName);
  for (const polygon of $("map").querySelectorAll("polygon[data-cell]")) if (polygon.dataset.cell === selected) polygon.dataset.selected = "true";
  $("document-name").textContent = doc.worldName;
  if (document.activeElement !== $("world-name")) $("world-name").value = doc.worldName;
  $("dirty").textContent = doc.dirty ? "UNSAVED" : "SAVED";
  const features = doc.grid.cells.reduce((count, cell) => count + (cell.features?.length || 0), 0);
  $("map-summary").textContent = `Size ${doc.grid.size} · ${doc.grid.cells.length.toLocaleString()} world hexes · ${features} features`;
  $("undo").disabled = !doc.undoStack.length; $("redo").disabled = !doc.redoStack.length;
  inspector(); applyZoom();
}
function scheduleRender() { if (!frame) frame = requestAnimationFrame(render); }
function editCell(id) {
  if (!doc.cell(id)) return;
  selected = id;
  if (tool === "paint") doc.paint(id, $("terrain").value);
  else if (tool === "add" || tool === "erase") doc.feature(id, $("feature").value, tool === "erase");
  scheduleRender();
}
$("viewport").addEventListener("pointerdown", run(event => {
  if (event.button !== 0) return;
  const cell = event.target.closest("polygon[data-cell]"); if (!cell) return;
  event.preventDefault(); drawing = true; doc.begin();
  $("viewport").setPointerCapture(event.pointerId); editCell(cell.dataset.cell);
}));
$("viewport").addEventListener("pointermove", run(event => {
  if (!drawing || tool === "inspect") return;
  const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest("polygon[data-cell]");
  if (cell) editCell(cell.dataset.cell);
}));
function finishStroke() { if (drawing) { drawing = false; doc.commit(); render(); } }
$("viewport").addEventListener("pointerup", finishStroke);
$("viewport").addEventListener("pointercancel", finishStroke);
$("viewport").addEventListener("lostpointercapture", finishStroke);
for (const button of document.querySelectorAll("[data-tool]")) button.onclick = () => setTool(button.dataset.tool);
$("terrain").onchange = () => { setTool("paint"); refreshSwatches(); };
$("feature").onchange = () => setTool("add");
$("selected-terrain-input").onchange = run(() => { if (selected) { doc.paint(selected, $("selected-terrain-input").value); doc.commit(); render(); } });
$("clear-features").onclick = run(() => { doc.clearFeatures(selected); doc.commit(); render(); });
$("world-name").onchange = run(() => { if (doc.grid) { doc.rename($("world-name").value); render(); } });
$("uwp").oninput = profileSummary;
function generate(blank = false) {
  parseUwp($("uwp").value);
  if (!allowReplace()) return;
  const result = generateT5World({ uwp: $("uwp").value, name: $("world-name").value, tradeCodes: $("trade-codes").value, habitableZone: $("climate").value === "hz", resourceCount: $("resources").value }, { blank });
  doc.load(serializeWorldMap(result.grid, result.worldName), { saved: false }); selected = null;
  updateFields(); render(); fit(); status(`${blank ? "Blank grid" : "World"} generated. Export JSON to save your map.`);
}
$("generate").onclick = run(() => generate()); $("start").onclick = run(() => generate()); $("blank").onclick = run(() => generate(true));
$("undo").onclick = () => { finishStroke(); doc.undo(); render(); status("Undo."); };
$("redo").onclick = () => { finishStroke(); doc.redo(); render(); status("Redo."); };
$("zoom-in").onclick = () => { zoom = Math.min(6, zoom * 1.2); applyZoom(); };
$("zoom-out").onclick = () => { zoom = Math.max(0.1, zoom / 1.2); applyZoom(); };
$("fit").onclick = fit;
$("open").onclick = run(async () => {
  finishStroke();
  const file = await window.desktop.openMap(); if (!file) return;
  const { data } = deserializeWorldMap(file.text);
  if (!allowReplace()) return;
  doc.load(data); selected = null; updateFields(); render(); fit();
  status(`Imported ${file.name}.${doc.grid.profile ? "" : " Original UWP was not included; enter one before regenerating."}`);
});
$("save").onclick = run(async () => {
  requireMap(); finishStroke();
  const clean = deserializeWorldMap(doc.data).data;
  const saved = await window.desktop.saveMap({ type: "json", name: `${doc.worldName}-world-map`, text: JSON.stringify(clean, null, 2) });
  if (saved) { doc.markSaved(); render(); status(`Saved ${saved}. Import with traveller-trading 1.24.0 or newer.`); }
});
$("svg-export").onclick = run(async () => {
  requireMap(); finishStroke();
  const saved = await window.desktop.saveMap({ type: "svg", name: `${doc.worldName}-world-map`, text: embedWorldMapData(renderWorldMapSvg(doc.grid, doc.worldName), doc.data) });
  if (saved) status(`Exported ${saved}. Export JSON as well to save your editable map.`);
});
document.addEventListener("keydown", event => {
  const input = /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName);
  if (event.ctrlKey || event.metaKey) {
    const key = event.key.toLowerCase();
    const actions = { s: "save", o: "open", z: event.shiftKey ? "redo" : "undo", y: "redo" };
    if (actions[key] && (!input || ["s", "o"].includes(key))) { event.preventDefault(); $(actions[key]).click(); }
  } else if (!input) {
    const value = { i: "inspect", p: "paint", f: "add", e: "erase" }[event.key.toLowerCase()];
    if (value) setTool(value);
  }
});
window.addEventListener("beforeunload", event => { if (doc.dirty) { event.preventDefault(); event.returnValue = ""; } });
profileSummary(); refreshSwatches();
