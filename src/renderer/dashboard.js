const $ = (selector) => document.querySelector(selector);
const listen = (element, eventName, handler) => {
  if (element) {
    element.addEventListener(eventName, handler);
  }
};

const elements = {
  mainTab: $('#mainTab'),
  settingsTab: $('#settingsTab'),
  mainView: $('#mainView'),
  settingsView: $('#settingsView'),
  statusText: $('#statusText'),
  gameStatus: $('#gameStatus'),
  civSelect: $('#civSelect'),
  buildSelect: $('#buildSelect'),
  customBuildStatus: $('#customBuildStatus'),
  buildImportStatus: $('#buildImportStatus'),
  importBuilds: $('#importBuilds'),
  exportBuilds: $('#exportBuilds'),
  detectionMode: $('#detectionMode'),
  villagerCount: $('#villagerCount'),
  villagerMinus: $('#villagerMinus'),
  villagerPlus: $('#villagerPlus'),
  overlayEnabled: $('#overlayEnabled'),
  overlayClickThrough: $('#overlayClickThrough'),
  overlayOnlyWhenAoe: $('#overlayOnlyWhenAoe'),
  autoShowDashboardOnAoe: $('#autoShowDashboardOnAoe'),
  hotkeysEnabled: $('#hotkeysEnabled'),
  launchAtLogin: $('#launchAtLogin'),
  overlayPositionText: $('#overlayPositionText'),
  overlayNudgeUp: $('#overlayNudgeUp'),
  overlayNudgeDown: $('#overlayNudgeDown'),
  overlayNudgeLeft: $('#overlayNudgeLeft'),
  overlayNudgeRight: $('#overlayNudgeRight'),
  overlayResetPosition: $('#overlayResetPosition'),
  displaySelect: $('#displaySelect'),
  ocrStatus: $('#ocrStatus'),
  ocrText: $('#ocrText'),
  refreshPreview: $('#refreshPreview'),
  refreshPreview2: $('#refreshPreview2'),
  testOcr: $('#testOcr'),
  ocrLiveTest: $('#ocrLiveTest'),
  resetCalibration: $('#resetCalibration'),
  previewStatus: $('#previewStatus'),
  topBarPreview: $('#topBarPreview'),
  villagerPreview: $('#villagerPreview'),
  villagerProcessedPreview: $('#villagerProcessedPreview'),
  civPreview: $('#civPreview'),
  ocrVariants: $('#ocrVariants'),
  calibZoom: $('#calibZoom'),
  calibZoomValue: $('#calibZoomValue'),
  calibZoomReset: $('#calibZoomReset'),
  calibratorViewport: $('#calibratorViewport'),
  calibLoupe: $('#calibLoupe'),
  ocrSettings: {
    captureProvider: $('#ocrCaptureProvider'),
    captureIntervalMs: $('#ocrCaptureIntervalMs'),
    startupProbeIntervalMs: $('#ocrStartupProbeIntervalMs'),
    civIntervalMs: $('#ocrCivIntervalMs'),
    minConfidence: $('#ocrMinConfidence'),
    stableReadCount: $('#ocrStableReadCount'),
    imageScale: $('#ocrImageScale')
  },
  ocrCivReadOnce: $('#ocrCivReadOnce'),
  screenCalibrator: $('#screenCalibrator'),
  screenPreview: $('#screenPreview'),
  selectTopBarRegion: $('#selectTopBarRegion'),
  selectVillagerRegion: $('#selectVillagerRegion'),
  selectCivRegion: $('#selectCivRegion'),
  selectFoodVilRegion: $('#selectFoodVilRegion'),
  selectWoodVilRegion: $('#selectWoodVilRegion'),
  selectGoldVilRegion: $('#selectGoldVilRegion'),
  selectStoneVilRegion: $('#selectStoneVilRegion'),
  resourceProcessed: {
    food: $('#foodVilProcessedPreview'),
    wood: $('#woodVilProcessedPreview'),
    gold: $('#goldVilProcessedPreview'),
    stone: $('#stoneVilProcessedPreview')
  },
  resourceValues: {
    food: $('#foodVilValue'),
    wood: $('#woodVilValue'),
    gold: $('#goldVilValue'),
    stone: $('#stoneVilValue')
  },
  regionBoxes: {
    topBarRegion: $('#topBarBox'),
    villagerRegion: $('#villagerBox'),
    civRegion: $('#civBox'),
    foodVilRegion: $('#foodVilBox'),
    woodVilRegion: $('#woodVilBox'),
    goldVilRegion: $('#goldVilBox'),
    stoneVilRegion: $('#stoneVilBox')
  },
  regions: {
    topBarRegion: {
      x: $('#topBarRegionX'),
      y: $('#topBarRegionY'),
      width: $('#topBarRegionWidth'),
      height: $('#topBarRegionHeight')
    },
    villagerRegion: {
      x: $('#villagerRegionX'),
      y: $('#villagerRegionY'),
      width: $('#villagerRegionWidth'),
      height: $('#villagerRegionHeight')
    },
    civRegion: {
      x: $('#civRegionX'),
      y: $('#civRegionY'),
      width: $('#civRegionWidth'),
      height: $('#civRegionHeight')
    },
    foodVilRegion: {
      x: $('#foodVilRegionX'),
      y: $('#foodVilRegionY'),
      width: $('#foodVilRegionWidth'),
      height: $('#foodVilRegionHeight')
    },
    woodVilRegion: {
      x: $('#woodVilRegionX'),
      y: $('#woodVilRegionY'),
      width: $('#woodVilRegionWidth'),
      height: $('#woodVilRegionHeight')
    },
    goldVilRegion: {
      x: $('#goldVilRegionX'),
      y: $('#goldVilRegionY'),
      width: $('#goldVilRegionWidth'),
      height: $('#goldVilRegionHeight')
    },
    stoneVilRegion: {
      x: $('#stoneVilRegionX'),
      y: $('#stoneVilRegionY'),
      width: $('#stoneVilRegionWidth'),
      height: $('#stoneVilRegionHeight')
    }
  },
  regionsPx: {
    topBarRegion: {
      x: $('#topBarRegionXpx'),
      y: $('#topBarRegionYpx'),
      width: $('#topBarRegionWidthpx'),
      height: $('#topBarRegionHeightpx')
    },
    villagerRegion: {
      x: $('#villagerRegionXpx'),
      y: $('#villagerRegionYpx'),
      width: $('#villagerRegionWidthpx'),
      height: $('#villagerRegionHeightpx')
    },
    civRegion: {
      x: $('#civRegionXpx'),
      y: $('#civRegionYpx'),
      width: $('#civRegionWidthpx'),
      height: $('#civRegionHeightpx')
    },
    foodVilRegion: {
      x: $('#foodVilRegionXpx'),
      y: $('#foodVilRegionYpx'),
      width: $('#foodVilRegionWidthpx'),
      height: $('#foodVilRegionHeightpx')
    },
    woodVilRegion: {
      x: $('#woodVilRegionXpx'),
      y: $('#woodVilRegionYpx'),
      width: $('#woodVilRegionWidthpx'),
      height: $('#woodVilRegionHeightpx')
    },
    goldVilRegion: {
      x: $('#goldVilRegionXpx'),
      y: $('#goldVilRegionYpx'),
      width: $('#goldVilRegionWidthpx'),
      height: $('#goldVilRegionHeightpx')
    },
    stoneVilRegion: {
      x: $('#stoneVilRegionXpx'),
      y: $('#stoneVilRegionYpx'),
      width: $('#stoneVilRegionWidthpx'),
      height: $('#stoneVilRegionHeightpx')
    }
  },
  buildName: $('#buildName'),
  buildSummary: $('#buildSummary'),
  progressPercent: $('#progressPercent'),
  stepIcon: $('#stepIcon'),
  stepVillagers: $('#stepVillagers'),
  stepTitle: $('#stepTitle'),
  stepInstruction: $('#stepInstruction'),
  timeline: $('#timeline')
};

