import { serializeWorldMap, deserializeWorldMap } from "./shared/world-map-data.mjs";
import { TERRAIN_STYLES } from "./shared/world-map-terrain.mjs";
import { MAP_FEATURES } from "./shared/world-map-features.mjs";

const WATER = new Set(["ocean", "lake", "river", "shore", "islands", "iceField"]);
export class MapDocument {
  constructor() { this.grid = null; this.worldName = ""; this.undoStack = []; this.redoStack = []; this.saved = null; this.pending = null; }
  load(input, { saved = true } = {}) {
    const { grid, data } = deserializeWorldMap(input);
    this.grid = grid; this.worldName = data.worldName;
    this.undoStack = []; this.redoStack = []; this.pending = null;
    this.saved = saved ? JSON.stringify(data) : null;
  }
  get data() { return this.grid ? serializeWorldMap(this.grid, this.worldName) : null; }
  get dirty() { return this.grid && JSON.stringify(this.data) !== this.saved; }
  markSaved() { this.saved = JSON.stringify(this.data); }
  begin() { if (this.grid && !this.pending) this.pending = JSON.stringify(this.data); }
  commit() {
    if (!this.pending) return false;
    const before = this.pending, after = JSON.stringify(this.data); this.pending = null;
    if (before === after) return false;
    this.undoStack.push({ before, after });
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.redoStack = []; return true;
  }
  restore(json) { const { grid, data } = deserializeWorldMap(json); this.grid = grid; this.worldName = data.worldName; }
  undo() { this.commit(); const command = this.undoStack.pop(); if (command) { this.restore(command.before); this.redoStack.push(command); } }
  redo() { const command = this.redoStack.pop(); if (command) { this.restore(command.after); this.undoStack.push(command); } }
  cell(id) { return this.grid?.cells.find(cell => cell.id === id); }
  paint(id, terrain) {
    if (!Object.hasOwn(TERRAIN_STYLES, terrain)) throw new Error("Unknown terrain type.");
    const cell = this.cell(id); if (!cell) return;
    this.begin();
    if (!this.grid.terrainStyles) {
      this.grid.terrainStyles = TERRAIN_STYLES;
      for (const other of this.grid.cells) { other.terrain = "clear"; other.surface = "land"; }
    }
    cell.terrain = terrain;
    cell.surface = terrain === "ice" ? cell.surface ?? "land" : WATER.has(terrain) ? "water" : "land";
  }
  feature(id, key, remove = false) {
    if (!Object.hasOwn(MAP_FEATURES, key)) throw new Error("Unknown map feature.");
    const cell = this.cell(id); if (!cell) return;
    this.begin(); cell.features ||= [];
    if (remove) cell.features = cell.features.filter(type => type !== key);
    else if (!cell.features.includes(key)) cell.features.push(key);
  }
  clearFeatures(id) { const cell = this.cell(id); if (cell) { this.begin(); cell.features = []; } }
  rename(name) { if (this.grid) { this.begin(); this.worldName = String(name).trim().slice(0, 1000) || "Unnamed world"; this.commit(); } }
}
