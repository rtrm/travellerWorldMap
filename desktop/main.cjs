const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
let window;
const entry = path.join(__dirname, "..", "index.html");
const MAX_BYTES = 5 * 1024 * 1024;
function trusted(event) {
  if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== pathToFileURL(entry).href) throw new Error("Invalid application request.");
}
ipcMain.handle("map:open", async event => {
  trusted(event);
  const result = await dialog.showOpenDialog(window, { title: "Import Traveller map JSON", properties: ["openFile"], filters: [{ name: "Traveller map data", extensions: ["json"] }] });
  if (result.canceled) return null;
  const file = result.filePaths[0];
  if ((await fs.stat(file)).size > MAX_BYTES) throw new Error("Map exceeds the 5 MB limit.");
  return { text: await fs.readFile(file, "utf8"), name: path.basename(file) };
});
ipcMain.handle("map:save", async (event, request) => {
  trusted(event);
  if (!request || typeof request.text !== "string" || !["json", "svg"].includes(request.type) || Buffer.byteLength(request.text) > (request.type === "json" ? MAX_BYTES : 30 * 1024 * 1024)) throw new Error("Invalid export data.");
  const filename = String(request.name || "world-map").replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").slice(0, 100);
  const result = await dialog.showSaveDialog(window, { title: request.type === "json" ? "Export Traveller map JSON" : "Export map SVG", defaultPath: `${filename}.${request.type}`, filters: [{ name: request.type === "json" ? "Traveller map data" : "SVG image", extensions: [request.type] }] });
  if (result.canceled) return null;
  // The OS save dialog supplies overwrite confirmation for an existing file.
  const temporary = `${result.filePath}.${require("node:crypto").randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, request.text, { encoding: "utf8", flag: "wx" });
    await fs.rename(temporary, result.filePath);
  } catch (error) {
    await fs.unlink(temporary).catch(() => {});
    throw error;
  }
  return path.basename(result.filePath);
});
function createWindow() {
  window = new BrowserWindow({ width: 1480, height: 960, minWidth: 1100, minHeight: 700, title: "Traveller World Map", icon: path.join(__dirname, "..", "build", "icon.png"), backgroundColor: "#111d2b", show: false,
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.removeMenu();
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", event => event.preventDefault());
  window.webContents.on("will-prevent-unload", event => {
    const choice = dialog.showMessageBoxSync(window, { type: "question", buttons: ["Keep editing", "Discard unsaved changes"], defaultId: 0, cancelId: 0, title: "Unsaved map", message: "This map has unsaved changes.", detail: "Export the map JSON to keep your edits." });
    if (choice === 1) event.preventDefault();
  });
  window.once("ready-to-show", () => { if (!process.env.TWM_TEST_MODE) window.show(); });
  window.loadFile(entry);
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