const defaultRegions = {
  topBarRegion: { x: 0, y: 0, width: 1, height: 0.075 },
  villagerRegion: { x: 0.224, y: 0.029, width: 0.018, height: 0.022 },
  civRegion: { x: 0.83, y: 0.006, width: 0.15, height: 0.065 },
  woodVilRegion: { x: 0.014, y: 0.03, width: 0.015, height: 0.019 },
  foodVilRegion: { x: 0.073, y: 0.03, width: 0.015, height: 0.019 },
  goldVilRegion: { x: 0.128, y: 0.03, width: 0.015, height: 0.019 },
  stoneVilRegion: { x: 0.183, y: 0.03, width: 0.015, height: 0.019 }
};

const defaultOcrSettings = {
  captureProvider: 'auto',
  captureIntervalMs: 2500,
  startupProbeIntervalMs: 1000,
  civIntervalMs: 60000,
  civReadOnce: true,
  minConfidence: 55,
  stableReadCount: 2,
  imageScale: 6
};

let currentState;
let activeRegion = 'topBarRegion';
let dragState = null;
let calibZoomLevel = 1;
let calibPan = { x: 0, y: 0 };
let lastImageSize = null;
let panState = null;
let liveTestTimer = null;

window.aoeOverlay.getState().then(render);
window.aoeOverlay.onState(render);

listen(elements.mainTab, 'click', () => {
  setView('main');
});

listen(elements.settingsTab, 'click', () => {
  setView('settings');
});

listen(elements.civSelect, 'change', () => {
  window.aoeOverlay.updateState({ civ: elements.civSelect.value });
});

listen(elements.buildSelect, 'change', () => {
  window.aoeOverlay.updateState({ selectedBuildId: elements.buildSelect.value });
});

listen(elements.importBuilds, 'click', async () => {
  elements.buildImportStatus.textContent = 'Importiere...';
  try {
    const result = await window.aoeOverlay.importBuilds();
    if (!result || result.canceled) {
      elements.buildImportStatus.textContent = 'Import abgebrochen.';
      return;
    }

    if (result.error) {
      elements.buildImportStatus.textContent = `Import fehlgeschlagen: ${result.error}`;
      return;
    }

    elements.buildImportStatus.textContent = `${result.importedBuilds} Builds importiert. ${result.totalCustomBuilds} eigene Builds geladen.`;
  } catch (error) {
    elements.buildImportStatus.textContent = error.message;
  }
});

