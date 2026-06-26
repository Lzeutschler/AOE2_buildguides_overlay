const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, Menu, Tray, nativeImage, globalShortcut, ipcMain, screen, desktopCapturer, dialog } = require('electron');
const tesseract = require('tesseract.js');
const baseBuildData = require('../data/build-orders.json');
const heraBuildData = require('../data/hera-build-orders.json');
const civData = require('../data/civilizations.json');
const { Detector } = require('./detector');
const { findBuild, getBuildProgress, getRecommendedBuilds } = require('./build-engine');
const { loadSettings, saveSettings } = require('./settings-store');

const defaultBuildData = combineBuildData(baseBuildData, heraBuildData);

let dashboardWindow;
let overlayWindow;
let detector;
let tray;
let isQuitting = false;
let shortcutsSyncedFor = null;
let customBuildData = { civRecommendations: {}, builds: [] };
let buildData = defaultBuildData;

const appState = {
  aoeRunning: false,
  civ: 'Generic',
  villagerCount: 6,
  selectedBuildId: 'generic-scouts',
  detectionMode: 'manual',
  overlayEnabled: true,
  overlayClickThrough: true,
  overlayOnlyWhenAoe: true,
  overlayPosition: null,
  autoShowDashboardOnAoe: true,
  hotkeysEnabled: true,
  launchAtLogin: false,
  selectedDisplayId: null,
  ocr: {
    enabled: false,
    status: 'idle',
    lastText: '',
    lastError: '',
    intervalMs: 1800,
    minConfidence: 45,
    stableReadCount: 2,
    imageScale: 3,
    villagerRegion: { x: 0.39, y: 0.014, width: 0.06, height: 0.035 },
    civRegion: { x: 0.78, y: 0.04, width: 0.16, height: 0.06 }
  }
};

const persistedKeys = [
  'civ',
  'villagerCount',
  'selectedBuildId',
  'detectionMode',
  'overlayEnabled',
  'overlayClickThrough',
  'overlayOnlyWhenAoe',
  'overlayPosition',
  'autoShowDashboardOnAoe',
  'hotkeysEnabled',
  'launchAtLogin',
  'selectedDisplayId',
  'ocr'
];

