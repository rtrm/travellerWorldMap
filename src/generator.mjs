import { buildWorldGrid } from "./shared/world-map-grid.mjs";
import { TERRAIN_STYLES } from "./shared/world-map-terrain.mjs";

const EHEX = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function parseUwp(value) {
  const text = String(value || "").trim().toUpperCase();
  if (!/^[ABCDEX][0-9A-HJ-NP-Z]{6}-[0-9A-HJ-NP-Z]$/.test(text)) throw new Error("Enter a UWP such as A867A74-C (no I or O in extended hex).");
  const digit = index => EHEX.indexOf(text[index]);
  const result = { text, port: text[0], size: digit(1), atmosphere: digit(2), hydrographics: digit(3), population: digit(4), government: digit(5), law: digit(6), tech: digit(8) };
  if (result.atmosphere > 15 || result.hydrographics > 10) throw new Error("UWP atmosphere must be 0–F and hydrographics 0–A.");
  return result;
}

export function deriveTradeCodes(uwp) {
  const { atmosphere: a, hydrographics: h, population: p } = uwp;
  const codes = [];
  if (a === 0) codes.push("Va");
  if (a <= 1 && h > 0) codes.push("Ic");
  if (a >= 2 && h === 0) codes.push("De");
  if (p >= 1 && p <= 3) codes.push("Lo");
  if (p >= 4 && p <= 6) codes.push("Ni");
  if (p >= 9) codes.push("Hi");
  if (a >= 4 && a <= 9 && h >= 4 && h <= 8 && p >= 5 && p <= 7) codes.push("Ag");
  return codes;
}