listen(elements.exportBuilds, 'click', async () => {
  elements.buildImportStatus.textContent = 'Exportiere...';
  try {
    const result = await window.aoeOverlay.exportBuilds();
    if (!result || result.canceled) {
      elements.buildImportStatus.textContent = 'Export abgebrochen.';
      return;
    }

    elements.buildImportStatus.textContent = `${result.exportedBuilds} Builds exportiert.`;
  } catch (error) {
    elements.buildImportStatus.textContent = error.message;
  }
});

listen(elements.detectionMode, 'change', () => {
  window.aoeOverlay.updateState({ detectionMode: elements.detectionMode.value });
});

listen(elements.displaySelect, 'change', () => {
  window.aoeOverlay.updateState({ selectedDisplayId: elements.displaySelect.value });
});

listen(elements.villagerMinus, 'click', () => {
  window.aoeOverlay.adjustVillagers(-1);
});

listen(elements.villagerPlus, 'click', () => {
  window.aoeOverlay.adjustVillagers(1);
});

listen(elements.overlayEnabled, 'change', () => {
  window.aoeOverlay.updateState({ overlayEnabled: elements.overlayEnabled.checked });
});

listen(elements.overlayClickThrough, 'change', () => {
  window.aoeOverlay.updateState({ overlayClickThrough: elements.overlayClickThrough.checked });
});

listen(elements.overlayOnlyWhenAoe, 'change', () => {
  window.aoeOverlay.updateState({ overlayOnlyWhenAoe: elements.overlayOnlyWhenAoe.checked });
});

listen(elements.autoShowDashboardOnAoe, 'change', () => {
  window.aoeOverlay.updateState({ autoShowDashboardOnAoe: elements.autoShowDashboardOnAoe.checked });
});

listen(elements.hotkeysEnabled, 'change', () => {
  window.aoeOverlay.updateState({ hotkeysEnabled: elements.hotkeysEnabled.checked });
});

listen(elements.launchAtLogin, 'change', () => {
  window.aoeOverlay.updateState({ launchAtLogin: elements.launchAtLogin.checked });
});

listen(elements.overlayNudgeUp, 'click', () => {
  window.aoeOverlay.moveOverlay({ dx: 0, dy: -16 });
});

listen(elements.overlayNudgeDown, 'click', () => {
  window.aoeOverlay.moveOverlay({ dx: 0, dy: 16 });
});

listen(elements.overlayNudgeLeft, 'click', () => {
  window.aoeOverlay.moveOverlay({ dx: -16, dy: 0 });
});

listen(elements.overlayNudgeRight, 'click', () => {
  window.aoeOverlay.moveOverlay({ dx: 16, dy: 0 });
});

listen(elements.overlayResetPosition, 'click', () => {
  window.aoeOverlay.moveOverlay({ reset: true });
});

for (const [settingName, input] of Object.entries(elements.ocrSettings)) {
  listen(input, 'change', () => {
    const value = settingName === 'captureProvider'
      ? input.value
      : readNumber(input, defaultOcrSettings[settingName]);
    window.aoeOverlay.updateState({
      ocr: {
        [settingName]: value
      }
    });
  });
}

listen(elements.ocrCivReadOnce, 'change', () => {
  window.aoeOverlay.updateState({
    ocr: {
      civReadOnce: elements.ocrCivReadOnce.checked
    }
  });
});

for (const [regionName, inputs] of Object.entries(elements.regions)) {
  for (const input of Object.values(inputs)) {
    listen(input, 'change', () => {
      window.aoeOverlay.updateState({
        ocr: {
          [regionName]: readRegion(regionName)
        }
      });
    });
  }
}

listen(elements.resetCalibration, 'click', () => {
  window.aoeOverlay.updateState({
    ocr: { ...defaultRegions }
  });
});

listen(elements.refreshPreview, 'click', async () => {
  await refreshPreview();
});

listen(elements.testOcr, 'click', async () => {
  await testOcrNow();
});

listen(elements.selectTopBarRegion, 'click', () => {
  setActiveRegion('topBarRegion');
});

listen(elements.selectVillagerRegion, 'click', () => {
  setActiveRegion('villagerRegion');
});

listen(elements.selectCivRegion, 'click', () => {
  setActiveRegion('civRegion');
});

listen(elements.selectFoodVilRegion, 'click', () => {
  setActiveRegion('foodVilRegion');
});

listen(elements.selectWoodVilRegion, 'click', () => {
  setActiveRegion('woodVilRegion');
});

listen(elements.selectGoldVilRegion, 'click', () => {
  setActiveRegion('goldVilRegion');
});

listen(elements.selectStoneVilRegion, 'click', () => {
  setActiveRegion('stoneVilRegion');
});

for (const [regionName, box] of Object.entries(elements.regionBoxes)) {
  listen(box, 'pointerdown', (event) => {
    startRegionDrag(event, regionName, event.target.tagName.toLowerCase() === 'i' ? 'resize' : 'move');
  });
}

listen(elements.screenCalibrator, 'pointerdown', (event) => {
  if (event.button === 1 || event.button === 2) {
    startPan(event);
    return;
  }

  if (event.target !== elements.screenPreview) {
    return;
  }

  startRegionDraw(event);
});

listen(elements.screenCalibrator, 'contextmenu', (event) => {
  event.preventDefault();
});