function createDashboardWindow() {
  const targetDisplay = getCompanionDisplay();
  dashboardWindow = new BrowserWindow({
    x: targetDisplay.bounds.x + 40,
    y: targetDisplay.bounds.y + 40,
    width: Math.min(1180, targetDisplay.workAreaSize.width),
    height: Math.min(820, targetDisplay.workAreaSize.height),
    minWidth: 920,
    minHeight: 620,
    title: 'AOE2 Build Overlay',
    backgroundColor: '#f7f4ed',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  dashboardWindow.loadFile(path.join(__dirname, '../renderer/dashboard.html'));
  dashboardWindow.on('close', (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    dashboardWindow.hide();
  });
}

function createOverlayWindow() {
  const width = 560;
  const height = 118;
  const position = normalizeOverlayPosition(appState.overlayPosition, width, height);
  appState.overlayPosition = position;
  overlayWindow = new BrowserWindow({
    x: position.x,
    y: position.y,
    width,
    height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    title: 'AOE2 Next Step',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.loadFile(path.join(__dirname, '../renderer/overlay.html'));
}

function getCompanionDisplay() {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  return displays.find((display) => display.id !== primary.id) || primary;
}

function getPublicState() {
  const build = findBuild(buildData.builds, appState.selectedBuildId);
  const progress = getBuildProgress(build, appState.villagerCount);
  const recommendedBuilds = getRecommendedBuilds(buildData, appState.civ);
  const displays = screen.getAllDisplays().map((display) => ({
    id: display.id,
    label: display.label || `Display ${display.id}`,
    bounds: display.bounds,
    primary: display.id === screen.getPrimaryDisplay().id
  }));

  return {
    ...appState,
    build,
    progress,
    recommendedBuilds,
    buildData,
    customBuildCount: customBuildData.builds.length,
    displays,
    civs: getCivs()
  };
}

function getCivs() {
  const names = new Set(['Generic']);
  civData.civilizations.forEach((civ) => names.add(civ.name));
  Object.keys(buildData.civRecommendations).forEach((name) => names.add(name));
  buildData.builds.forEach((build) => {
    build.civs.forEach((name) => names.add(name));
  });
  return [...names].sort((a, b) => a.localeCompare(b));
}

function updateState(partial, options = {}) {
  const { ocr, overlayPosition, ...rest } = partial;
  Object.assign(appState, rest);

  if (ocr) {
    appState.ocr = {
      ...appState.ocr,
      ...ocr,
      intervalMs: clampNumber(ocr.intervalMs, appState.ocr.intervalMs, 500, 10000),
      minConfidence: clampNumber(ocr.minConfidence, appState.ocr.minConfidence, 0, 100),
      stableReadCount: clampNumber(ocr.stableReadCount, appState.ocr.stableReadCount, 1, 5),
      imageScale: clampNumber(ocr.imageScale, appState.ocr.imageScale, 1, 6),
      villagerRegion: normalizeRegion(ocr.villagerRegion, appState.ocr.villagerRegion),
      civRegion: normalizeRegion(ocr.civRegion, appState.ocr.civRegion)
    };
  }

  if (overlayPosition) {
    appState.overlayPosition = normalizeOverlayPosition(overlayPosition);
  }

  const recommendedBuilds = getRecommendedBuilds(buildData, appState.civ);
  const hasSelected = recommendedBuilds.some((build) => build.id === appState.selectedBuildId);
  if (!hasSelected && recommendedBuilds[0]) {
    appState.selectedBuildId = recommendedBuilds[0].id;
  }

  if (detector) {
    syncDetectorSettings();
  }

  syncLaunchAtLogin();
  syncGlobalShortcuts();
  applyOverlayPosition();
  applyOverlayWindowState();
  updateTrayMenu();
  if (options.persist !== false) {
    persistState();
  }
  broadcastState();
}

function persistState() {
  const settings = {};
  for (const key of persistedKeys) {
    settings[key] = appState[key];
  }

  saveSettings(app.getPath('userData'), settings);
}

function applyOverlayWindowState() {
  if (!overlayWindow) {
    return;
  }

  overlayWindow.setIgnoreMouseEvents(appState.overlayClickThrough, { forward: true });

  if (shouldShowOverlay()) {
    overlayWindow.showInactive();
  } else {
    overlayWindow.hide();
  }
}

function applyOverlayPosition() {
  if (!overlayWindow || !appState.overlayPosition) {
    return;
  }

  overlayWindow.setPosition(Math.round(appState.overlayPosition.x), Math.round(appState.overlayPosition.y), false);
}

function shouldShowOverlay() {
  return appState.overlayEnabled && (!appState.overlayOnlyWhenAoe || appState.aoeRunning);
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('AOE2 Build Overlay');
  tray.on('double-click', () => {
    showDashboard();
  });
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) {
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show dashboard',
      click: () => showDashboard()
    },
    {
      label: appState.overlayEnabled ? 'Hide overlay' : 'Show overlay',
      click: () => updateState({ overlayEnabled: !appState.overlayEnabled })
    },
    {
      label: appState.overlayOnlyWhenAoe ? 'Overlay only while AOE2: on' : 'Overlay only while AOE2: off',
      click: () => updateState({ overlayOnlyWhenAoe: !appState.overlayOnlyWhenAoe })
    },
    {
      label: appState.overlayClickThrough ? 'Disable click-through' : 'Enable click-through',
      click: () => updateState({ overlayClickThrough: !appState.overlayClickThrough })
    },
    {
      label: 'Reset overlay position',
      click: () => resetOverlayPosition()
    },
    {
      label: appState.hotkeysEnabled ? 'Disable hotkeys' : 'Enable hotkeys',
      click: () => updateState({ hotkeysEnabled: !appState.hotkeysEnabled })
    },
    {
      label: appState.launchAtLogin ? 'Start with Windows: on' : 'Start with Windows: off',
      click: () => updateState({ launchAtLogin: !appState.launchAtLogin })
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function showDashboard() {
  if (!dashboardWindow || dashboardWindow.isDestroyed()) {
    createDashboardWindow();
  }

  moveDashboardToCompanionDisplay();
  dashboardWindow.show();
  dashboardWindow.focus();
}

function moveDashboardToCompanionDisplay() {
  if (!dashboardWindow || dashboardWindow.isDestroyed()) {
    return;
  }

  const targetDisplay = getCompanionDisplay();
  const bounds = targetDisplay.workArea;
  const [width, height] = dashboardWindow.getSize();
  const x = bounds.x + Math.max(0, Math.round((bounds.width - width) / 2));
  const y = bounds.y + Math.max(0, Math.round((bounds.height - height) / 2));
  dashboardWindow.setPosition(x, y, false);
}

function createTrayIcon() {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">',
    '<rect width="32" height="32" rx="6" fill="#1f5f55"/>',
    '<path d="M7 21h18v4H7zM9 18l3-10 4 7 4-7 3 10z" fill="#f0c05a"/>',
    '</svg>'
  ].join('');

  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
}

function broadcastState() {
  const publicState = getPublicState();
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('state:update', publicState);
  }
}

function registerIpc() {
  ipcMain.handle('state:get', () => getPublicState());

  ipcMain.handle('builds:import', async () => importBuilds());

  ipcMain.handle('builds:export', async () => exportBuilds());

  ipcMain.handle('ocr:preview', async () => {
    if (!detector) {
      return null;
    }

    return detector.capturePreview();
  });

  ipcMain.handle('ocr:test', async () => {
    if (!detector) {
      return null;
    }

    return detector.testOcr();
  });

  ipcMain.on('state:update', (_event, partial) => {
    updateState(partial);
  });

  ipcMain.on('villager:adjust', (_event, delta) => {
    adjustVillagerCount(delta);
  });

  ipcMain.on('overlay:move', (_event, position) => {
    if (position?.reset) {
      resetOverlayPosition();
      return;
    }

    if (Number.isFinite(position?.dx) || Number.isFinite(position?.dy)) {
      nudgeOverlay(Number(position.dx || 0), Number(position.dy || 0));
      return;
    }

    if (Number.isFinite(position?.x) && Number.isFinite(position?.y)) {
      updateState({ overlayPosition: position });
    }
  });
}

function syncGlobalShortcuts() {
  if (shortcutsSyncedFor === appState.hotkeysEnabled) {
    return;
  }

  globalShortcut.unregisterAll();
  shortcutsSyncedFor = appState.hotkeysEnabled;

  if (!appState.hotkeysEnabled) {
    return;
  }

  registerGlobalShortcut('Control+Shift+Up', () => adjustVillagerCount(1));
  registerGlobalShortcut('Control+Shift+Down', () => adjustVillagerCount(-1));
  registerGlobalShortcut('Control+Shift+O', () => updateState({ overlayEnabled: !appState.overlayEnabled }));
  registerGlobalShortcut('Control+Shift+D', () => showDashboard());
  registerGlobalShortcut('Control+Alt+Left', () => nudgeOverlay(-16, 0));
  registerGlobalShortcut('Control+Alt+Right', () => nudgeOverlay(16, 0));
  registerGlobalShortcut('Control+Alt+Up', () => nudgeOverlay(0, -16));
  registerGlobalShortcut('Control+Alt+Down', () => nudgeOverlay(0, 16));
}

function registerGlobalShortcut(accelerator, callback) {
  const registered = globalShortcut.register(accelerator, callback);
  if (!registered) {
    console.warn(`Could not register global shortcut: ${accelerator}`);
  }
}

function adjustVillagerCount(delta) {
  const villagerCount = Math.max(1, Math.min(250, appState.villagerCount + Number(delta)));
  updateState({ villagerCount });
}

function nudgeOverlay(dx, dy) {
  const current = appState.overlayPosition || normalizeOverlayPosition(null);
  updateState({
    overlayPosition: {
      x: current.x + dx,
      y: current.y + dy
    }
  });
}

function resetOverlayPosition() {
  updateState({
    overlayPosition: getDefaultOverlayPosition()
  });
}

app.whenReady().then(() => {
  updateStateFromSettings(loadSettings(app.getPath('userData')));
  loadCustomBuildData();
  registerIpc();
  syncLaunchAtLogin();
  createTray();
  syncGlobalShortcuts();
  createDashboardWindow();
  createOverlayWindow();
  applyOverlayWindowState();

  detector = new Detector({ desktopCapturer, screen, tesseract, civs: civData.civilizations });
  syncDetectorSettings();
  detector.on('state', (detectorState) => {
    const wasAoeRunning = appState.aoeRunning;
    const detectorUpdate = {
      aoeRunning: detectorState.aoeRunning,
      ocr: detectorState.ocr
    };

    if (appState.detectionMode === 'ocr' && Number.isFinite(detectorState.villagerCount)) {
      detectorUpdate.villagerCount = detectorState.villagerCount;
    }

    if (appState.detectionMode === 'ocr' && detectorState.civ) {
      detectorUpdate.civ = detectorState.civ;
    }

    updateState(detectorUpdate, { persist: false });
    handleAoeRunningChange(wasAoeRunning, appState.aoeRunning);
  });
  detector.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createDashboardWindow();
      createOverlayWindow();
    }
  });
});

