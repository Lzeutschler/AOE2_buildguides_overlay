const { execFile } = require('node:child_process');
const { EventEmitter } = require('node:events');
const fs = require('node:fs/promises');
const path = require('node:path');
const { promisify } = require('node:util');
const { Worker } = require('node:worker_threads');
const { createCaptureProvider, regionPercentToPixels } = require('./capture-provider');
const { DEFAULT_OCR_SETTINGS, DIGIT_OCR_VARIANTS, RESOURCE_DIGIT_OCR_VARIANTS } = require('./ocr-defaults');
const { parseLoadingScreenText } = require('./loading-screen-parser');

const execFileAsync = promisify(execFile);

const AOE_PROCESS_NAMES = [
  'AoE2DE_s',
  'AoE2DE',
  'AoK HD',
  'age2_x1'
];
const PROCESS_CHECK_INTERVAL_MS = 2500;
const DETECTOR_TICK_INTERVAL_MS = 200;
const LOADING_SCREEN_PROBE_INTERVAL_MS = 250;
const LOADING_SCREEN_SNAPSHOT_INTERVAL_MS = 200;
const LOADING_SCREEN_SNAPSHOT_MATCH_GRACE_MS = 750;
const MAX_PENDING_LOADING_SCREEN_SNAPSHOTS = 6;
const OCR_CAPTURE_MAX_WIDTH = 960;
const OCR_TIMEOUT_MS = 8000;
const MATCH_LOST_TIMEOUT_MS = 20000;
const START_VILLAGERS_DEFAULT = 3;
// Civ-specific overrides are deferred for now (everyone defaults to 3).
const CIV_START_VILLAGERS = {};
const MAX_VILLAGER_COUNT = 200;
// Per-resource villager numbers (shown under each resource icon) are smaller; a
// generous cap still rejects OCR garbage such as a stockpile amount like "200".
const MAX_RESOURCE_VILLAGERS = 99;
const RESOURCE_KEYS = ['food', 'wood', 'gold', 'stone'];
// Slash is included so a population read like "9/15" can be split; we keep the
// integer before the slash (current population) via parseLeadingCount.
const VILLAGER_WHITELIST = '0123456789/';
const LOADING_SCREEN_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -';
const LOADING_SCREEN_OCR_VARIANTS = [
  { pageSegMode: '6', scale: 4, name: 'p6' },
  { pageSegMode: '11', scale: 5, name: 'p11' }
];
const VILLAGER_DIAG_THRESHOLDS = [110, 140, 150, 170, 180, 200];
const VILLAGER_DIAG_INVERTS = [true, false];
const VILLAGER_DIAG_PAGE_SEG_MODES = ['7', '13'];

class Detector extends EventEmitter {
  constructor({ desktopCapturer, screen, nativeImage, civilizations = [], loadingDebugDir = null }) {
    super();
    this.desktopCapturer = desktopCapturer;
    this.screen = screen;
    this.captureProvider = createCaptureProvider({ nativeImage });
    this.civilizations = civilizations;
    this.loadingDebugDir = loadingDebugDir;
    this.loadingDebugSaveInProgress = false;
    this.queuedLoadingDebug = null;
    this.timer = null;
    this.lastTickAt = 0;
    this.lastTopBarAt = 0;
    this.lastProcessCheckAt = 0;
    this.lastVillagerHash = null;
    this.cachedAoeRunning = false;
    this.ocrInProgress = false;
    this.ocrWorker = null;
    this.villagerModel = {
      value: START_VILLAGERS_DEFAULT,
      anchoredAt: 0,
      lastAcceptedAt: 0
    };
    this.lastEmittedVillagerCount = null;
    this.stableReads = {
      villager: { value: null, count: 0 }
    };
    this.state = {
      aoeRunning: false,
      inMatch: false,
      sessionStatus: 'Warte auf AOE2.',
      captureProvider: this.captureProvider.activeProvider,
      captureStats: createCaptureStats(this.captureProvider.activeProvider),
      detectionMode: 'ocr',
      civ: 'Generic',
      playerName: 'Testodines',
      selectedDisplayId: null,
      ocr: { ...DEFAULT_OCR_SETTINGS },
      loadingScreen: createEmptyLoadingScreen(),
      resourceVillagers: { food: null, wood: null, gold: null, stone: null }
    };
    this.lastResourceHashes = { food: null, wood: null, gold: null, stone: null };
    this.lastResourceVillagers = { food: null, wood: null, gold: null, stone: null };
    this.lastLoadingScreenHash = null;
    this.lastLoadingScreenRead = createEmptyLoadingScreen();
    this.lastLoadingScreenSnapshotAt = 0;
    this.loadingScreenSnapshotInProgress = false;
    this.pendingLoadingScreenSnapshots = [];
  }