window.addEventListener('pointermove', (event) => {
  if (panState) {
    updatePan(event);
    return;
  }

  updateRegionDrag(event);
  updateLoupe(event);
});

window.addEventListener('pointerup', () => {
  if (panState) {
    finishPan();
    return;
  }

  finishRegionDrag();
});

listen(elements.screenCalibrator, 'pointerleave', () => {
  hideLoupe();
});

if (elements.screenCalibrator) {
  elements.screenCalibrator.addEventListener('wheel', (event) => {
    event.preventDefault();
    if (event.ctrlKey) {
      const delta = event.deltaY < 0 ? 0.25 : -0.25;
      zoomAtPoint(calibZoomLevel + delta, event);
      return;
    }

    const next = event.shiftKey
      ? { x: calibPan.x - event.deltaY, y: calibPan.y }
      : { x: calibPan.x, y: calibPan.y - event.deltaY };
    calibPan = clampPan(next.x, next.y);
    applyCalibTransform();
  }, { passive: false });
}

listen(elements.calibZoom, 'input', () => {
  setCalibZoom(Number.parseFloat(elements.calibZoom.value) || 1);
});

listen(elements.calibZoomReset, 'click', () => {
  calibPan = { x: 0, y: 0 };
  setCalibZoom(1);
});

listen(elements.screenCalibrator, 'keydown', (event) => {
  const deltas = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1]
  };
  const delta = deltas[event.key];
  if (!delta || !lastImageSize) {
    return;
  }

  event.preventDefault();
  const stepPx = event.shiftKey ? 10 : 1;
  const region = currentState?.ocr?.[activeRegion] || defaultRegions[activeRegion];
  updateRegion(activeRegion, {
    ...region,
    x: clamp(region.x + (delta[0] * stepPx) / lastImageSize.width, 0, 1 - region.width),
    y: clamp(region.y + (delta[1] * stepPx) / lastImageSize.height, 0, 1 - region.height)
  });
});

listen(elements.refreshPreview2, 'click', async () => {
  await refreshPreview();
});

listen(elements.ocrLiveTest, 'change', () => {
  if (elements.ocrLiveTest.checked) {
    startLiveTest();
  } else {
    stopLiveTest();
  }
});

for (const [regionName, inputs] of Object.entries(elements.regionsPx)) {
  for (const input of Object.values(inputs)) {
    listen(input, 'change', () => {
      const region = readRegionPx(regionName);
      if (region) {
        updateRegion(regionName, region);
      }
    });
  }
}

for (const img of document.querySelectorAll('.preview-grid img')) {
  listen(img, 'click', () => {
    img.classList.toggle('enlarged');
  });
}

function render(state) {
  currentState = state;
  renderSelect(elements.civSelect, state.civs.map((civ) => ({ value: civ, label: civ })), state.civ);
  renderSelect(elements.buildSelect, state.recommendedBuilds.map((build) => ({
    value: build.id,
    label: `${build.name} - ${build.style}`
  })), state.selectedBuildId);
  renderSelect(elements.displaySelect, state.displays.map((display) => ({
    value: String(display.id),
    label: `${display.primary ? 'Hauptbildschirm' : 'Bildschirm'} ${display.id}`
  })), String(state.selectedDisplayId || state.displays[0]?.id || ''));

  elements.detectionMode.value = state.detectionMode;
  elements.customBuildStatus.textContent = `${state.customBuildCount || 0} geladen`;
  elements.villagerCount.textContent = state.villagerCount;
  elements.overlayEnabled.checked = state.overlayEnabled;
  elements.overlayClickThrough.checked = state.overlayClickThrough;
  elements.overlayOnlyWhenAoe.checked = state.overlayOnlyWhenAoe;
  elements.autoShowDashboardOnAoe.checked = state.autoShowDashboardOnAoe;
  elements.hotkeysEnabled.checked = state.hotkeysEnabled;
  elements.launchAtLogin.checked = state.launchAtLogin;
  elements.overlayPositionText.textContent = formatOverlayPosition(state.overlayPosition);

  elements.gameStatus.textContent = state.inMatch ? 'Match erkannt' : state.aoeRunning ? 'AOE2 offen' : 'AOE2 offline';
  elements.gameStatus.classList.toggle('online', state.aoeRunning);
  elements.statusText.textContent = `${state.civ} / ${state.build.name} / ${state.sessionStatus || 'Bildschirm-Erkennung'}`;

  elements.ocrStatus.textContent = translateOcrStatus(state.ocr?.status || 'idle');
  elements.ocrText.textContent = formatOcrText(state);
  writeOcrSettings(state.ocr || defaultOcrSettings);
  elements.ocrCivReadOnce.checked = Boolean(state.ocr?.civReadOnce ?? defaultOcrSettings.civReadOnce);
  for (const regionName of Object.keys(elements.regions)) {
    writeRegion(regionName, state.ocr?.[regionName] || defaultRegions[regionName]);
  }
  renderResourceVillagers(state.resourceVillagers);
  renderRegionBoxes(state);

  elements.buildName.textContent = state.build.name;
  elements.buildSummary.textContent = state.build.summary;

  const percent = Math.round((state.progress.progress || 0) * 100);
  elements.progressPercent.textContent = `${percent}%`;
  elements.progressPercent.parentElement.style.setProperty('--progress', `${percent * 3.6}deg`);

  const step = state.progress.current || state.build.steps[0];
  const next = state.progress.next;
  const currentIcon = getStepIcon(step);
  elements.stepIcon.src = currentIcon.src;
  elements.stepIcon.alt = currentIcon.label;
  elements.stepVillagers.textContent = `${step.villagers} Dorfb.`;
  elements.stepTitle.textContent = step.title;
  elements.stepInstruction.textContent = step.instruction;

  elements.timeline.replaceChildren(...state.build.steps.map((item) => renderStep(item, step, next, state.villagerCount)));
}