function loadCustomBuildData() {
  const filePath = getCustomBuildsPath();
  try {
    customBuildData = normalizeBuildData(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch {
    customBuildData = { civRecommendations: {}, builds: [] };
  }

  rebuildBuildData();
}

function saveCustomBuildData() {
  const filePath = getCustomBuildsPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(customBuildData, null, 2));
}

function getCustomBuildsPath() {
  return path.join(app.getPath('userData'), 'custom-build-orders.json');
}

function rebuildBuildData() {
  const buildMap = new Map();
  for (const build of defaultBuildData.builds) {
    buildMap.set(build.id, build);
  }
  for (const build of customBuildData.builds) {
    buildMap.set(build.id, { ...build, custom: true });
  }

  buildData = {
    civRecommendations: mergeRecommendations(defaultBuildData.civRecommendations, customBuildData.civRecommendations),
    builds: [...buildMap.values()]
  };
}

function combineBuildData(...dataFiles) {
  const combined = {
    civRecommendations: {},
    builds: []
  };

  for (const data of dataFiles) {
    combined.builds.push(...(data.builds || []));
    combined.civRecommendations = mergeRecommendations(combined.civRecommendations, data.civRecommendations || {});
  }

  return combined;
}

function mergeRecommendations(defaultRecommendations, customRecommendations) {
  const merged = {};
  const civs = new Set([...Object.keys(defaultRecommendations || {}), ...Object.keys(customRecommendations || {})]);

  for (const civ of civs) {
    const ids = [...(customRecommendations?.[civ] || []), ...(defaultRecommendations?.[civ] || [])];
    merged[civ] = [...new Set(ids)];
  }

  return merged;
}

async function importBuilds() {
  try {
    const result = await dialog.showOpenDialog(dashboardWindow, {
      title: 'Import build orders',
      properties: ['openFile'],
      filters: [{ name: 'Build order JSON', extensions: ['json'] }]
    });

    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true };
    }

    const imported = normalizeBuildData(JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8')));
    customBuildData = normalizeBuildData({
      civRecommendations: mergeRecommendations(customBuildData.civRecommendations, imported.civRecommendations),
      builds: mergeBuilds(customBuildData.builds, imported.builds)
    });
    saveCustomBuildData();
    rebuildBuildData();
    updateState({}, { persist: false });

    return {
      canceled: false,
      importedBuilds: imported.builds.length,
      totalCustomBuilds: customBuildData.builds.length
    };
  } catch (error) {
    return {
      canceled: false,
      error: error.message
    };
  }
}

