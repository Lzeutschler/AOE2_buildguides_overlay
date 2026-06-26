const { execFile } = require('node:child_process');
const { EventEmitter } = require('node:events');
const path = require('node:path');
const { promisify } = require('node:util');
const { Worker } = require('node:worker_threads');
const { createCaptureProvider, regionPercentToPixels } = require('./capture-provider');

const execFileAsync = promisify(execFile);

const AOE_PROCESS_NAMES = [
  'AoE2DE_s',
  'AoE2DE',
  'AoK HD',
  'age2_x1'
];
const PROCESS_CHECK_INTERVAL_MS = 2500;
const OCR_CAPTURE_MAX_WIDTH = 960;
const OCR_TIMEOUT_MS = 8000;
const MATCH_LOST_TIMEOUT_MS = 20000;

class Detector extends EventEmitter {
  constructor({ desktopCapturer, screen, nativeImage, civs = [] }) {
    super();
    this.desktopCapturer = desktopCapturer;
    this.screen = screen;
    this.captureProvider = createCaptureProvider({ nativeImage });
    this.civs = civs;
    this.timer = null;
    this.lastTickAt = 0;
    this.lastCivOcrAt = 0;
    this.lastTopBarAt = 0;
    this.lastProcessCheckAt = 0;
    this.lastVillagerHash = null;
    this.civLocked = false;
    this.cachedAoeRunning = false;
    this.ocrInProgress = false;
    this.ocrWorker = null;
    this.stableReads = {
      villager: { value: null, count: 0 },
      civ: { value: null, count: 0 }
    };
    this.state = {
      aoeRunning: false,
      inMatch: false,
      sessionStatus: 'Warte auf AOE2.',
      captureProvider: this.captureProvider.activeProvider,
      captureStats: createCaptureStats(this.captureProvider.activeProvider),
      detectionMode: 'ocr',
      civ: 'Generic',
      selectedDisplayId: null,
      ocr: {
        enabled: false,
        status: 'idle',
        lastText: '',
        lastError: '',
        intervalMs: 5000,
        civIntervalMs: 60000,
        captureProvider: 'auto',
        captureIntervalMs: 2500,
        startupProbeIntervalMs: 1000,
        civReadOnce: true,
        minConfidence: 55,
        stableReadCount: 2,
        imageScale: 1,
        topBarRegion: { x: 0, y: 0, width: 1, height: 0.075 },
        villagerRegion: { x: 0.265, y: 0.004, width: 0.04, height: 0.06 },
        civRegion: { x: 0.83, y: 0.006, width: 0.15, height: 0.065 }
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

    if (this.ocrWorker) {
      this.ocrWorker.dispose();
      this.ocrWorker = null;
    }
  }

  updateSettings(settings) {
    this.state = {
      ...this.state,
      ...settings,
      ocr: {
        ...this.state.ocr,
        ...(settings.ocr || {}),
        intervalMs: clampNumber(settings.ocr?.intervalMs, this.state.ocr.intervalMs, 5000, 20000),
        civIntervalMs: clampNumber(settings.ocr?.civIntervalMs, this.state.ocr.civIntervalMs, 15000, 300000),
        captureProvider: ['auto', 'node-screenshots'].includes(settings.ocr?.captureProvider)
          ? settings.ocr.captureProvider
          : this.state.ocr.captureProvider,
        captureIntervalMs: clampNumber(settings.ocr?.captureIntervalMs, this.state.ocr.captureIntervalMs, 1000, 10000),
        startupProbeIntervalMs: clampNumber(settings.ocr?.startupProbeIntervalMs, this.state.ocr.startupProbeIntervalMs, 500, 10000),
        civReadOnce: settings.ocr?.civReadOnce === undefined ? this.state.ocr.civReadOnce : Boolean(settings.ocr.civReadOnce),
        minConfidence: clampNumber(settings.ocr?.minConfidence, this.state.ocr.minConfidence, 0, 100),
        stableReadCount: clampNumber(settings.ocr?.stableReadCount, this.state.ocr.stableReadCount, 1, 5),
        imageScale: clampNumber(settings.ocr?.imageScale, this.state.ocr.imageScale, 1, 6),
        topBarRegion: normalizeRegion(settings.ocr?.topBarRegion, this.state.ocr.topBarRegion),
        villagerRegion: normalizeRegion(settings.ocr?.villagerRegion, this.state.ocr.villagerRegion),
        civRegion: normalizeRegion(settings.ocr?.civRegion, this.state.ocr.civRegion)
      }
    };
  }

  async tick() {
    const aoeRunning = await this.getAoeRunning();
    const nextState = {
      ...this.state,
      aoeRunning
    };

    if (!aoeRunning) {
      this.resetSession(nextState, 'Warte auf AOE2.');
    } else if (nextState.detectionMode === 'ocr' && !this.ocrInProgress && this.shouldRunOcr(this.getCaptureInterval(nextState))) {
      await this.runOcr(nextState);
    }

    if (nextState.inMatch && Date.now() - this.lastTopBarAt > MATCH_LOST_TIMEOUT_MS) {
      this.resetSession(nextState, 'Match-Erkennung verloren.');
    }

    nextState.captureProvider = this.captureProvider.activeProvider;
    this.state = nextState;
    this.emit('state', this.state);
  }

  async getAoeRunning() {
    const now = Date.now();
    if (now - this.lastProcessCheckAt < PROCESS_CHECK_INTERVAL_MS) {
      return this.cachedAoeRunning;
    }

    this.lastProcessCheckAt = now;
    this.cachedAoeRunning = await isAoeRunning();
    return this.cachedAoeRunning;
  }

  shouldRunOcr(intervalMs) {
    const now = Date.now();
    if (now - this.lastTickAt < intervalMs) {
      return false;
    }

    this.lastTickAt = now;
    return true;
  }

  getCaptureInterval(state) {
    return state.inMatch ? state.ocr.captureIntervalMs : state.ocr.startupProbeIntervalMs;
  }

  resetSession(nextState, status) {
    if (!nextState.inMatch && nextState.sessionStatus === status) {
      return;
    }

    nextState.inMatch = false;
    nextState.sessionStatus = status;
    nextState.ocr.status = nextState.aoeRunning ? 'idle' : 'idle';
    nextState.captureStats = createCaptureStats(this.captureProvider.activeProvider);
    nextState.captureProvider = this.captureProvider.activeProvider;
    this.lastVillagerHash = null;
    this.lastCivOcrAt = 0;
    this.lastTopBarAt = 0;
    this.civLocked = false;
    this.stableReads = {
      villager: { value: null, count: 0 },
      civ: { value: null, count: 0 }
    };
  }

  async runOcr(nextState) {
    if (!this.captureProvider.isAvailable()) {
      nextState.ocr.status = 'unavailable';
      nextState.ocr.lastError = 'Native Bildschirmaufnahme ist nicht verfuegbar.';
      nextState.sessionStatus = 'Native Bildschirmaufnahme fehlt.';
      return;
    }

    try {
      this.ocrInProgress = true;
      nextState.ocr.status = 'capturing';
      const read = await this.readCurrentFrame({
        forceCiv: false,
        forceVillager: !nextState.inMatch,
        includeImages: false
      });
      nextState.captureStats = updateCaptureStats(nextState.captureStats, read);
      nextState.captureProvider = read.provider;

      if (read.error) {
        nextState.ocr.status = read.status;
        nextState.ocr.lastError = read.error;
        nextState.sessionStatus = read.error;
        return;
      }

      const { villagerResult, civResult, villagerCount, detectedCiv, averageConfidence } = read;
      const villagerStable = villagerResult.skipped
        ? null
        : updateStableRead(this.stableReads.villager, villagerCount, nextState.ocr.stableReadCount);
      const civStable = civResult.skipped
        ? null
        : updateStableRead(this.stableReads.civ, detectedCiv, nextState.ocr.stableReadCount);
      const topBarDetected = read.topBarDetected || (nextState.inMatch && villagerResult.skipped);

      if (topBarDetected) {
        this.lastTopBarAt = Date.now();
      }

      if (!nextState.inMatch && villagerStable && villagerResult.confidence >= nextState.ocr.minConfidence) {
        nextState.inMatch = true;
        nextState.sessionStatus = 'Match erkannt.';
        this.lastTopBarAt = Date.now();
      } else if (!nextState.inMatch) {
        nextState.sessionStatus = 'AOE2 offen, warte auf Match-Leiste.';
      } else {
        nextState.sessionStatus = villagerResult.skipped ? 'Match erkannt, Ausschnitt unveraendert.' : 'Match erkannt.';
      }

      nextState.ocr.lastText = [villagerResult.text, civResult.text].map((item) => item.trim()).filter(Boolean).join(' | ');
      nextState.ocr.status = villagerResult.skipped ? 'unchanged' : Number.isFinite(villagerCount) || detectedCiv ? 'read' : 'uncertain';
      nextState.ocr.lastRead = {
        villagerCount: Number.isFinite(villagerCount) ? villagerCount : null,
        civ: detectedCiv,
        confidence: averageConfidence,
        stableVillagerCount: villagerStable,
        stableCiv: civStable,
        civSkipped: civResult.skipped,
        villagerSkipped: villagerResult.skipped,
        villagerHash: read.villagerHash
      };

      if (villagerStable && villagerResult.confidence >= nextState.ocr.minConfidence && villagerStable > 0 && villagerStable < 250) {
        nextState.villagerCount = villagerStable;
      }

      if (!civResult.skipped && civStable && civResult.confidence >= nextState.ocr.minConfidence) {
        nextState.civ = civStable;
        if (nextState.ocr.civReadOnce) {
          this.civLocked = true;
        }
      }
    } catch (error) {
      nextState.ocr.status = 'error';
      nextState.ocr.lastError = error.message;
      nextState.sessionStatus = error.message;
    } finally {
      this.ocrInProgress = false;
    }
  }

  async testOcr() {
    if (!this.desktopCapturer) {
      return {
        status: 'unavailable',
        error: 'OCR-Abhaengigkeiten sind nicht verfuegbar.'
      };
    }

    try {
      const read = await this.readCurrentFrame({ forceCiv: true, forceVillager: true, includeImages: true });
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
        topBarRegion: read.topBarImage,
        villagerRegion: read.villagerImage,
        civRegion: read.civImage
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

  async getScreenSource(display, options = {}) {
    const scaleFactor = display.scaleFactor || 1;
    const nativeWidth = Math.round(display.bounds.width * scaleFactor);
    const nativeHeight = Math.round(display.bounds.height * scaleFactor);
    const width = options.fullSize ? nativeWidth : Math.min(nativeWidth, OCR_CAPTURE_MAX_WIDTH);
    const height = Math.round(nativeHeight * (width / nativeWidth));
    const sources = await this.desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height }
    });

    return sources.find((source) => String(source.display_id) === String(display.id)) || sources[0];
  }

  async readCurrentFrame(options = {}) {
    const display = this.getSelectedDisplay();
    const frame = await this.captureProvider.captureFrame(display);
    const imageSize = { width: frame.width, height: frame.height };
    const topBarRegion = regionPercentToPixels(this.state.ocr.topBarRegion, imageSize);
    const villagerRegion = regionPercentToPixels(this.state.ocr.villagerRegion, imageSize);
    const civRegion = regionPercentToPixels(this.state.ocr.civRegion, imageSize);
    const villagerRaw = frame.cropRaw(villagerRegion);
    const villagerHash = hashBuffer(villagerRaw);
    const villagerChanged = villagerHash !== this.lastVillagerHash;
    const shouldReadVillager = options.forceVillager || villagerChanged;
    const shouldReadCiv = options.forceCiv || this.shouldRunCivOcr();
    const villagerResult = shouldReadVillager
      ? await this.recognize(frame.cropDataUrl(villagerRegion, this.state.ocr.imageScale), '0123456789')
      : { text: '', confidence: 0, skipped: true };

    if (shouldReadVillager) {
      this.lastVillagerHash = villagerHash;
    }

    const civResult = shouldReadCiv
      ? await this.recognize(frame.cropDataUrl(civRegion, this.state.ocr.imageScale), 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ')
      : { text: '', confidence: 0, skipped: true };
    const villagerCount = Number.parseInt(villagerResult.text.replace(/\D/g, ''), 10);
    const detectedCiv = civResult.skipped ? null : matchKnownCiv(civResult.text, this.civs);
    const averageConfidence = civResult.skipped
      ? Math.round(villagerResult.confidence)
      : Math.round((villagerResult.confidence + civResult.confidence) / 2);

    return {
      displayId: display.id,
      imageSize,
      provider: frame.provider,
      durationMs: frame.durationMs,
      topBarImage: options.includeImages ? frame.cropDataUrl(topBarRegion, 1) : '',
      villagerImage: options.includeImages ? frame.cropDataUrl(villagerRegion, 1) : '',
      civImage: options.includeImages ? frame.cropDataUrl(civRegion, 1) : '',
      villagerResult,
      civResult,
      villagerCount,
      detectedCiv,
      averageConfidence,
      villagerHash,
      topBarDetected: Number.isFinite(villagerCount) && villagerCount > 0 && villagerCount < 250
    };
  }

  shouldRunCivOcr() {
    if (this.state.ocr.civReadOnce && this.civLocked) {
      return false;
    }

    const now = Date.now();
    const interval = Math.min(this.state.ocr.civIntervalMs, 5000);
    if (now - this.lastCivOcrAt < interval) {
      return false;
    }

    this.lastCivOcrAt = now;
    return true;
  }

  async capturePreview() {
    const display = this.getSelectedDisplay();
    const source = await this.getScreenSource(display, { fullSize: true });

    if (!source || source.thumbnail.isEmpty()) {
      return {
        displayId: display.id,
        error: 'Es konnte kein Bildschirmbild aufgenommen werden.'
      };
    }

    const imageSize = source.thumbnail.getSize();
    const topBarImage = cropByPercent(source.thumbnail, imageSize, this.state.ocr.topBarRegion);
    const villagerImage = cropByPercent(source.thumbnail, imageSize, this.state.ocr.villagerRegion);
    const civImage = cropByPercent(source.thumbnail, imageSize, this.state.ocr.civRegion);

    return {
      displayId: display.id,
      imageSize,
      fullFrame: source.thumbnail.toDataURL(),
      topBarRegion: topBarImage.toDataURL(),
      villagerRegion: villagerImage.toDataURL(),
      civRegion: civImage.toDataURL()
    };
  }

  async recognize(dataUrl, whitelist) {
    if (!this.ocrWorker) {
      this.ocrWorker = new OcrWorkerClient();
    }

    return this.ocrWorker.recognize(dataUrl, whitelist);
  }
}

class OcrWorkerClient {
  constructor() {
    this.worker = null;
    this.nextId = 1;
    this.pending = new Map();
  }

  recognize(dataUrl, whitelist) {
    this.ensureWorker();
    const id = this.nextId;
    this.nextId += 1;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        this.restart();
        reject(new Error('OCR-Zeitlimit erreicht. Der OCR-Worker wurde neu gestartet.'));
      }, OCR_TIMEOUT_MS);

      this.pending.set(id, { resolve, reject, timeout });
      this.worker.postMessage({
        type: 'recognize',
        id,
        dataUrl,
        whitelist
      });
    });
  }

  ensureWorker() {
    if (this.worker) {
      return;
    }

    this.worker = new Worker(path.join(__dirname, 'ocr-worker-thread.js'));
    this.worker.on('message', (message) => this.handleMessage(message));
    this.worker.on('error', (error) => this.rejectAll(error));
    this.worker.on('exit', (code) => {
      if (code !== 0) {
        this.rejectAll(new Error(`OCR-Worker wurde mit Code ${code} beendet.`));
      }
      this.worker = null;
    });
  }

  handleMessage(message) {
    const pending = this.pending.get(message.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pending.delete(message.id);

    if (message.ok) {
      pending.resolve(message.result);
    } else {
      pending.reject(new Error(message.error || 'OCR-Worker fehlgeschlagen.'));
    }
  }

  rejectAll(error) {
    for (const [id, pending] of this.pending.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.pending.delete(id);
    }
  }

  restart() {
    if (this.worker) {
      this.worker.terminate().catch(() => {});
      this.worker = null;
    }
  }

  dispose() {
    this.rejectAll(new Error('OCR-Worker wurde beendet.'));
    this.restart();
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

function hashBuffer(buffer) {
  const data = Buffer.from(buffer);
  const step = Math.max(1, Math.floor(data.length / 4096));
  let hash = 2166136261;

  for (let index = 0; index < data.length; index += step) {
    hash ^= data[index];
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16);
}

function createCaptureStats(provider) {
  return {
    provider,
    samples: 0,
    lastCaptureMs: null,
    averageCaptureMs: null,
    maxCaptureMs: null
  };
}

function updateCaptureStats(previous, read) {
  const provider = read.provider || previous?.provider || 'unknown';
  const durationMs = Number(read.durationMs);
  if (!Number.isFinite(durationMs)) {
    return previous || createCaptureStats(provider);
  }

  const samples = (previous?.samples || 0) + 1;
  const previousAverage = Number.isFinite(previous?.averageCaptureMs) ? previous.averageCaptureMs : durationMs;
  const averageCaptureMs = Math.round(previousAverage + (durationMs - previousAverage) / samples);
  const maxCaptureMs = Math.max(previous?.maxCaptureMs || 0, durationMs);

  return {
    provider,
    samples,
    lastCaptureMs: durationMs,
    averageCaptureMs,
    maxCaptureMs
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