function setView(viewName) {
  const settings = viewName === 'settings';
  elements.mainTab.classList.toggle('active', !settings);
  elements.settingsTab.classList.toggle('active', settings);
  elements.mainView.classList.toggle('active', !settings);
  elements.settingsView.classList.toggle('active', settings);
}

function translateOcrStatus(status) {
  const labels = {
    idle: 'wartet',
    capturing: 'nimmt auf',
    read: 'erkannt',
    unchanged: 'unveraendert',
    uncertain: 'unsicher',
    error: 'Fehler',
    unavailable: 'nicht verfuegbar',
    'no-frame': 'kein Bild'
  };

  return labels[status] || status;
}

function formatOverlayPosition(position) {
  if (!position) {
    return '-';
  }

  return `${Math.round(position.x)}, ${Math.round(position.y)}`;
}

function renderSelect(select, options, value) {
  const existingValue = select.value;
  const signature = options.map((option) => option.value).join('|');

  if (select.dataset.signature !== signature) {
    select.replaceChildren(...options.map((option) => {
      const node = document.createElement('option');
      node.value = option.value;
      node.textContent = option.label;
      return node;
    }));
    select.dataset.signature = signature;
  }

  select.value = value || existingValue;
}

function renderStep(item, current, next, villagerCount) {
  const li = document.createElement('li');
  li.classList.toggle('done', item.villagers < villagerCount);
  li.classList.toggle('current', item.villagers === current.villagers && (!next || item.villagers <= villagerCount));

  const villager = document.createElement('div');
  villager.className = 'vil';
  const icon = getStepIcon(item);
  const iconNode = document.createElement('img');
  iconNode.src = icon.src;
  iconNode.alt = icon.label;
  iconNode.className = 'mini-icon';
  const count = document.createElement('span');
  count.textContent = `${item.villagers} Dorfb.`;
  villager.append(iconNode, count);

  const body = document.createElement('div');
  const title = document.createElement('strong');
  const instruction = document.createElement('p');
  title.textContent = item.title;
  instruction.textContent = item.instruction;
  body.append(title, instruction);

  li.append(villager, body);
  return li;
}

function getStepIcon(step) {
  const text = `${step?.title || ''} ${step?.instruction || ''}`.toLowerCase();
  const icons = {
    food: './assets/aoe2/resource-food.png',
    wood: './assets/aoe2/resource-wood.png',
    gold: './assets/aoe2/resource-gold.png',
    stone: './assets/aoe2/resource-stone.png'
  };

  if (/(gold|mining camp|mining|mine|relic)/.test(text)) {
    return { src: icons.gold, label: 'Gold' };
  }

  if (/(stone|castle|donjon|krepost)/.test(text)) {
    return { src: icons.stone, label: 'Stein' };
  }

  if (/(wood|lumber|barracks|stable|range|blacksmith|market|dock|house|wall|farm)/.test(text)) {
    return { src: icons.wood, label: 'Holz' };
  }

  return { src: icons.food, label: 'Nahrung' };
}

function readRegion(regionName) {
  const inputs = elements.regions[regionName];
  return {
    x: readPercent(inputs.x),
    y: readPercent(inputs.y),
    width: readPercent(inputs.width),
    height: readPercent(inputs.height)
  };
}

function writeRegion(regionName, region) {
  const inputs = elements.regions[regionName];
  inputs.x.value = toPercent(region.x);
  inputs.y.value = toPercent(region.y);
  inputs.width.value = toPercent(region.width);
  inputs.height.value = toPercent(region.height);
  writeRegionPx(regionName, region);
}

function writeRegionPx(regionName, region) {
  const inputs = elements.regionsPx[regionName];
  if (!inputs) {
    return;
  }

  if (!lastImageSize) {
    for (const input of Object.values(inputs)) {
      input.value = '';
    }
    return;
  }

  inputs.x.value = String(Math.round(region.x * lastImageSize.width));
  inputs.y.value = String(Math.round(region.y * lastImageSize.height));
  inputs.width.value = String(Math.round(region.width * lastImageSize.width));
  inputs.height.value = String(Math.round(region.height * lastImageSize.height));
}

function readRegionPx(regionName) {
  if (!lastImageSize) {
    return null;
  }

  const inputs = elements.regionsPx[regionName];
  const xPx = Number.parseFloat(inputs.x.value);
  const yPx = Number.parseFloat(inputs.y.value);
  const wPx = Number.parseFloat(inputs.width.value);
  const hPx = Number.parseFloat(inputs.height.value);

  if (![xPx, yPx, wPx, hPx].every(Number.isFinite)) {
    return null;
  }

  return {
    x: clamp(xPx / lastImageSize.width, 0, 1),
    y: clamp(yPx / lastImageSize.height, 0, 1),
    width: clamp(wPx / lastImageSize.width, 0.001, 1),
    height: clamp(hPx / lastImageSize.height, 0.001, 1)
  };
}

