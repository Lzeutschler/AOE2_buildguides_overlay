const $ = (selector) => document.querySelector(selector);

const elements = {
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
  testOcr: $('#testOcr'),
  resetCalibration: $('#resetCalibration'),
  previewStatus: $('#previewStatus'),
  villagerPreview: $('#villagerPreview'),
  civPreview: $('#civPreview'),
  ocrSettings: {
    intervalMs: $('#ocrIntervalMs'),
    minConfidence: $('#ocrMinConfidence'),
    stableReadCount: $('#ocrStableReadCount'),
    imageScale: $('#ocrImageScale')
  },
  screenCalibrator: $('#screenCalibrator'),
  screenPreview: $('#screenPreview'),
  selectVillagerRegion: $('#selectVillagerRegion'),
  selectCivRegion: $('#selectCivRegion'),
  regionBoxes: {
    villagerRegion: $('#villagerBox'),
    civRegion: $('#civBox')
  },
  regions: {
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
    }
  },
  buildName: $('#buildName'),
  buildSummary: $('#buildSummary'),
  progressPercent: $('#progressPercent'),
  stepVillagers: $('#stepVillagers'),
  stepTitle: $('#stepTitle'),
  stepInstruction: $('#stepInstruction'),
  timeline: $('#timeline')
};

const defaultRegions = {
  villagerRegion: { x: 0.39, y: 0.014, width: 0.06, height: 0.035 },
  civRegion: { x: 0.78, y: 0.04, width: 0.16, height: 0.06 }
};

const defaultOcrSettings = {
  intervalMs: 1800,
  minConfidence: 45,
  stableReadCount: 2,
  imageScale: 3
};

let currentState;
let activeRegion = 'villagerRegion';
let dragState = null;

window.aoeOverlay.getState().then(render);
window.aoeOverlay.onState(render);

elements.civSelect.addEventListener('change', () => {
  window.aoeOverlay.updateState({ civ: elements.civSelect.value });
});

elements.buildSelect.addEventListener('change', () => {
  window.aoeOverlay.updateState({ selectedBuildId: elements.buildSelect.value });
});

elements.importBuilds.addEventListener('click', async () => {
  elements.buildImportStatus.textContent = 'Importing...';
  try {
    const result = await window.aoeOverlay.importBuilds();
    if (!result || result.canceled) {
      elements.buildImportStatus.textContent = 'Import canceled.';
      return;
    }

    if (result.error) {
      elements.buildImportStatus.textContent = `Import failed: ${result.error}`;
      return;
    }

    elements.buildImportStatus.textContent = `Imported ${result.importedBuilds} builds. ${result.totalCustomBuilds} custom builds loaded.`;
  } catch (error) {
    elements.buildImportStatus.textContent = error.message;
  }
});

elements.exportBuilds.addEventListener('click', async () => {
  elements.buildImportStatus.textContent = 'Exporting...';
  try {
    const result = await window.aoeOverlay.exportBuilds();
    if (!result || result.canceled) {
      elements.buildImportStatus.textContent = 'Export canceled.';
      return;
    }

    elements.buildImportStatus.textContent = `Exported ${result.exportedBuilds} builds.`;
  } catch (error) {
    elements.buildImportStatus.textContent = error.message;
  }
});

elements.detectionMode.addEventListener('change', () => {
  window.aoeOverlay.updateState({ detectionMode: elements.detectionMode.value });
});

elements.displaySelect.addEventListener('change', () => {
  window.aoeOverlay.updateState({ selectedDisplayId: elements.displaySelect.value });
});

elements.villagerMinus.addEventListener('click', () => {
  window.aoeOverlay.adjustVillagers(-1);
});

elements.villagerPlus.addEventListener('click', () => {
  window.aoeOverlay.adjustVillagers(1);
});

elements.overlayEnabled.addEventListener('change', () => {
  window.aoeOverlay.updateState({ overlayEnabled: elements.overlayEnabled.checked });
});

elements.overlayClickThrough.addEventListener('change', () => {
  window.aoeOverlay.updateState({ overlayClickThrough: elements.overlayClickThrough.checked });
});

elements.overlayOnlyWhenAoe.addEventListener('change', () => {
  window.aoeOverlay.updateState({ overlayOnlyWhenAoe: elements.overlayOnlyWhenAoe.checked });
});

elements.autoShowDashboardOnAoe.addEventListener('change', () => {
  window.aoeOverlay.updateState({ autoShowDashboardOnAoe: elements.autoShowDashboardOnAoe.checked });
});

