const { execFile } = require('node:child_process');
const { EventEmitter } = require('node:events');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const AOE_PROCESS_NAMES = [
  'AoE2DE_s',
  'AoE2DE',
  'AoK HD',
  'age2_x1'
];

class Detector extends EventEmitter {
  constructor({ desktopCapturer, screen, tesseract, civs = [] }) {
    super();
    this.desktopCapturer = desktopCapturer;
    this.screen = screen;
    this.tesseract = tesseract;
    this.civs = civs;
    this.timer = null;
    this.lastTickAt = 0;
    this.ocrWorker = null;
    this.stableReads = {
      villager: { value: null, count: 0 },
      civ: { value: null, count: 0 }
    };
    this.state = {
      aoeRunning: false,
      detectionMode: 'manual',
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
  }

  start() {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      this.tick().catch((error) => {
        this.emit('diagnostic', error.message);
      });
    }, 500);

    this.tick().catch(() => {});
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  updateSettings(settings) {
    this.state = {
      ...this.state,
      ...settings,
      ocr: {
        ...this.state.ocr,
        ...(settings.ocr || {}),
        intervalMs: clampNumber(settings.ocr?.intervalMs, this.state.ocr.intervalMs, 500, 10000),
        minConfidence: clampNumber(settings.ocr?.minConfidence, this.state.ocr.minConfidence, 0, 100),
        stableReadCount: clampNumber(settings.ocr?.stableReadCount, this.state.ocr.stableReadCount, 1, 5),
        imageScale: clampNumber(settings.ocr?.imageScale, this.state.ocr.imageScale, 1, 6),
        villagerRegion: normalizeRegion(settings.ocr?.villagerRegion, this.state.ocr.villagerRegion),
        civRegion: normalizeRegion(settings.ocr?.civRegion, this.state.ocr.civRegion)
      }
    };
  }

  async tick() {
    const aoeRunning = await isAoeRunning();
    const nextState = {
      ...this.state,
      aoeRunning
    };

    if (nextState.detectionMode === 'ocr' && aoeRunning && this.shouldRunOcr(nextState.ocr.intervalMs)) {
      await this.runOcr(nextState);
    }

    this.state = nextState;
    this.emit('state', this.state);
  }

  shouldRunOcr(intervalMs) {
    const now = Date.now();
    if (now - this.lastTickAt < intervalMs) {
      return false;
    }

    this.lastTickAt = now;
    return true;
  }

  async runOcr(nextState) {
    if (!this.desktopCapturer || !this.tesseract) {
      nextState.ocr.status = 'unavailable';
      nextState.ocr.lastError = 'OCR dependencies are unavailable.';
      return;
    }

    try {
      nextState.ocr.status = 'capturing';
      const read = await this.readCurrentFrame();

      if (read.error) {
        nextState.ocr.status = read.status;
        nextState.ocr.lastError = read.error;
        return;
      }

      const { villagerResult, civResult, villagerCount, detectedCiv, averageConfidence } = read;
      const villagerStable = updateStableRead(this.stableReads.villager, villagerCount, nextState.ocr.stableReadCount);
      const civStable = updateStableRead(this.stableReads.civ, detectedCiv, nextState.ocr.stableReadCount);

      nextState.ocr.lastText = [villagerResult.text, civResult.text].map((item) => item.trim()).filter(Boolean).join(' | ');
      nextState.ocr.status = Number.isFinite(villagerCount) || detectedCiv ? 'read' : 'uncertain';
      nextState.ocr.lastRead = {
        villagerCount: Number.isFinite(villagerCount) ? villagerCount : null,
        civ: detectedCiv,
        confidence: averageConfidence,
        stableVillagerCount: villagerStable,
        stableCiv: civStable
      };

      if (villagerStable && villagerResult.confidence >= nextState.ocr.minConfidence && villagerStable > 0 && villagerStable < 250) {
        nextState.villagerCount = villagerStable;
      }

      if (civStable && civResult.confidence >= nextState.ocr.minConfidence) {
        nextState.civ = civStable;
      }
    } catch (error) {
      nextState.ocr.status = 'error';
      nextState.ocr.lastError = error.message;
    }
  }

  async testOcr() {
    if (!this.desktopCapturer || !this.tesseract) {
      return {
        status: 'unavailable',
        error: 'OCR dependencies are unavailable.'
      };
    }

    try {
      const read = await this.readCurrentFrame();
      if (read.error) {
        return read;
      }

      return {
        status: Number.isFinite(read.villagerCount) || read.detectedCiv ? 'read' : 'uncertain',
        displayId: read.displayId,
        imageSize: read.imageSize,
        villagerText: read.villagerResult.text.trim(),
        civText: read.civResult.text.trim(),
        villagerCount: Number.isFinite(read.villagerCount) ? read.villagerCount : null,
        civ: read.detectedCiv,
        confidence: read.averageConfidence,
        villagerConfidence: Math.round(read.villagerResult.confidence),
        civConfidence: Math.round(read.civResult.confidence),
        villagerRegion: read.villagerImage.toDataURL(),
        civRegion: read.civImage.toDataURL()
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  getSelectedDisplay() {
    const displays = this.screen.getAllDisplays();
    const display = displays.find((item) => String(item.id) === String(this.state.selectedDisplayId));
    return display || displays[0];
  }

  async getScreenSource(display) {
    const scaleFactor = display.scaleFactor || 1;
    const width = Math.round(display.bounds.width * scaleFactor);
    const height = Math.round(display.bounds.height * scaleFactor);
    const sources = await this.desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height }
    });

    return sources.find((source) => String(source.display_id) === String(display.id)) || sources[0];
  }