  start() {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      this.tick().catch((error) => {
        this.emit('diagnostic', error.message);
      });
    }, DETECTOR_TICK_INTERVAL_MS);

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
        captureProvider: ['auto', 'node-screenshots'].includes(settings.ocr?.captureProvider)
          ? settings.ocr.captureProvider
          : this.state.ocr.captureProvider,
        captureIntervalMs: clampNumber(settings.ocr?.captureIntervalMs, this.state.ocr.captureIntervalMs, 1000, 10000),
        startupProbeIntervalMs: clampNumber(settings.ocr?.startupProbeIntervalMs, this.state.ocr.startupProbeIntervalMs, 250, 10000),
        minConfidence: clampNumber(settings.ocr?.minConfidence, this.state.ocr.minConfidence, 0, 100),
        stableReadCount: clampNumber(settings.ocr?.stableReadCount, this.state.ocr.stableReadCount, 1, 5),
        imageScale: clampNumber(settings.ocr?.imageScale, this.state.ocr.imageScale, 1, 6),
        topBarRegion: normalizeRegion(settings.ocr?.topBarRegion, this.state.ocr.topBarRegion),
        loadingScreenRegion: normalizeRegion(settings.ocr?.loadingScreenRegion, this.state.ocr.loadingScreenRegion),
        villagerRegion: normalizeRegion(settings.ocr?.villagerRegion, this.state.ocr.villagerRegion),
        foodVilRegion: normalizeRegion(settings.ocr?.foodVilRegion, this.state.ocr.foodVilRegion),
        woodVilRegion: normalizeRegion(settings.ocr?.woodVilRegion, this.state.ocr.woodVilRegion),
        goldVilRegion: normalizeRegion(settings.ocr?.goldVilRegion, this.state.ocr.goldVilRegion),
        stoneVilRegion: normalizeRegion(settings.ocr?.stoneVilRegion, this.state.ocr.stoneVilRegion)
      }
    };

    // A manual villager adjustment (overlay +/-) must win over the OCR model and
    // re-anchor it, so the next OCR cycle climbs from the value the user set. We
    // ignore the detector's own value being echoed back via syncDetectorSettings.
    if (
      Number.isFinite(settings.villagerCount)
      && settings.villagerCount !== this.villagerModel.value
      && settings.villagerCount !== this.lastEmittedVillagerCount
    ) {
      this.anchorVillagerModel(settings.villagerCount);
    }
  }

  anchorVillagerModel(value, now = Date.now()) {
    const safe = clampNumber(value, START_VILLAGERS_DEFAULT, 1, MAX_VILLAGER_COUNT);
    this.villagerModel = { value: safe, anchoredAt: now, lastAcceptedAt: now };
    return safe;
  }

  // Trust a stable, confident OCR read directly (up or down) within sane bounds.
  // The stable-read requirement (N consecutive identical reads) plus the small
  // calibration box are what guard against noise like reading "121" for "12".
  trustVillagerRead(read, ocrValue, isStable, minConfidence) {
    const model = this.villagerModel;

    if (!isStable || !Number.isFinite(ocrValue) || !isAcceptedDigitRead(read, minConfidence)) {
      return model.value;
    }

    if (ocrValue < 1 || ocrValue > MAX_VILLAGER_COUNT) {
      return model.value;
    }

    model.value = ocrValue;
    model.lastAcceptedAt = Date.now();
    return model.value;
  }

  // Accept per-resource villager reads that are confident and in range; keep the
  // last known value for skipped (unchanged) regions or rejected reads.
  applyResourceVillagers(reads, minConfidence) {
    const result = {};

    for (const key of RESOURCE_KEYS) {
      const read = reads?.[key];
      const previous = this.lastResourceVillagers[key];

      if (!read || read.skipped) {
        result[key] = previous;
        continue;
      }

      const value = read.count;
      const accept = Number.isFinite(value)
        && value >= 0
        && value <= MAX_RESOURCE_VILLAGERS
        && isAcceptedDigitRead(read, minConfidence);

      result[key] = accept ? value : previous;
    }

    this.lastResourceVillagers = result;
    return result;
  }

  async tick() {
    const aoeRunning = await this.getAoeRunning();
    const nextState = {
      ...this.state,
      aoeRunning
    };

    if (!aoeRunning) {
      this.resetSession(nextState, 'Warte auf AOE2.');
    } else if (nextState.detectionMode === 'ocr') {
      const captureInterval = this.getCaptureInterval(nextState);
      const ocrDue = this.isOcrDue(captureInterval);
      if ((this.ocrInProgress || !ocrDue) && this.shouldBufferLoadingScreenSnapshots(nextState)) {
        this.captureLoadingScreenSnapshotIfUseful(nextState).catch((error) => {
          this.emit('diagnostic', error.message);
        });
      }

      if (this.ocrInProgress) {
        // Snapshot capture above keeps a small buffer while the OCR worker is busy.
      } else if (this.shouldRunOcr(captureInterval)) {
        await this.runOcr(nextState);
      }
    }

    if (nextState.inMatch && Date.now() - this.lastTopBarAt > MATCH_LOST_TIMEOUT_MS) {
      this.resetSession(nextState, 'Match-Erkennung verloren.');
    }

    nextState.captureProvider = this.captureProvider.activeProvider;
    this.state = nextState;
    this.lastEmittedVillagerCount = Number.isFinite(nextState.villagerCount) ? nextState.villagerCount : this.lastEmittedVillagerCount;
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
    if (!this.isOcrDue(intervalMs)) {
      return false;
    }

    this.lastTickAt = Date.now();
    return true;
  }

  isOcrDue(intervalMs) {
    return Date.now() - this.lastTickAt >= intervalMs;
  }

  getCaptureInterval(state) {
    return state.inMatch
      ? state.ocr.captureIntervalMs
      : Math.min(state.ocr.startupProbeIntervalMs, LOADING_SCREEN_PROBE_INTERVAL_MS);
  }

  shouldBufferLoadingScreenSnapshots(state) {
    if (!state.aoeRunning || state.detectionMode !== 'ocr') {
      return false;
    }

    return !state.inMatch || Date.now() - this.lastTopBarAt > LOADING_SCREEN_SNAPSHOT_MATCH_GRACE_MS;
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
    this.lastTopBarAt = 0;
    this.anchorVillagerModel(getStartVillagers(nextState.civ));
    this.stableReads = {
      villager: { value: null, count: 0 }
    };
    this.lastResourceHashes = { food: null, wood: null, gold: null, stone: null };
    this.lastResourceVillagers = { food: null, wood: null, gold: null, stone: null };
    this.lastLoadingScreenHash = null;
    this.lastLoadingScreenRead = createEmptyLoadingScreen(status === 'Warte auf AOE2.' ? 'idle' : 'lost');
    this.pendingLoadingScreenSnapshots = [];
    this.lastLoadingScreenSnapshotAt = 0;
    this.loadingScreenSnapshotInProgress = false;
    nextState.loadingScreen = this.lastLoadingScreenRead;
    nextState.resourceVillagers = { food: null, wood: null, gold: null, stone: null };
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
        forceVillager: !nextState.inMatch,
        readLoadingScreen: !nextState.inMatch,
        readLoadingScreenOnNoTopBar: nextState.inMatch,
        readResources: nextState.inMatch,
        includeImages: false
      });
      const snapshotRead = read.loadingScreen?.status === 'detected'
        ? null
        : await this.readPendingLoadingScreenSnapshots();
      read.loadingScreen = pickBestLoadingScreenRead(read.loadingScreen, snapshotRead);
      nextState.captureStats = updateCaptureStats(nextState.captureStats, read);
      nextState.captureProvider = read.provider;

      if (read.error) {
        nextState.ocr.status = read.status;
        nextState.ocr.lastError = read.error;
        nextState.sessionStatus = read.error;
        return;
      }

      const { villagerResult, villagerCount, averageConfidence } = read;
      const villagerStable = villagerResult.skipped
        ? null
        : updateStableRead(this.stableReads.villager, villagerCount, nextState.ocr.stableReadCount);
      const topBarDetected = read.topBarDetected || (nextState.inMatch && villagerResult.skipped);

      if (topBarDetected) {
        this.lastTopBarAt = Date.now();
      }

      const isVillagerStable = villagerStable !== null && villagerStable !== undefined;

      const villagerAccepted = isAcceptedDigitRead(villagerResult, nextState.ocr.minConfidence);

      if (nextState.inMatch && !topBarDetected && read.loadingScreen?.status === 'detected') {
        nextState.inMatch = false;
        nextState.loadingScreen = read.loadingScreen;
        nextState.sessionStatus = 'Loading Screen erkannt.';
        if (read.loadingScreen.self?.civ) {
          nextState.civ = read.loadingScreen.self.civ;
        }
      } else if (!nextState.inMatch && isVillagerStable && villagerAccepted) {
        nextState.inMatch = true;
        nextState.sessionStatus = 'Match erkannt.';
        this.lastTopBarAt = Date.now();
      } else if (!nextState.inMatch) {
        nextState.sessionStatus = read.loadingScreen?.status === 'detected'
          ? 'Loading Screen erkannt.'
          : 'AOE2 offen, warte auf Match-Leiste.';
      } else {
        nextState.sessionStatus = villagerResult.skipped ? 'Match erkannt, Ausschnitt unveraendert.' : 'Match erkannt.';
      }

      nextState.ocr.lastText = (villagerResult.text || '').trim();
      nextState.ocr.status = villagerResult.skipped ? 'unchanged' : Number.isFinite(villagerCount) ? 'read' : 'uncertain';
      nextState.ocr.lastRead = {
        villagerCount: Number.isFinite(villagerCount) ? villagerCount : null,
        confidence: averageConfidence,
        stableVillagerCount: villagerStable,
        villagerSkipped: villagerResult.skipped,
        villagerHash: read.villagerHash
      };

      if (nextState.inMatch) {
        nextState.villagerCount = villagerResult.skipped
          ? this.villagerModel.value
          : this.trustVillagerRead(
            villagerResult,
            villagerCount,
            isVillagerStable,
            nextState.ocr.minConfidence
          );
        nextState.resourceVillagers = this.applyResourceVillagers(read.resourceVillagers, nextState.ocr.minConfidence);
      } else if (read.loadingScreen) {
        nextState.loadingScreen = read.loadingScreen;
        if (read.loadingScreen.self?.civ) {
          nextState.civ = read.loadingScreen.self.civ;
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
    if (!this.captureProvider.isAvailable()) {
      return {
        status: 'unavailable',
        error: 'Native Bildschirmaufnahme ist nicht verfuegbar.'
      };
    }

    try {
      const display = this.getSelectedDisplay();
      const frame = await this.captureProvider.captureFrame(display);
      const imageSize = { width: frame.width, height: frame.height };
      const topBarRegion = regionPercentToPixels(this.state.ocr.topBarRegion, imageSize);
      const loadingScreenRegion = regionPercentToPixels(this.state.ocr.loadingScreenRegion, imageSize);
      const villagerRegion = regionPercentToPixels(this.state.ocr.villagerRegion, imageSize);

      const variants = await this.diagnoseVillager(frame, villagerRegion);
      const best = variants[0] || { text: '', digits: null, confidence: 0, image: '' };

      const villagerCount = Number.isFinite(best.count) ? best.count : parseLeadingCount(best.text);
      const loadingScreen = await this.readLoadingScreen(frame, imageSize);

      const resources = {};
      for (const key of RESOURCE_KEYS) {
        const region = regionPercentToPixels(this.state.ocr[`${key}VilRegion`], imageSize);
        const processed = frame.cropDataUrl(region, this.state.ocr.imageScale, { binarize: true, invert: false });
        const ocr = await this.recognizeDigitRegion(frame, region, {
          emptyAsZero: true,
          maxCount: MAX_RESOURCE_VILLAGERS,
          preferHigherOnTie: true,
          variants: RESOURCE_DIGIT_OCR_VARIANTS
        });
        const count = Number.isFinite(ocr.count) ? ocr.count : parseLeadingCount(ocr.text);
        resources[key] = {
          raw: frame.cropDataUrl(region, 1),
          processed,
          text: (ocr.text || '').trim(),
          count: Number.isFinite(count) ? count : null,
          confidence: Math.round(ocr.confidence)
        };
      }

      return {
        status: Number.isFinite(villagerCount) ? 'read' : 'uncertain',
        displayId: display.id,
        imageSize,
        villagerText: (best.text || '').trim(),
        villagerCount: Number.isFinite(villagerCount) ? villagerCount : null,
        confidence: Math.round(best.confidence),
        villagerConfidence: Math.round(best.confidence),
        topBarRegion: frame.cropDataUrl(topBarRegion, 1),
        loadingScreenRegion: frame.cropDataUrl(loadingScreenRegion, 1),
        loadingScreen,
        villagerRegion: frame.cropDataUrl(villagerRegion, 1),
        villagerProcessed: best.image,
        villagerVariants: variants,
        resources
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  async diagnoseVillager(frame, villagerRegion) {
    const variants = [];

    for (const pageSegMode of VILLAGER_DIAG_PAGE_SEG_MODES) {
      for (const invert of VILLAGER_DIAG_INVERTS) {
        for (const threshold of VILLAGER_DIAG_THRESHOLDS) {
          const image = frame.cropDataUrl(villagerRegion, this.state.ocr.imageScale, { binarize: true, threshold, invert });
          const result = await this.recognize(image, VILLAGER_WHITELIST, { pageSegMode });
          const count = parseLeadingCount(result.text);
          variants.push({
            label: `psm ${pageSegMode} / thr ${threshold} / ${invert ? 'invertiert' : 'direkt'}`,
            threshold,
            invert,
            pageSegMode,
            text: (result.text || '').trim(),
            digits: Number.isFinite(count) ? count : null,
            confidence: Math.round(result.confidence),
            image
          });
        }
      }
    }

    // Best first: prefer variants that produced a usable number, then confidence.
    variants.sort((a, b) => {
      const aHas = a.digits !== null ? 1 : 0;
      const bHas = b.digits !== null ? 1 : 0;
      if (aHas !== bHas) {
        return bHas - aHas;
      }
      return b.confidence - a.confidence;
    });

    return variants;
  }

  async recognizeDigitRegion(frame, region, options = {}) {
    const variants = [];

    for (const variant of options.variants || DIGIT_OCR_VARIANTS) {
      const image = frame.cropDataUrl(region, variant.scale || this.state.ocr.imageScale, {
        binarize: true,
        threshold: variant.threshold,
        invert: variant.invert
      });
      const result = await this.recognize(image, VILLAGER_WHITELIST, {
        pageSegMode: variant.pageSegMode
      });
      const count = parseLeadingCount(result.text);
      variants.push({
        text: (result.text || '').trim(),
        count: Number.isFinite(count) ? count : null,
        confidence: Math.round(result.confidence)
      });
    }

    return chooseDigitRead(variants, options);
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
    let loadingScreen = null;

    if (options.readLoadingScreen) {
      loadingScreen = await this.readLoadingScreen(frame, imageSize);
      if (loadingScreen?.status === 'detected') {
        return {
          displayId: display.id,
          imageSize,
          provider: frame.provider,
          durationMs: frame.durationMs,
          topBarImage: options.includeImages ? frame.cropDataUrl(topBarRegion, 1) : '',
          villagerImage: options.includeImages ? frame.cropDataUrl(villagerRegion, 1) : '',
          villagerResult: { text: '', confidence: 0, skipped: true },
          villagerCount: NaN,
          averageConfidence: 0,
          villagerHash: null,
          resourceVillagers: null,
          loadingScreen,
          topBarDetected: false
        };
      }
    }

    const villagerRaw = frame.cropRaw(villagerRegion);
    const villagerHash = hashBuffer(villagerRaw);
    const villagerChanged = villagerHash !== this.lastVillagerHash;
    const villagerNeedsStableSample = this.stableReads.villager.count > 0
      && this.stableReads.villager.count < this.state.ocr.stableReadCount;
    const shouldReadVillager = options.forceVillager || villagerChanged || villagerNeedsStableSample;
    const villagerResult = shouldReadVillager
      ? await this.recognizeDigitRegion(frame, villagerRegion)
      : { text: '', confidence: 0, skipped: true };

    if (shouldReadVillager) {
      this.lastVillagerHash = villagerHash;
    }

    const villagerCount = Number.isFinite(villagerResult.count)
      ? villagerResult.count
      : parseLeadingCount(villagerResult.text);
    const averageConfidence = Math.round(villagerResult.confidence);
    const topBarDetected = Number.isFinite(villagerCount) && villagerCount > 0 && villagerCount < 250;
    const resourceVillagers = options.readResources
      ? await this.readResourceVillagers(frame, imageSize, options.forceResources)
      : null;
    if (!loadingScreen && options.readLoadingScreenOnNoTopBar && !topBarDetected) {
      loadingScreen = await this.readLoadingScreen(frame, imageSize);
    }

    return {
      displayId: display.id,
      imageSize,
      provider: frame.provider,
      durationMs: frame.durationMs,
      topBarImage: options.includeImages ? frame.cropDataUrl(topBarRegion, 1) : '',
      villagerImage: options.includeImages ? frame.cropDataUrl(villagerRegion, 1) : '',
      villagerResult,
      villagerCount,
      averageConfidence,
      villagerHash,
      resourceVillagers,
      loadingScreen,
      topBarDetected
    };
  }

  async readLoadingScreen(frame, imageSize) {
    const region = regionPercentToPixels(this.state.ocr.loadingScreenRegion, imageSize);
    const hash = hashBuffer(frame.cropRaw(region));
    if (hash === this.lastLoadingScreenHash && this.lastLoadingScreenRead) {
      return {
        ...this.lastLoadingScreenRead,
        skipped: true,
        lastReadAt: Date.now()
      };
    }

    this.lastLoadingScreenHash = hash;
    const parsed = await this.recognizeLoadingScreenImages(
      this.createLoadingScreenImages(frame, region),
      { source: 'live' }
    );

    this.lastLoadingScreenRead = parsed;
    return parsed;
  }

  createLoadingScreenImages(frame, region) {
    return LOADING_SCREEN_OCR_VARIANTS.map((variant) => ({
      ...variant,
      image: frame.cropDataUrl(region, variant.scale)
    }));
  }

  async recognizeLoadingScreenImages(images, options = {}) {
    let bestRead = null;
    let bestImage = null;

    for (const variant of images) {
      const ocr = await this.recognize(variant.image, LOADING_SCREEN_WHITELIST, {
        pageSegMode: variant.pageSegMode
      });
      const parsed = parseLoadingScreenText(ocr.text, {
        civilizations: this.civilizations,
        playerName: this.state.playerName,
        confidence: ocr.confidence,
        capturedAt: options.capturedAt,
        source: `${options.source || 'live'}:${variant.name}`
      });

      const previousBest = bestRead;
      bestRead = pickBestLoadingScreenRead(bestRead, parsed);
      if (bestRead !== previousBest) {
        bestImage = variant.image;
      }
      if (parsed.status === 'detected') {
        this.queueLoadingScreenDebug(parsed, variant.image);
        return parsed;
      }
    }

    this.queueLoadingScreenDebug(bestRead, bestImage);
    return bestRead;
  }

  queueLoadingScreenDebug(read, imageDataUrl) {
    if (!this.loadingDebugDir || !read || !imageDataUrl) {
      return;
    }

    const rawText = String(read.rawText || '').trim();
    if (read.status !== 'detected' && rawText.length < 4) {
      return;
    }

    const payload = { read, imageDataUrl };
    if (this.loadingDebugSaveInProgress) {
      this.queuedLoadingDebug = payload;
      return;
    }

    this.saveLoadingScreenDebug(payload).catch((error) => {
      this.emit('diagnostic', `Loading-Screen-Debug konnte nicht gespeichert werden: ${error.message}`);
    });
  }

  async saveLoadingScreenDebug(payload) {
    this.loadingDebugSaveInProgress = true;
    try {
      await fs.mkdir(this.loadingDebugDir, { recursive: true });
      await Promise.all([
        fs.writeFile(
          path.join(this.loadingDebugDir, 'last-loading-screen.json'),
          `${JSON.stringify(payload.read, null, 2)}\n`,
          'utf8'
        ),
        fs.writeFile(
          path.join(this.loadingDebugDir, 'last-loading-screen.png'),
          dataUrlToBuffer(payload.imageDataUrl)
        )
      ]);
    } finally {
      this.loadingDebugSaveInProgress = false;
    }

    if (this.queuedLoadingDebug) {
      const next = this.queuedLoadingDebug;
      this.queuedLoadingDebug = null;
      this.queueLoadingScreenDebug(next.read, next.imageDataUrl);
    }
  }

  async captureLoadingScreenSnapshotIfUseful(state) {
    if (!this.captureProvider.isAvailable() || this.loadingScreenSnapshotInProgress) {
      return;
    }

    const now = Date.now();
    if (now - this.lastLoadingScreenSnapshotAt < LOADING_SCREEN_SNAPSHOT_INTERVAL_MS) {
      return;
    }

    if (state.inMatch && now - this.lastTopBarAt < LOADING_SCREEN_SNAPSHOT_MATCH_GRACE_MS) {
      return;
    }

    this.lastLoadingScreenSnapshotAt = now;
    this.loadingScreenSnapshotInProgress = true;
    try {
      const display = this.getSelectedDisplay();
      const frame = await this.captureProvider.captureFrame(display);
      const imageSize = { width: frame.width, height: frame.height };
      const region = regionPercentToPixels(this.state.ocr.loadingScreenRegion, imageSize);
      const hash = hashBuffer(frame.cropRaw(region));
      if (this.pendingLoadingScreenSnapshots.some((snapshot) => snapshot.hash === hash)) {
        return;
      }

      this.pendingLoadingScreenSnapshots.push({
        hash,
        capturedAt: now,
        images: this.createLoadingScreenImages(frame, region),
        imageSize,
        provider: frame.provider,
        durationMs: frame.durationMs
      });
      this.pendingLoadingScreenSnapshots = this.pendingLoadingScreenSnapshots.slice(-MAX_PENDING_LOADING_SCREEN_SNAPSHOTS);
    } finally {
      this.loadingScreenSnapshotInProgress = false;
    }
  }

  async readPendingLoadingScreenSnapshots() {
    if (this.pendingLoadingScreenSnapshots.length === 0) {
      return null;
    }

    const snapshots = this.pendingLoadingScreenSnapshots.splice(0);
    let bestRead = null;
    for (const snapshot of snapshots.reverse()) {
      const parsed = await this.recognizeLoadingScreenImages(snapshot.images || [{
        image: snapshot.image,
        pageSegMode: '6',
        name: 'p6'
      }], {
        capturedAt: snapshot.capturedAt,
        source: 'snapshot'
      });
      if (parsed.status === 'detected') {
        this.lastLoadingScreenHash = snapshot.hash;
        this.lastLoadingScreenRead = parsed;
        return parsed;
      }

      bestRead = pickBestLoadingScreenRead(bestRead, parsed);
    }

    if (bestRead) {
      this.lastLoadingScreenRead = bestRead;
    }

    return bestRead;
  }

  async readResourceVillagers(frame, imageSize, force = false) {
    const result = {};

    for (const key of RESOURCE_KEYS) {
      const region = regionPercentToPixels(this.state.ocr[`${key}VilRegion`], imageSize);
      const hash = hashBuffer(frame.cropRaw(region));
      const changed = hash !== this.lastResourceHashes[key];

      if (!force && !changed) {
        result[key] = { count: null, confidence: 0, skipped: true };
        continue;
      }

      this.lastResourceHashes[key] = hash;
      const ocr = await this.recognizeDigitRegion(frame, region, {
        emptyAsZero: true,
        maxCount: MAX_RESOURCE_VILLAGERS,
        preferHigherOnTie: true,
        variants: RESOURCE_DIGIT_OCR_VARIANTS
      });
      const count = Number.isFinite(ocr.count) ? ocr.count : parseLeadingCount(ocr.text);
      result[key] = {
        count: Number.isFinite(count) ? count : null,
        confidence: Math.round(ocr.confidence),
        text: (ocr.text || '').trim(),
        skipped: false
      };
    }

    return result;
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
    const loadingScreenImage = cropByPercent(source.thumbnail, imageSize, this.state.ocr.loadingScreenRegion);
    const villagerImage = cropByPercent(source.thumbnail, imageSize, this.state.ocr.villagerRegion);

    return {
      displayId: display.id,
      imageSize,
      fullFrame: source.thumbnail.toDataURL(),
      topBarRegion: topBarImage.toDataURL(),
      loadingScreenRegion: loadingScreenImage.toDataURL(),
      villagerRegion: villagerImage.toDataURL()
    };
  }

  async recognize(dataUrl, whitelist, options = {}) {
    if (!this.ocrWorker) {
      this.ocrWorker = new OcrWorkerClient();
    }

    return this.ocrWorker.recognize(dataUrl, whitelist, options);
  }
}

class OcrWorkerClient {
  constructor() {
    this.worker = null;
    this.nextId = 1;
    this.pending = new Map();
  }

  recognize(dataUrl, whitelist, options = {}) {
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
        whitelist,
        pageSegMode: options.pageSegMode
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

function chooseDigitRead(variants, options = {}) {
  const groups = new Map();

  for (const variant of variants) {
    if (!Number.isFinite(variant.count) || (Number.isFinite(options.maxCount) && variant.count > options.maxCount)) {
      continue;
    }

    const group = groups.get(variant.count) || {
      count: variant.count,
      votes: 0,
      confidence: 0,
      text: variant.text
    };
    group.votes += 1;
    if (variant.confidence >= group.confidence) {
      group.confidence = variant.confidence;
      group.text = variant.text;
    }
    groups.set(variant.count, group);
  }

  if (groups.size === 0) {
    return options.emptyAsZero
      ? { text: '0', count: 0, confidence: 0, votes: 0 }
      : { text: '', confidence: 0 };
  }

  const winner = [...groups.values()].sort((a, b) => {
    if (a.votes !== b.votes) {
      return b.votes - a.votes;
    }
    if (options.preferHigherOnTie && a.count !== b.count) {
      return b.count - a.count;
    }
    return b.confidence - a.confidence;
  })[0];

  if (options.emptyAsZero && winner.votes < 2 && winner.confidence <= 0) {
    return { text: '0', count: 0, confidence: 0, votes: 0 };
  }

  return winner;
}

function isAcceptedDigitRead(read, minConfidence) {
  if (!read || !Number.isFinite(read.count)) {
    return false;
  }

  return read.confidence >= minConfidence || read.votes >= 2;
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

function pickBestLoadingScreenRead(left, right) {
  if (!left) {
    return right || null;
  }
  if (!right) {
    return left;
  }

  return scoreLoadingScreenRead(right) > scoreLoadingScreenRead(left) ? right : left;
}

function scoreLoadingScreenRead(read) {
  if (!read) {
    return -1;
  }

  const rawText = String(read.rawText || '');
  const playerCount = Array.isArray(read.players) ? read.players.length : 0;
  const enemyCount = Array.isArray(read.enemies) ? read.enemies.length : 0;
  const detectedScore = read.status === 'detected' ? 10000 : 0;
  const teamScore = /\bTEAM\b/i.test(rawText) || /KEIN\s*TEAM/i.test(rawText) ? 100 : 0;
  const sourceScore = String(read.source || '').startsWith('snapshot') ? 10 : 0;

  return detectedScore
    + teamScore
    + playerCount * 250
    + enemyCount * 50
    + sourceScore
    + Math.min(rawText.trim().length, 200);
}

function dataUrlToBuffer(dataUrl) {
  const text = String(dataUrl || '');
  const commaIndex = text.indexOf(',');
  const payload = commaIndex >= 0 ? text.slice(commaIndex + 1) : text;
  return Buffer.from(payload, 'base64');
}

function createEmptyLoadingScreen(status = 'idle') {
  return {
    status,
    rawText: '',
    players: [],
    self: null,
    enemies: [],
    confidence: null,
    source: null,
    capturedAt: null,
    lastReadAt: null
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

function getStartVillagers(civ) {
  const value = CIV_START_VILLAGERS[civ];
  return Number.isFinite(value) ? value : START_VILLAGERS_DEFAULT;
}

// Population is shown as "current/cap" (e.g. "9/15"); keep the integer before
// the slash. Falls back to the first digit group anywhere in the text.
function parseLeadingCount(text) {
  const cleaned = String(text || '');
  const beforeSlash = cleaned.split('/')[0];
  const compact = beforeSlash.replace(/\D/g, '');
  if (compact) {
    if (compact.length > 1 && compact.startsWith('0')) {
      return 0;
    }

    return Number.parseInt(compact, 10);
  }

  const match = cleaned.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : NaN;
}

module.exports = {
  Detector,
  isAoeRunning,
  getStartVillagers
};