elements.hotkeysEnabled.addEventListener('change', () => {
  window.aoeOverlay.updateState({ hotkeysEnabled: elements.hotkeysEnabled.checked });
});

elements.launchAtLogin.addEventListener('change', () => {
  window.aoeOverlay.updateState({ launchAtLogin: elements.launchAtLogin.checked });
});

elements.overlayNudgeUp.addEventListener('click', () => {
  window.aoeOverlay.moveOverlay({ dx: 0, dy: -16 });
});

elements.overlayNudgeDown.addEventListener('click', () => {
  window.aoeOverlay.moveOverlay({ dx: 0, dy: 16 });
});

elements.overlayNudgeLeft.addEventListener('click', () => {
  window.aoeOverlay.moveOverlay({ dx: -16, dy: 0 });
});

elements.overlayNudgeRight.addEventListener('click', () => {
  window.aoeOverlay.moveOverlay({ dx: 16, dy: 0 });
});

elements.overlayResetPosition.addEventListener('click', () => {
  window.aoeOverlay.moveOverlay({ reset: true });
});

for (const [settingName, input] of Object.entries(elements.ocrSettings)) {
  input.addEventListener('change', () => {
    window.aoeOverlay.updateState({
      ocr: {
        [settingName]: readNumber(input, defaultOcrSettings[settingName])
      }
    });
  });
}

for (const [regionName, inputs] of Object.entries(elements.regions)) {
  for (const input of Object.values(inputs)) {
    input.addEventListener('change', () => {
      window.aoeOverlay.updateState({
        ocr: {
          [regionName]: readRegion(regionName)
        }
      });
    });
  }
}

elements.resetCalibration.addEventListener('click', () => {
  window.aoeOverlay.updateState({
    ocr: {
      villagerRegion: defaultRegions.villagerRegion,
      civRegion: defaultRegions.civRegion
    }
  });
});

elements.refreshPreview.addEventListener('click', async () => {
  await refreshPreview();
});

elements.testOcr.addEventListener('click', async () => {
  await testOcrNow();
});

elements.selectVillagerRegion.addEventListener('click', () => {
  setActiveRegion('villagerRegion');
});

elements.selectCivRegion.addEventListener('click', () => {
  setActiveRegion('civRegion');
});

for (const [regionName, box] of Object.entries(elements.regionBoxes)) {
  box.addEventListener('pointerdown', (event) => {
    startRegionDrag(event, regionName, event.target.tagName.toLowerCase() === 'i' ? 'resize' : 'move');
  });
}

elements.screenCalibrator.addEventListener('pointerdown', (event) => {
  if (event.target !== elements.screenPreview) {
    return;
  }

  startRegionDraw(event);
});

window.addEventListener('pointermove', (event) => {
  updateRegionDrag(event);
});

window.addEventListener('pointerup', () => {
  finishRegionDrag();
});