  async readCurrentFrame() {
    const display = this.getSelectedDisplay();
    const source = await this.getScreenSource(display);

    if (!source || source.thumbnail.isEmpty()) {
      return {
        displayId: display.id,
        status: 'no-frame',
        error: 'No screen frame was captured.'
      };
    }

    const imageSize = source.thumbnail.getSize();
    const villagerCrop = cropByPercent(source.thumbnail, imageSize, this.state.ocr.villagerRegion);
    const civCrop = cropByPercent(source.thumbnail, imageSize, this.state.ocr.civRegion);
    const villagerImage = prepareForOcr(villagerCrop, this.state.ocr.imageScale);
    const civImage = prepareForOcr(civCrop, this.state.ocr.imageScale);
    const villagerResult = await this.recognize(villagerImage.toDataURL(), '0123456789');
    const civResult = await this.recognize(civImage.toDataURL(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ');
    const villagerCount = Number.parseInt(villagerResult.text.replace(/\D/g, ''), 10);
    const detectedCiv = matchKnownCiv(civResult.text, this.civs);

    return {
      displayId: display.id,
      imageSize,
      villagerImage,
      civImage,
      villagerResult,
      civResult,
      villagerCount,
      detectedCiv,
      averageConfidence: Math.round((villagerResult.confidence + civResult.confidence) / 2)
    };
  }

  async capturePreview() {
    const display = this.getSelectedDisplay();
    const source = await this.getScreenSource(display);

    if (!source || source.thumbnail.isEmpty()) {
      return {
        displayId: display.id,
        error: 'No screen frame was captured.'
      };
    }

    const imageSize = source.thumbnail.getSize();
    const villagerImage = cropByPercent(source.thumbnail, imageSize, this.state.ocr.villagerRegion);
    const civImage = cropByPercent(source.thumbnail, imageSize, this.state.ocr.civRegion);

    return {
      displayId: display.id,
      imageSize,
      fullFrame: source.thumbnail.toDataURL(),
      villagerRegion: villagerImage.toDataURL(),
      civRegion: civImage.toDataURL()
    };
  }

  async recognize(dataUrl, whitelist) {
    if (!this.ocrWorker) {
      this.ocrWorker = await this.tesseract.createWorker('eng');
    }

    await this.ocrWorker.setParameters({
      tessedit_char_whitelist: whitelist,
      tessedit_pageseg_mode: '7'
    });

    const result = await this.ocrWorker.recognize(dataUrl);
    return {
      text: result.data.text || '',
      confidence: Number.isFinite(result.data.confidence) ? result.data.confidence : 0
    };
  }
}

async function isAoeRunning() {
  const command = [
    '$names = @(' + AOE_PROCESS_NAMES.map((name) => `'${name}'`).join(',') + ');',
    '$found = $false;',
    'foreach ($name in $names) {',
    '  if (Get-Process -Name $name -ErrorAction SilentlyContinue) { $found = $true; break }',
    '}',
    'if ($found) { "true" } else { "false" }'
  ].join(' ');

  try {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      command
    ], {
      windowsHide: true,
      timeout: 2000
    });

    return stdout.trim().toLowerCase() === 'true';
  } catch {
    return false;
  }
}

function cropByPercent(image, imageSize, region) {
  const safeRegion = normalizeRegion(region, { x: 0, y: 0, width: 0.1, height: 0.1 });
  return image.crop({
    x: Math.max(0, Math.round(imageSize.width * safeRegion.x)),
    y: Math.max(0, Math.round(imageSize.height * safeRegion.y)),
    width: Math.max(1, Math.round(imageSize.width * safeRegion.width)),
    height: Math.max(1, Math.round(imageSize.height * safeRegion.height))
  });
}

function prepareForOcr(image, scale) {
  const size = image.getSize();
  const factor = clampNumber(scale, 3, 1, 6);
  return image.resize({
    width: Math.max(1, Math.round(size.width * factor)),
    height: Math.max(1, Math.round(size.height * factor)),
    quality: 'best'
  });
}

function updateStableRead(slot, value, requiredCount) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  if (slot.value === value) {
    slot.count += 1;
  } else {
    slot.value = value;
    slot.count = 1;
  }

  return slot.count >= requiredCount ? value : null;
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

function matchKnownCiv(text, civs) {
  const normalizedText = normalize(text);
  if (!normalizedText) {
    return null;
  }

  const candidates = civs.flatMap((civ) => {
    if (typeof civ === 'string') {
      return [{ name: civ, value: civ }];
    }

    return [civ.name, ...(civ.aliases || [])].map((value) => ({
      name: civ.name,
      value
    }));
  });

  const direct = candidates.find((candidate) => {
    const normalized = normalize(candidate.value);
    return normalized && normalizedText.includes(normalized);
  });

  if (direct) {
    return direct.name;
  }

  let best = { name: null, score: 0 };
  for (const candidate of candidates) {
    const normalized = normalize(candidate.value);
    if (!normalized) {
      continue;
    }

    const score = similarity(normalizedText, normalized);
    if (score > best.score) {
      best = { name: candidate.name, score };
    }
  }

  return best.score >= 0.72 ? best.name : null;
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z]/g, '');
}

function similarity(left, right) {
  const maxLength = Math.max(left.length, right.length);
  if (maxLength === 0) {
    return 1;
  }

  return 1 - levenshtein(left, right) / maxLength;
}

function levenshtein(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_value, index) => index);

  for (let i = 0; i < left.length; i += 1) {
    const current = [i + 1];
    for (let j = 0; j < right.length; j += 1) {
      const insert = current[j] + 1;
      const remove = previous[j + 1] + 1;
      const replace = previous[j] + (left[i] === right[j] ? 0 : 1);
      current.push(Math.min(insert, remove, replace));
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

module.exports = {
  Detector,
  isAoeRunning
};