function readPercent(input) {
  const value = Number.parseFloat(input.value);
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value)) / 100;
}

function readNumber(input, fallback) {
  const value = Number.parseFloat(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function writeOcrSettings(ocr) {
  for (const [settingName, input] of Object.entries(elements.ocrSettings)) {
    input.value = String(ocr[settingName] ?? defaultOcrSettings[settingName]);
  }
}

function formatOcrText(state) {
  const ocr = state?.ocr;
  if (!ocr) {
    return '';
  }

  const read = ocr.lastRead;
  const detail = read
    ? `Sicherheit ${read.confidence ?? 0} / stabil ${read.stableVillagerCount ?? '-'} / ${read.stableCiv ?? '-'}`
    : '';
  const stats = state.captureStats
    ? `${state.captureStats.provider || state.captureProvider || '-'} ${state.captureStats.lastCaptureMs ?? '-'}ms / Schnitt ${state.captureStats.averageCaptureMs ?? '-'}ms`
    : '';

  return [state.sessionStatus, stats, ocr.lastText, detail, ocr.lastError].filter(Boolean).join(' | ');
}

function toPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return '0';
  }

  return (number * 100).toFixed(1);
}

async function refreshPreview() {
  elements.previewStatus.textContent = 'Nehme Screenshot auf...';

  try {
    const preview = await window.aoeOverlay.getOcrPreview();
    if (!preview) {
      elements.previewStatus.textContent = 'Erkennung ist noch nicht bereit.';
      return;
    }

    if (preview.error) {
      elements.previewStatus.textContent = preview.error;
      return;
    }

    elements.topBarPreview.src = preview.topBarRegion;
    elements.villagerPreview.src = preview.villagerRegion;
    elements.civPreview.src = preview.civRegion;
    elements.screenPreview.src = preview.fullFrame;
    if (preview.imageSize) {
      lastImageSize = preview.imageSize;
      refreshPixelInputs();
    }
    elements.previewStatus.textContent = `Bildschirm ${preview.displayId} / ${preview.imageSize.width}x${preview.imageSize.height}`;
    renderRegionBoxes(currentState);
  } catch (error) {
    elements.previewStatus.textContent = error.message;
  }
}

function refreshPixelInputs() {
  for (const regionName of Object.keys(elements.regionsPx)) {
    const region = currentState?.ocr?.[regionName] || defaultRegions[regionName];
    writeRegionPx(regionName, region);
  }
}

async function testOcrNow() {
  elements.previewStatus.textContent = 'Teste OCR...';

  try {
    const result = await window.aoeOverlay.testOcr();
    if (!result) {
      elements.previewStatus.textContent = 'Erkennung ist noch nicht bereit.';
      return;
    }

    if (result.error) {
      elements.previewStatus.textContent = result.error;
      return;
    }

    elements.topBarPreview.src = result.topBarRegion;
    elements.villagerPreview.src = result.villagerRegion;
    elements.civPreview.src = result.civRegion;
    if (elements.villagerProcessedPreview) {
      elements.villagerProcessedPreview.src = result.villagerProcessed || '';
    }
    if (result.imageSize) {
      lastImageSize = result.imageSize;
      refreshPixelInputs();
    }
    renderResourceTest(result.resources);
    const resourceSummary = result.resources
      ? ['food', 'wood', 'gold', 'stone']
        .map((key) => `${key} ${result.resources[key]?.count ?? '-'}`)
        .join(' ')
      : '';
    elements.previewStatus.textContent = [
      `OCR ${translateOcrStatus(result.status)}`,
      `Dorfb. ${result.villagerCount ?? '-'}`,
      `Sicherheit Dorfb. ${result.villagerConfidence ?? 0}`,
      `civ ${result.civ ?? '-'} (${result.civConfidence ?? 0})`,
      resourceSummary ? `Rohstoffe ${resourceSummary}` : '',
      `Rohtext "${result.villagerText || '-'}" / "${result.civText || '-'}"`
    ].filter(Boolean).join(' / ');
    renderVariants(result.villagerVariants);
  } catch (error) {
    elements.previewStatus.textContent = error.message;
  }
}

function renderVariants(variants) {
  if (!elements.ocrVariants) {
    return;
  }

  if (!Array.isArray(variants) || variants.length === 0) {
    elements.ocrVariants.replaceChildren();
    return;
  }

  const rows = variants.map((variant, index) => {
    const row = document.createElement('div');
    row.className = 'variant-row';
    if (index === 0) {
      row.classList.add('best');
    }

    const img = document.createElement('img');
    img.src = variant.image || '';
    img.alt = variant.label;

    const meta = document.createElement('div');
    meta.className = 'variant-meta';
    const label = document.createElement('span');
    label.className = 'variant-label';
    label.textContent = variant.label;
    const value = document.createElement('span');
    value.className = 'variant-value';
    value.textContent = `"${variant.text || '-'}" -> ${variant.digits ?? '-'} (${variant.confidence})`;
    meta.append(label, value);

    row.append(img, meta);
    return row;
  });

  elements.ocrVariants.replaceChildren(...rows);
}