// World-scale procedure adapted from Creating World Maps, chart 11, p49.
// Placement is deliberately flexible as the chart directs. No finer hex levels
// or hidden stellar/economic assumptions are introduced.
export function generateT5World({ uwp: input, name = "New world", tradeCodes = "", habitableZone = true, resourceCount = 0 }, { random = Math.random, blank = false } = {}) {
  const uwp = parseUwp(input);
  if (uwp.size === 0) throw new Error("Size 0 is a belt and has no single globe map.");
  resourceCount = Number(resourceCount);
  if (!Number.isInteger(resourceCount) || resourceCount < 0 || resourceCount > 20) throw new Error("Resource hex count must be 0–20 (one per triangle).");
  const enteredCodes = String(tradeCodes).trim().split(/[\s,]+/).filter(Boolean);
  if (enteredCodes.some(code => !/^[A-Za-z]{2}$/.test(code))) throw new Error("Trade codes must be two-letter codes separated by spaces.");
  const codes = new Set([...deriveTradeCodes(uwp), ...enteredCodes.map(c => c[0].toUpperCase() + c[1].toLowerCase())]);
  const grid = buildWorldGrid(uwp.size);
  grid.profile = { uwp: uwp.text, tradeCodes: [...codes], habitableZone: Boolean(habitableZone), resourceCount };
  grid.uwp = { atmosphere: uwp.atmosphere, hydrographics: uwp.hydrographics };
  if (blank) return { grid, worldName: name.trim() || "New world" };
  grid.terrainStyles = TERRAIN_STYLES;
  const byId = new Map(grid.cells.map(cell => [cell.id, cell]));
  const pick = list => list.length ? list[Math.floor(random() * list.length)] : null;
  const die = () => 1 + Math.floor(random() * 6);
  const shuffle = list => {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
    return copy;
  };
  const faceCells = grid.faces.map(face => face.fragments.map(f => byId.get(f.cellId)));
  const membership = new Map(grid.cells.map(cell => [cell.id, []]));
  faceCells.forEach((cells, index) => cells.forEach(cell => membership.get(cell.id).push(index)));
  for (const cell of grid.cells) { cell.terrain = "clear"; cell.surface = "land"; cell.features = []; }
  const feature = (cell, type) => { if (cell && !cell.features.includes(type)) cell.features.push(type); };
  const place = (cells, count, action, eligible = () => true) => shuffle(cells.filter(eligible)).slice(0, count).forEach(action);
  const isLand = cell => cell.surface === "land";
  const setWater = (cell, terrain = "ocean") => { cell.surface = "water"; cell.terrain = terrain; };
  // Steps 2–8: resources, terrain relief, die-back, vacuum and desert.
  for (const index of shuffle([...faceCells.keys()]).slice(0, resourceCount)) feature(pick(faceCells[index]), "resource");
  for (const cells of faceCells) place(cells, die(), cell => { cell.terrain = "mountains"; });
  for (const index of shuffle([...faceCells.keys()]).slice(0, uwp.size)) place(faceCells[index], die(), cell => { cell.terrain = "chasm"; }, cell => cell.terrain === "clear");
  for (const index of shuffle([...faceCells.keys()]).slice(0, uwp.size)) place(faceCells[index], 1, cell => { cell.terrain = "precipice"; }, cell => cell.terrain === "clear");
  if (codes.has("Di")) for (const cells of faceCells) place(cells, die(), cell => feature(cell, "ruins"));
  if (codes.has("Va")) for (const cells of faceCells) place(cells, die(), cell => feature(cell, "crater"));
  if (codes.has("De")) for (const cell of grid.cells) if (cell.terrain === "clear") cell.terrain = "desert";
  // Steps 9–11: Hyd×2 ocean triangles, seas and islands. Shared boundary
  // cells use a majority vote; ties use their first canonical face.
  const oceans = new Set(shuffle([...faceCells.keys()]).slice(0, uwp.hydrographics * 2));
  for (const cell of grid.cells) {
    const faces = membership.get(cell.id);
    const votes = faces.filter(index => oceans.has(index)).length;
    if (votes > faces.length / 2 || (votes === faces.length / 2 && oceans.has(faces[0]))) setWater(cell, cell.terrain === "mountains" ? "islands" : "ocean");
  }
  const continents = shuffle([...faceCells.keys()].filter(index => !oceans.has(index)));
  for (const index of continents.slice(0, uwp.hydrographics)) { const cell = pick(faceCells[index].filter(isLand)); if (cell) setWater(cell); }
  for (const cell of grid.cells) if (cell.terrain === "ocean" && [...cell.neighbors].some(id => isLand(byId.get(id)))) cell.terrain = "shore";
  // Steps 12–17: climate, ice and agriculture. HZ is explicit because UWP
  // alone cannot supply orbital temperature. All placement respects capacity.
  let iceRows = habitableZone && uwp.hydrographics >= 2 ? Math.floor(uwp.hydrographics / 2) : 0;
  if (codes.has("Ic")) iceRows += die();
  const cap = Math.min(0.49, iceRows / (3 * uwp.size));
  const tundra = codes.has("Tu") ? Math.min(0.49, die() / (3 * uwp.size)) : 0;
  for (const cell of grid.cells) {
    if (cap && (cell.latitude <= cap || cell.latitude >= 1 - cap)) cell.terrain = "ice";
    else if (codes.has("Fr") || (tundra && (cell.latitude <= tundra || cell.latitude >= 1 - tundra))) cell.terrain = isLand(cell) ? "frozen" : "iceField";
  }
  if (codes.has("Ag") || codes.has("Fa")) for (const index of continents) place(faceCells[index], codes.has("Ag") ? die() + die() : die(), cell => { cell.terrain = "cropland"; }, cell => isLand(cell) && !["ice", "frozen"].includes(cell.terrain));
  // Steps 18–23: settlements, rural surroundings and the UWP starport.
  const settlements = [];
  const land = grid.cells.filter(cell => isLand(cell) && cell.terrain !== "ice");
  const settlement = (cell, type) => { if (cell) { feature(cell, type); settlements.push(cell); } };
  if (uwp.population > 0) {
    if (codes.has("Lo") || codes.has("Ni")) settlement(pick(land) || pick(grid.cells.filter(cell => cell.terrain !== "ice")) || grid.cells[0], "town");
    else {
      const domed = uwp.atmosphere <= 1 || (uwp.atmosphere >= 10 && uwp.atmosphere <= 12) || uwp.atmosphere >= 14;
      for (const index of continents.slice(0, uwp.population)) settlement(pick(faceCells[index].filter(cell => land.includes(cell))), domed ? "dome" : "city");
      // Water worlds can support floating/domed settlements when no dry
      // continent exists; this is an explicit placement fallback.
      if (!settlements.length) settlement(pick(grid.cells.filter(cell => cell.terrain !== "ice")) || grid.cells[0], domed ? "dome" : "city");
      if (codes.has("Hi")) place(land.length ? land : grid.cells, Math.floor(uwp.population / 2), cell => feature(cell, "arcology"));
    }
    const visited = new Set(), queue = settlements.filter(cell => cell.features.some(f => ["city", "dome"].includes(f))).map(cell => [cell, 0]);
    for (let i = 0; i < queue.length; i++) {
      const [cell, distance] = queue[i];
      if (visited.has(cell.id)) continue;
      visited.add(cell.id);
      if (cell.terrain === "clear") cell.terrain = "rural";
      if (distance < uwp.population) for (const id of cell.neighbors) if (!visited.has(id)) queue.push([byId.get(id), distance + 1]);
    }
  }
  if (uwp.port !== "X") feature(settlements[0] || pick(land) || pick(grid.cells), "starport");
  // Steps 24–30: twilight worlds and the remaining overview features.
  if (codes.has("Tz")) {
    const positions = new Map();
    for (const face of grid.faces) for (const f of face.fragments) if (!positions.has(f.cellId)) positions.set(f.cellId, ((f.x % grid.width) + grid.width) % grid.width);
    for (const cell of grid.cells) {
      const x = positions.get(cell.id);
      if (Math.min(x, grid.width - x, Math.abs(x - grid.width / 2)) <= grid.spacing / 2) { cell.terrain = "twilight"; cell.surface = "land"; }
      else if (x < grid.width / 2) { cell.terrain = isLand(cell) ? "baked" : "desert"; cell.surface = "land"; }
      else cell.terrain = isLand(cell) ? "frozen" : "iceField";
    }
  }
  if (codes.has("Pe")) place(land, uwp.population, cell => feature(cell, "penal"));
  if (uwp.tech > 5) place(pick(faceCells) || [], die(), cell => { cell.terrain = "wasteland"; }, cell => isLand(cell) && !["ice", "frozen"].includes(cell.terrain));
  place(land, 1, cell => { cell.terrain = "exotic"; }, cell => !["ice", "frozen"].includes(cell.terrain));
  if (uwp.population > 0) feature(pick(land), "estate");
  return { grid, worldName: name.trim() || "New world" };
}
