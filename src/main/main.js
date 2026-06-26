const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, Menu, Tray, nativeImage, globalShortcut, ipcMain, screen, desktopCapturer, dialog } = require('electron');
const baseBuildData = require('../data/build-orders.json');
const heraBuildData = require('../data/hera-build-orders.json');
const civData = require('../data/civilizations.json');
const { Detector } = require('./detector');
const { findBuild, getBuildProgress, getRecommendedBuilds } = require('./build-engine');
const { loadSettings, saveSettings } = require('./settings-store');
const { DEFAULT_OCR_SETTINGS, migrateLegacyOcrRegions } = require('./ocr-defaults');

const defaultBuildData = combineBuildData(baseBuildData, heraBuildData);
const OVERLAY_WIDTH = 430;
const OVERLAY_HEIGHT = 318;

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
  inMatch: false,
  sessionStatus: 'Warte auf AOE2.',
  captureProvider: 'unavailable',
  captureStats: {
    provider: 'unavailable',
    samples: 0,
    lastCaptureMs: null,
    averageCaptureMs: null,
    maxCaptureMs: null
  },
  civ: 'Generic',
  villagerCount: 6,
  resourceVillagers: { food: null, wood: null, gold: null, stone: null },
  selectedBuildId: 'generic-scouts',
  detectionMode: 'ocr',
  overlayEnabled: true,
  overlayClickThrough: true,
  overlayOnlyWhenAoe: true,
  overlayPosition: null,
  autoShowDashboardOnAoe: true,
  hotkeysEnabled: true,
  launchAtLogin: false,
  selectedDisplayId: null,
  ocr: { ...DEFAULT_OCR_SETTINGS }
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
    title: 'Knappe der Rauen Schlacht',
    backgroundColor: '#20140d',
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
  const width = OVERLAY_WIDTH;
  const height = OVERLAY_HEIGHT;
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
    title: 'KDRS Naechste Schritte',
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
  const shouldSyncLaunchAtLogin = Object.prototype.hasOwnProperty.call(rest, 'launchAtLogin');
  const shouldUpdateTray = [
    'overlayEnabled',
    'overlayOnlyWhenAoe',
    'overlayClickThrough',
    'hotkeysEnabled',
    'launchAtLogin'
  ].some((key) => Object.prototype.hasOwnProperty.call(rest, key)) || Boolean(overlayPosition);
  if (Object.prototype.hasOwnProperty.call(rest, 'detectionMode') && rest.detectionMode !== 'ocr') {
    rest.detectionMode = 'ocr';
  }
  Object.assign(appState, rest);

  if (ocr) {
    appState.ocr = {
      ...appState.ocr,
      ...ocr,
      intervalMs: clampNumber(ocr.intervalMs, appState.ocr.intervalMs, 5000, 20000),
      civIntervalMs: clampNumber(ocr.civIntervalMs, appState.ocr.civIntervalMs, 15000, 300000),
      captureProvider: ['auto', 'node-screenshots'].includes(ocr.captureProvider)
        ? ocr.captureProvider
        : appState.ocr.captureProvider,
      captureIntervalMs: clampNumber(ocr.captureIntervalMs, appState.ocr.captureIntervalMs, 1000, 10000),
      startupProbeIntervalMs: clampNumber(ocr.startupProbeIntervalMs, appState.ocr.startupProbeIntervalMs, 500, 10000),
      civReadOnce: ocr.civReadOnce === undefined ? appState.ocr.civReadOnce : Boolean(ocr.civReadOnce),
      minConfidence: clampNumber(ocr.minConfidence, appState.ocr.minConfidence, 0, 100),
      stableReadCount: clampNumber(ocr.stableReadCount, appState.ocr.stableReadCount, 1, 5),
      imageScale: clampNumber(ocr.imageScale, appState.ocr.imageScale, 1, 6),
      topBarRegion: normalizeRegion(ocr.topBarRegion, appState.ocr.topBarRegion),
      villagerRegion: normalizeRegion(ocr.villagerRegion, appState.ocr.villagerRegion),
      civRegion: normalizeRegion(ocr.civRegion, appState.ocr.civRegion),
      foodVilRegion: normalizeRegion(ocr.foodVilRegion, appState.ocr.foodVilRegion),
      woodVilRegion: normalizeRegion(ocr.woodVilRegion, appState.ocr.woodVilRegion),
      goldVilRegion: normalizeRegion(ocr.goldVilRegion, appState.ocr.goldVilRegion),
      stoneVilRegion: normalizeRegion(ocr.stoneVilRegion, appState.ocr.stoneVilRegion)
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

  if (shouldSyncLaunchAtLogin) {
    syncLaunchAtLogin();
  }
  syncGlobalShortcuts();
  applyOverlayPosition();
  applyOverlayWindowState();
  if (shouldUpdateTray) {
    updateTrayMenu();
  }
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
  return appState.overlayEnabled && (!appState.overlayOnlyWhenAoe || appState.aoeRunning || appState.inMatch);
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('Knappe der Rauen Schlacht');
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
      label: 'KDRS anzeigen',
      click: () => showDashboard()
    },
    {
      label: appState.overlayEnabled ? 'Overlay ausblenden' : 'Overlay anzeigen',
      click: () => updateState({ overlayEnabled: !appState.overlayEnabled })
    },
    {
      label: appState.overlayOnlyWhenAoe ? 'Overlay nur bei AOE2: an' : 'Overlay nur bei AOE2: aus',
      click: () => updateState({ overlayOnlyWhenAoe: !appState.overlayOnlyWhenAoe })
    },
    {
      label: appState.overlayClickThrough ? 'Klick-Durchlass ausschalten' : 'Klick-Durchlass einschalten',
      click: () => updateState({ overlayClickThrough: !appState.overlayClickThrough })
    },
    {
      label: 'Overlay-Position zuruecksetzen',
      click: () => resetOverlayPosition()
    },
    {
      label: appState.hotkeysEnabled ? 'Hotkeys ausschalten' : 'Hotkeys einschalten',
      click: () => updateState({ hotkeysEnabled: !appState.hotkeysEnabled })
    },
    {
      label: appState.launchAtLogin ? 'Mit Windows starten: an' : 'Mit Windows starten: aus',
      click: () => updateState({ launchAtLogin: !appState.launchAtLogin })
    },
    { type: 'separator' },
    {
      label: 'Beenden',
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
    '<rect width="32" height="32" rx="4" fill="#24140c"/>',
    '<rect x="3" y="3" width="26" height="26" rx="3" fill="#8f6a32" opacity=".95"/>',
    '<rect x="5" y="5" width="22" height="22" rx="2" fill="#2d1a10"/>',
    '<path d="M16 7l8 4v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10v-5z" fill="#c69a45"/>',
    '<path d="M16 10v12M12 14h8" stroke="#2d1a10" stroke-width="2" stroke-linecap="round"/>',
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

  detector = new Detector({ desktopCapturer, screen, nativeImage, civs: civData.civilizations });
  syncDetectorSettings();
  detector.on('state', (detectorState) => {
    const wasAoeRunning = appState.aoeRunning;
    const detectorUpdate = {
      aoeRunning: detectorState.aoeRunning,
      inMatch: detectorState.inMatch,
      sessionStatus: detectorState.sessionStatus,
      captureProvider: detectorState.captureProvider,
      captureStats: detectorState.captureStats,
      ocr: detectorState.ocr
    };

    if (appState.detectionMode === 'ocr' && Number.isFinite(detectorState.villagerCount)) {
      detectorUpdate.villagerCount = detectorState.villagerCount;
    }

    if (appState.detectionMode === 'ocr' && detectorState.resourceVillagers) {
      detectorUpdate.resourceVillagers = detectorState.resourceVillagers;
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
      title: 'Buildorders importieren',
      properties: ['openFile'],
      filters: [{ name: 'Buildorder JSON', extensions: ['json'] }]
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
    title: 'Eigene Buildorders exportieren',
    defaultPath: 'aoe2-custom-build-orders.json',
    filters: [{ name: 'Buildorder JSON', extensions: ['json'] }]
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
    civ: appState.civ,
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
  if (appState.detectionMode !== 'ocr') {
    appState.detectionMode = 'ocr';
  }

  const migratedOcr = migrateLegacyOcrRegions(settings.ocr);
  if (migratedOcr) {
    appState.ocr = {
      ...appState.ocr,
      ...migratedOcr,
      intervalMs: clampNumber(migratedOcr.intervalMs, appState.ocr.intervalMs, 5000, 20000),
      civIntervalMs: clampNumber(migratedOcr.civIntervalMs, appState.ocr.civIntervalMs, 15000, 300000),
      captureProvider: ['auto', 'node-screenshots'].includes(migratedOcr.captureProvider)
        ? migratedOcr.captureProvider
        : appState.ocr.captureProvider,
      captureIntervalMs: clampNumber(migratedOcr.captureIntervalMs, appState.ocr.captureIntervalMs, 1000, 10000),
      startupProbeIntervalMs: clampNumber(migratedOcr.startupProbeIntervalMs, appState.ocr.startupProbeIntervalMs, 500, 10000),
      civReadOnce: migratedOcr.civReadOnce === undefined ? appState.ocr.civReadOnce : Boolean(migratedOcr.civReadOnce),
      minConfidence: clampNumber(migratedOcr.minConfidence, appState.ocr.minConfidence, 0, 100),
      stableReadCount: clampNumber(migratedOcr.stableReadCount, appState.ocr.stableReadCount, 1, 5),
      imageScale: clampNumber(migratedOcr.imageScale, appState.ocr.imageScale, 1, 6),
      topBarRegion: normalizeRegion(migratedOcr.topBarRegion, appState.ocr.topBarRegion),
      villagerRegion: normalizeRegion(migratedOcr.villagerRegion, appState.ocr.villagerRegion),
      civRegion: normalizeRegion(migratedOcr.civRegion, appState.ocr.civRegion),
      foodVilRegion: normalizeRegion(migratedOcr.foodVilRegion, appState.ocr.foodVilRegion),
      woodVilRegion: normalizeRegion(migratedOcr.woodVilRegion, appState.ocr.woodVilRegion),
      goldVilRegion: normalizeRegion(migratedOcr.goldVilRegion, appState.ocr.goldVilRegion),
      stoneVilRegion: normalizeRegion(migratedOcr.stoneVilRegion, appState.ocr.stoneVilRegion)
    };
  }

  if (settings.overlayPosition) {
    appState.overlayPosition = normalizeOverlayPosition(settings.overlayPosition);
  }
}

function getDefaultOverlayPosition(width = OVERLAY_WIDTH, height = OVERLAY_HEIGHT) {
  const targetDisplay = screen.getPrimaryDisplay();
  return {
    x: targetDisplay.bounds.x + targetDisplay.bounds.width - width - 24,
    y: targetDisplay.bounds.y + 92
  };
}

function normalizeOverlayPosition(position, width = OVERLAY_WIDTH, height = OVERLAY_HEIGHT) {
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
  const safeFallback = fallback || { x: 0, y: 0, width: 0.1, height: 0.1 };
  const source = region || safeFallback;
  return {
    x: clampPercent(source.x, safeFallback.x),
    y: clampPercent(source.y, safeFallback.y),
    width: clampPercent(source.width, safeFallback.width),
    height: clampPercent(source.height, safeFallback.height)
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