async function exportBuilds() {
  const result = await dialog.showSaveDialog(dashboardWindow, {
    title: 'Export custom build orders',
    defaultPath: 'aoe2-custom-build-orders.json',
    filters: [{ name: 'Build order JSON', extensions: ['json'] }]
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  fs.writeFileSync(result.filePath, JSON.stringify(customBuildData, null, 2));
  return {
    canceled: false,
    filePath: result.filePath,
    exportedBuilds: customBuildData.builds.length
  };
}

function mergeBuilds(existingBuilds, importedBuilds) {
  const buildMap = new Map();
  for (const build of existingBuilds || []) {
    buildMap.set(build.id, build);
  }
  for (const build of importedBuilds || []) {
    buildMap.set(build.id, build);
  }

  return [...buildMap.values()];
}

function normalizeBuildData(data) {
  const builds = Array.isArray(data?.builds)
    ? data.builds.map(normalizeBuild).filter(Boolean)
    : [];
  const buildIds = new Set(builds.map((build) => build.id));
  const civRecommendations = {};

  for (const [civ, ids] of Object.entries(data?.civRecommendations || {})) {
    if (Array.isArray(ids)) {
      civRecommendations[civ] = [...new Set(ids.filter((id) => buildIds.has(id)))];
    }
  }

  return { civRecommendations, builds };
}

function normalizeBuild(build) {
  const id = String(build?.id || '').trim();
  const name = String(build?.name || '').trim();
  const steps = Array.isArray(build?.steps)
    ? build.steps.map(normalizeBuildStep).filter(Boolean).sort((a, b) => a.villagers - b.villagers)
    : [];

  if (!id || !name || steps.length === 0) {
    return null;
  }

  return {
    id,
    name,
    style: String(build.style || 'Custom').trim() || 'Custom',
    summary: String(build.summary || '').trim(),
    civs: Array.isArray(build.civs) ? build.civs.map((civ) => String(civ).trim()).filter(Boolean) : ['Generic'],
    steps
  };
}

function normalizeBuildStep(step) {
  const villagers = Number(step?.villagers);
  const title = String(step?.title || '').trim();
  const instruction = String(step?.instruction || '').trim();

  if (!Number.isFinite(villagers) || villagers < 1 || !title || !instruction) {
    return null;
  }

  return {
    villagers,
    title,
    instruction
  };
}

function handleAoeRunningChange(wasRunning, isRunning) {
  if (wasRunning === isRunning) {
    return;
  }

  if (isRunning && appState.autoShowDashboardOnAoe) {
    showDashboard();
  }
}

function syncDetectorSettings() {
  if (!detector) {
    return;
  }

  detector.updateSettings({
    detectionMode: appState.detectionMode,
    selectedDisplayId: appState.selectedDisplayId,
    villagerCount: appState.villagerCount,
    ocr: appState.ocr
  });
}

function syncLaunchAtLogin() {
  if (process.platform !== 'win32') {
    return;
  }

  app.setLoginItemSettings({
    openAtLogin: Boolean(appState.launchAtLogin),
    path: process.execPath
  });
}

function updateStateFromSettings(settings) {
  const allowed = {};
  for (const key of persistedKeys) {
    if (Object.prototype.hasOwnProperty.call(settings, key)) {
      allowed[key] = settings[key];
    }
  }

  Object.assign(appState, allowed);

  if (settings.ocr) {
    appState.ocr = {
      ...appState.ocr,
      ...settings.ocr,
      intervalMs: clampNumber(settings.ocr.intervalMs, appState.ocr.intervalMs, 500, 10000),
      minConfidence: clampNumber(settings.ocr.minConfidence, appState.ocr.minConfidence, 0, 100),
      stableReadCount: clampNumber(settings.ocr.stableReadCount, appState.ocr.stableReadCount, 1, 5),
      imageScale: clampNumber(settings.ocr.imageScale, appState.ocr.imageScale, 1, 6),
      villagerRegion: normalizeRegion(settings.ocr.villagerRegion, appState.ocr.villagerRegion),
      civRegion: normalizeRegion(settings.ocr.civRegion, appState.ocr.civRegion)
    };
  }

  if (settings.overlayPosition) {
    appState.overlayPosition = normalizeOverlayPosition(settings.overlayPosition);
  }
}

function getDefaultOverlayPosition(width = 560, height = 118) {
  const targetDisplay = screen.getPrimaryDisplay();
  return {
    x: targetDisplay.bounds.x + Math.round((targetDisplay.bounds.width - width) / 2),
    y: targetDisplay.bounds.y + 24
  };
}

function normalizeOverlayPosition(position, width = 560, height = 118) {
  const fallback = getDefaultOverlayPosition(width, height);
  const source = position || fallback;
  const x = Number.isFinite(source.x) ? Math.round(source.x) : fallback.x;
  const y = Number.isFinite(source.y) ? Math.round(source.y) : fallback.y;
  const targetDisplay = screen.getDisplayNearestPoint({ x, y });
  const bounds = targetDisplay.workArea;

  return {
    x: clampNumber(x, fallback.x, bounds.x, bounds.x + Math.max(0, bounds.width - width)),
    y: clampNumber(y, fallback.y, bounds.y, bounds.y + Math.max(0, bounds.height - height))
  };
}

function normalizeRegion(region, fallback) {
  const source = region || fallback;
  return {
    x: clampPercent(source.x, fallback.x),
    y: clampPercent(source.y, fallback.y),
    width: clampPercent(source.width, fallback.width),
    height: clampPercent(source.height, fallback.height)
  };
}

function clampPercent(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, number));
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, number));
}

app.on('window-all-closed', () => {
  if (detector) {
    detector.stop();
  }

  if (isQuitting && process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
});