function startLiveTest() {
  stopLiveTest();
  testOcrNow();
  liveTestTimer = window.setInterval(() => {
    testOcrNow();
  }, 1500);
}

function stopLiveTest() {
  if (liveTestTimer) {
    window.clearInterval(liveTestTimer);
    liveTestTimer = null;
  }
}

const regionButtonMap = {
  topBarRegion: 'selectTopBarRegion',
  villagerRegion: 'selectVillagerRegion',
  civRegion: 'selectCivRegion',
  foodVilRegion: 'selectFoodVilRegion',
  woodVilRegion: 'selectWoodVilRegion',
  goldVilRegion: 'selectGoldVilRegion',
  stoneVilRegion: 'selectStoneVilRegion'
};

function setActiveRegion(regionName) {
  activeRegion = regionName;
  for (const [name, key] of Object.entries(regionButtonMap)) {
    elements[key]?.classList.toggle('active', regionName === name);
  }
  for (const name of Object.keys(elements.regionBoxes)) {
    elements.regionBoxes[name].classList.toggle('active', regionName === name);
  }
}

function renderResourceVillagers(resourceVillagers) {
  for (const key of ['food', 'wood', 'gold', 'stone']) {
    const span = elements.resourceValues[key];
    if (!span) {
      continue;
    }

    const value = resourceVillagers?.[key];
    span.textContent = Number.isFinite(value) ? String(value) : '-';
  }
}

function renderResourceTest(resources) {
  for (const key of ['food', 'wood', 'gold', 'stone']) {
    const img = elements.resourceProcessed[key];
    const span = elements.resourceValues[key];
    const data = resources?.[key];
    if (img) {
      img.src = data?.processed || '';
    }

    if (span) {
      span.textContent = data && Number.isFinite(data.count)
        ? `${data.count} (${data.confidence})`
        : '-';
    }
  }
}

function renderRegionBoxes(state) {
  if (!state) {
    return;
  }

  setActiveRegion(activeRegion);
  for (const regionName of Object.keys(elements.regionBoxes)) {
    const region = state.ocr?.[regionName] || defaultRegions[regionName];
    const box = elements.regionBoxes[regionName];
    box.style.left = `${region.x * 100}%`;
    box.style.top = `${region.y * 100}%`;
    box.style.width = `${region.width * 100}%`;
    box.style.height = `${region.height * 100}%`;
  }
}

function startRegionDrag(event, regionName, mode) {
  event.preventDefault();
  event.stopPropagation();
  setActiveRegion(regionName);

  const bounds = elements.calibratorViewport.getBoundingClientRect();
  const region = currentState?.ocr?.[regionName] || defaultRegions[regionName];

  dragState = {
    mode,
    regionName,
    bounds,
    startX: event.clientX,
    startY: event.clientY,
    startRegion: { ...region }
  };

  elements.screenCalibrator.setPointerCapture?.(event.pointerId);
}

function startRegionDraw(event) {
  event.preventDefault();
  const bounds = elements.calibratorViewport.getBoundingClientRect();
  const point = pointToPercent(event, bounds);
  setActiveRegion(activeRegion);

  dragState = {
    mode: 'draw',
    regionName: activeRegion,
    bounds,
    startX: event.clientX,
    startY: event.clientY,
    startPoint: point,
    startRegion: { x: point.x, y: point.y, width: 0.01, height: 0.01 }
  };

  updateRegion(activeRegion, dragState.startRegion);
  elements.screenCalibrator.setPointerCapture?.(event.pointerId);
}

function updateRegionDrag(event) {
  if (!dragState) {
    return;
  }

  const dx = (event.clientX - dragState.startX) / dragState.bounds.width;
  const dy = (event.clientY - dragState.startY) / dragState.bounds.height;
  const start = dragState.startRegion;
  let next;

  if (dragState.mode === 'move') {
    next = {
      ...start,
      x: clamp(start.x + dx, 0, 1 - start.width),
      y: clamp(start.y + dy, 0, 1 - start.height)
    };
  } else if (dragState.mode === 'resize') {
    next = {
      ...start,
      width: clamp(start.width + dx, 0.005, 1 - start.x),
      height: clamp(start.height + dy, 0.005, 1 - start.y)
    };
  } else {
    const point = pointToPercent(event, dragState.bounds);
    const x = Math.min(dragState.startPoint.x, point.x);
    const y = Math.min(dragState.startPoint.y, point.y);
    next = {
      x,
      y,
      width: Math.max(0.005, Math.abs(point.x - dragState.startPoint.x)),
      height: Math.max(0.005, Math.abs(point.y - dragState.startPoint.y))
    };
  }

  updateRegion(dragState.regionName, next);
}

function finishRegionDrag() {
  dragState = null;
}

