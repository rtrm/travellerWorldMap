import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = fileURLToPath(new URL("../", import.meta.url)).replace(/[\\/]$/, "");
const output = fileURLToPath(new URL("../tmp/desktop-smoke/", import.meta.url));
await mkdir(output, { recursive: true });
const electronEnv = { ...process.env, TWM_TEST_MODE: "1" };
delete electronEnv.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ timeout: 30000, executablePath: process.env.TWM_EXECUTABLE || fileURLToPath(new URL("../node_modules/electron/dist/electron.exe", import.meta.url)),
  args: process.env.TWM_EXECUTABLE ? [] : [root], env: electronEnv });
try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  console.log("Desktop launched.");
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", dialog => dialog.accept());
  await page.waitForSelector("#generate");
  await app.evaluate(({ dialog }, output) => {
    dialog.showSaveDialog = async (window, options) => ({ canceled: false, filePath: `${output}/edited.${options.filters[0].extensions[0]}` });
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [`${output}/edited.json`] });
  }, output);
  await page.fill("#world-name", "Smoke Test World");
  await page.click("#generate");
  await page.waitForSelector("#map svg");
  assert.ok((await page.locator("#map-summary").textContent()).includes("642"));
  await page.selectOption("#terrain", "lake");
  const polygon = page.locator('#map polygon[data-cell^="middleUp"]').first();
  await polygon.click();
  await page.waitForFunction(() => document.querySelector("#selected-terrain").textContent === "Lake");
  await page.click('#feature-picker button[data-feature="dome"]');
  await page.click('#feature-picker button[data-feature="arcology"]');
  assert.ok((await page.locator("#feature-list").textContent()).includes("Domed city"));
  await page.click("#save");
  await page.waitForFunction(() => document.querySelector("#dirty").textContent === "SAVED");
  const data = JSON.parse(await readFile(`${output}/edited.json`, "utf8"));
  console.log("Edited map saved through native IPC.");
  assert.equal(data.version, 2);
  const edited = data.cells.find(c => c.terrain === "lake" && c.features.includes("dome") && c.features.includes("arcology"));
  assert.ok(edited);
  await page.click("#clear-features");
  assert.ok((await page.locator("#feature-list").textContent()).includes("No features"));
  await page.click("#undo");
  assert.ok((await page.locator("#feature-list").textContent()).includes("Domed city"));
  await page.click("#open");
  await page.waitForFunction(() => document.querySelector("#status").textContent.startsWith("Imported"));
  assert.ok(await page.locator('#map [data-feature="dome"]').count() > 0);
  await page.click("#svg-export");
  await page.waitForFunction(() => document.querySelector("#status").textContent.startsWith("Exported"));
  assert.ok((await readFile(`${output}/edited.svg`, "utf8")).includes('id="tt-world-map-data"'));
  // Use the actual Foundry importer on the desktop-exported document when the
  // companion repository is available in the development workspace.
  const { deserializeWorldMap } = await import("../../traveller-trading/scripts/world-map-data.mjs");
  const restored = deserializeWorldMap(data);
  assert.deepEqual(restored.data.cells, data.cells);
  await page.click('[data-tool="inspect"]');
  await page.locator('#map polygon[data-cell^="middleUp"]').first().click();
  await page.waitForFunction(() => document.querySelector("#selection").hidden === false);
  // Hidden packaged windows may not produce compositor frames on Windows.
  // Source-mode screenshots are for visual QA; all functional checks above
  // run in both modes without requiring a visible test window.
  if (!process.env.TWM_EXECUTABLE) await page.screenshot({ path: `${output}/editor.png`, timeout: 10000 });
  assert.deepEqual(errors, []);
  console.log("Desktop smoke passed: native IPC JSON save/open, terrain editing, dome/arcology placement, removal, undo, SVG export and traveller-trading compatibility.");
} finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); }