function render(state) {
  currentState = state;
  renderSelect(elements.civSelect, state.civs.map((civ) => ({ value: civ, label: civ })), state.civ);
  renderSelect(elements.buildSelect, state.recommendedBuilds.map((build) => ({
    value: build.id,
    label: `${build.name} - ${build.style}`
  })), state.selectedBuildId);
  renderSelect(elements.displaySelect, state.displays.map((display) => ({
    value: String(display.id),
    label: `${display.primary ? 'Primary' : 'Display'} ${display.id}`
  })), String(state.selectedDisplayId || state.displays[0]?.id || ''));

  elements.detectionMode.value = state.detectionMode;
  elements.customBuildStatus.textContent = `${state.customBuildCount || 0} loaded`;
  elements.villagerCount.textContent = state.villagerCount;
  elements.overlayEnabled.checked = state.overlayEnabled;
  elements.overlayClickThrough.checked = state.overlayClickThrough;
  elements.overlayOnlyWhenAoe.checked = state.overlayOnlyWhenAoe;
  elements.autoShowDashboardOnAoe.checked = state.autoShowDashboardOnAoe;
  elements.hotkeysEnabled.checked = state.hotkeysEnabled;
  elements.launchAtLogin.checked = state.launchAtLogin;
  elements.overlayPositionText.textContent = formatOverlayPosition(state.overlayPosition);

  elements.gameStatus.textContent = state.aoeRunning ? 'AOE2 online' : 'AOE2 offline';
  elements.gameStatus.classList.toggle('online', state.aoeRunning);
  elements.statusText.textContent = `${state.civ} / ${state.build.name} / ${state.detectionMode === 'ocr' ? 'OCR' : 'Manual'}`;

  elements.ocrStatus.textContent = state.ocr?.status || 'idle';
  elements.ocrText.textContent = formatOcrText(state.ocr);
  writeOcrSettings(state.ocr || defaultOcrSettings);
  writeRegion('villagerRegion', state.ocr?.villagerRegion || defaultRegions.villagerRegion);
  writeRegion('civRegion', state.ocr?.civRegion || defaultRegions.civRegion);
  renderRegionBoxes(state);

  elements.buildName.textContent = state.build.name;
  elements.buildSummary.textContent = state.build.summary;

  const percent = Math.round((state.progress.progress || 0) * 100);
  elements.progressPercent.textContent = `${percent}%`;
  elements.progressPercent.parentElement.style.setProperty('--progress', `${percent * 3.6}deg`);

  const step = state.progress.current || state.build.steps[0];
  const next = state.progress.next;
  elements.stepVillagers.textContent = `${step.villagers} vils`;
  elements.stepTitle.textContent = step.title;
  elements.stepInstruction.textContent = step.instruction;

  elements.timeline.replaceChildren(...state.build.steps.map((item) => renderStep(item, step, next, state.villagerCount)));
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
  villager.textContent = `${item.villagers} vils`;

  const body = document.createElement('div');
  const title = document.createElement('strong');
  const instruction = document.createElement('p');
  title.textContent = item.title;
  instruction.textContent = item.instruction;
  body.append(title, instruction);

  li.append(villager, body);
  return li;
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

function formatOcrText(ocr) {
  if (!ocr) {
    return '';
  }

  const read = ocr.lastRead;
  const detail = read
    ? `conf ${read.confidence ?? 0} / stable ${read.stableVillagerCount ?? '-'} / ${read.stableCiv ?? '-'}`
    : '';

  return [ocr.lastText, detail, ocr.lastError].filter(Boolean).join(' | ');
}

function toPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return '0';
  }

  return (number * 100).toFixed(1);
}

async function refreshPreview() {
  elements.previewStatus.textContent = 'Capturing...';

  try {
    const preview = await window.aoeOverlay.getOcrPreview();
    if (!preview) {
      elements.previewStatus.textContent = 'Detector is not ready yet.';
      return;
    }

    if (preview.error) {
      elements.previewStatus.textContent = preview.error;
      return;
    }

    elements.villagerPreview.src = preview.villagerRegion;
    elements.civPreview.src = preview.civRegion;
    elements.screenPreview.src = preview.fullFrame;
    elements.previewStatus.textContent = `Display ${preview.displayId} / ${preview.imageSize.width}x${preview.imageSize.height}`;
    renderRegionBoxes(currentState);
  } catch (error) {
    elements.previewStatus.textContent = error.message;
  }
}

async function testOcrNow() {
  elements.previewStatus.textContent = 'Testing OCR...';

  try {
    const result = await window.aoeOverlay.testOcr();
    if (!result) {
      elements.previewStatus.textContent = 'Detector is not ready yet.';
      return;
    }

    if (result.error) {
      elements.previewStatus.textContent = result.error;
      return;
    }

    elements.villagerPreview.src = result.villagerRegion;
    elements.civPreview.src = result.civRegion;
    elements.previewStatus.textContent = [
      `OCR ${result.status}`,
      `vils ${result.villagerCount ?? '-'}`,
      `civ ${result.civ ?? '-'}`,
      `conf ${result.confidence ?? 0}`,
      `raw "${result.villagerText || '-'}" / "${result.civText || '-'}"`
    ].join(' / ');
  } catch (error) {
    elements.previewStatus.textContent = error.message;
  }
}

function setActiveRegion(regionName) {
  activeRegion = regionName;
  elements.selectVillagerRegion.classList.toggle('active', regionName === 'villagerRegion');
  elements.selectCivRegion.classList.toggle('active', regionName === 'civRegion');
  elements.regionBoxes.villagerRegion.classList.toggle('active', regionName === 'villagerRegion');
  elements.regionBoxes.civRegion.classList.toggle('active', regionName === 'civRegion');
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
  setActiveRegion(regionName);

  const bounds = elements.screenCalibrator.getBoundingClientRect();
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
  const bounds = elements.screenCalibrator.getBoundingClientRect();
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

window.addEventListener('keydown', (event) => {
  if (event.key === '+' || event.key === '=') {
    window.aoeOverlay.adjustVillagers(1);
  }

  if (event.key === '-') {
    window.aoeOverlay.adjustVillagers(-1);
  }

  if (event.key.toLowerCase() === 'o' && currentState) {
    window.aoeOverlay.updateState({ overlayEnabled: !currentState.overlayEnabled });
  }
});