function updateRegion(regionName, region) {
  const safeRegion = {
    x: clamp(region.x, 0, 1),
    y: clamp(region.y, 0, 1),
    width: clamp(region.width, 0.005, 1),
    height: clamp(region.height, 0.005, 1)
  };

  safeRegion.width = Math.min(safeRegion.width, 1 - safeRegion.x);
  safeRegion.height = Math.min(safeRegion.height, 1 - safeRegion.y);

  writeRegion(regionName, safeRegion);

  window.aoeOverlay.updateState({
    ocr: {
      [regionName]: safeRegion
    }
  });

  if (currentState) {
    currentState = {
      ...currentState,
      ocr: {
        ...currentState.ocr,
        [regionName]: safeRegion
      }
    };
    renderRegionBoxes(currentState);
  }
}

function pointToPercent(event, bounds) {
  return {
    x: clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
    y: clamp((event.clientY - bounds.top) / bounds.height, 0, 1)
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function applyCalibTransform() {
  if (!elements.calibratorViewport) {
    return;
  }

  elements.calibratorViewport.style.transformOrigin = '0 0';
  elements.calibratorViewport.style.transform = `translate(${calibPan.x}px, ${calibPan.y}px) scale(${calibZoomLevel})`;
}

function clampPan(x, y) {
  if (!elements.screenCalibrator || !elements.calibratorViewport) {
    return { x: 0, y: 0 };
  }

  const container = elements.screenCalibrator.getBoundingClientRect();
  const baseW = elements.calibratorViewport.offsetWidth;
  const baseH = elements.calibratorViewport.offsetHeight;
  const scaledW = baseW * calibZoomLevel;
  const scaledH = baseH * calibZoomLevel;
  const minX = Math.min(0, container.width - scaledW);
  const minY = Math.min(0, container.height - scaledH);

  return {
    x: Math.min(0, Math.max(minX, x)),
    y: Math.min(0, Math.max(minY, y))
  };
}

function setCalibZoom(level) {
  calibZoomLevel = clamp(level, 1, 6);
  if (elements.calibZoom) {
    elements.calibZoom.value = String(calibZoomLevel);
  }
  if (elements.calibZoomValue) {
    elements.calibZoomValue.textContent = `${calibZoomLevel.toFixed(1)}x`;
  }
  calibPan = clampPan(calibPan.x, calibPan.y);
  applyCalibTransform();
}

function zoomAtPoint(level, event) {
  const newZoom = clamp(level, 1, 6);
  const container = elements.screenCalibrator.getBoundingClientRect();
  const cx = event.clientX - container.left;
  const cy = event.clientY - container.top;
  const ix = (cx - calibPan.x) / calibZoomLevel;
  const iy = (cy - calibPan.y) / calibZoomLevel;
  calibZoomLevel = newZoom;
  calibPan = clampPan(cx - ix * newZoom, cy - iy * newZoom);

  if (elements.calibZoom) {
    elements.calibZoom.value = String(calibZoomLevel);
  }
  if (elements.calibZoomValue) {
    elements.calibZoomValue.textContent = `${calibZoomLevel.toFixed(1)}x`;
  }
  applyCalibTransform();
}

function startPan(event) {
  event.preventDefault();
  panState = {
    startX: event.clientX,
    startY: event.clientY,
    origin: { ...calibPan }
  };
  elements.screenCalibrator.setPointerCapture?.(event.pointerId);
  elements.screenCalibrator.classList.add('panning');
}

function updatePan(event) {
  if (!panState) {
    return;
  }

  const dx = event.clientX - panState.startX;
  const dy = event.clientY - panState.startY;
  calibPan = clampPan(panState.origin.x + dx, panState.origin.y + dy);
  applyCalibTransform();
}

function finishPan() {
  panState = null;
  elements.screenCalibrator?.classList.remove('panning');
}

function updateLoupe(event) {
  const loupe = elements.calibLoupe;
  const img = elements.screenPreview;
  if (!loupe || !img || !img.getAttribute('src')) {
    return;
  }

  const container = elements.screenCalibrator.getBoundingClientRect();
  const inside = event.clientX >= container.left && event.clientX <= container.right
    && event.clientY >= container.top && event.clientY <= container.bottom;
  if (!inside) {
    hideLoupe();
    return;
  }

  const viewport = elements.calibratorViewport.getBoundingClientRect();
  const fx = clamp((event.clientX - viewport.left) / viewport.width, 0, 1);
  const fy = clamp((event.clientY - viewport.top) / viewport.height, 0, 1);
  const loupeZoom = 5;
  const baseW = elements.calibratorViewport.offsetWidth;
  const baseH = elements.calibratorViewport.offsetHeight;

  loupe.style.display = 'block';
  loupe.style.backgroundImage = `url("${img.getAttribute('src')}")`;
  loupe.style.backgroundSize = `${baseW * loupeZoom}px ${baseH * loupeZoom}px`;
  const lw = loupe.offsetWidth;
  const lh = loupe.offsetHeight;
  loupe.style.backgroundPosition = `${-(fx * baseW * loupeZoom - lw / 2)}px ${-(fy * baseH * loupeZoom - lh / 2)}px`;
  loupe.style.left = `${clamp(event.clientX - container.left + 18, 0, container.width - lw)}px`;
  loupe.style.top = `${clamp(event.clientY - container.top + 18, 0, container.height - lh)}px`;
}

function hideLoupe() {
  if (elements.calibLoupe) {
    elements.calibLoupe.style.display = 'none';
  }
}

window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'o' && currentState) {
    window.aoeOverlay.updateState({ overlayEnabled: !currentState.overlayEnabled });
  }
});
