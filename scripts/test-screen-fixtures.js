// Offline screen-placement fixture test.
//
// Uses the saved 2560x1440 screenshots in manuel_testing/ to lock the default
// OCR regions to this machine/resolution. Run with:
//   npm run test:screenshots

const path = require('node:path');
const { Worker } = require('node:worker_threads');
const { app, nativeImage } = require('electron');
const { preprocessDigits } = require('../src/main/capture-provider');
const { DEFAULT_OCR_REGIONS, DIGIT_OCR_VARIANTS } = require('../src/main/ocr-defaults');

const PROJECT_ROOT = path.join(__dirname, '..');
const SCREENSHOT_DIR = path.join(PROJECT_ROOT, 'manuel_testing');
const WORKER_PATH = path.join(PROJECT_ROOT, 'src', 'main', 'ocr-worker-thread.js');
const DIGIT_WHITELIST = '0123456789/';

const FIXTURES = [
  { file: '20260626181404_1.jpg', villagers: 3, food: null },
  { file: '20260626181432_1.jpg', villagers: 4, food: 3 },
  { file: '20260626181454_1.jpg', villagers: 5, food: 5 },
  { file: '20260626181509_1.jpg', villagers: 6, food: 6 },
  { file: '20260626181525_1.jpg', villagers: 7, food: 7 }
];

const EXPECTED_PIXELS_2560 = {
  villagerRegion: { x: 573, y: 42, width: 46, height: 32 },
  woodVilRegion: { x: 36, y: 43, width: 38, height: 27 },
  foodVilRegion: { x: 187, y: 43, width: 38, height: 27 },
  goldVilRegion: { x: 328, y: 43, width: 38, height: 27 },
  stoneVilRegion: { x: 468, y: 43, width: 38, height: 27 }
};

async function main() {
  const ocr = new WorkerClient(WORKER_PATH);
  let failures = 0;

  try {
    for (const fixture of FIXTURES) {
      const image = nativeImage.createFromPath(path.join(SCREENSHOT_DIR, fixture.file));
      if (image.isEmpty()) {
        throw new Error(`${fixture.file}: Bild konnte nicht geladen werden.`);
      }

      const size = image.getSize();
      assertEqual(`${fixture.file} width`, size.width, 2560);
      assertEqual(`${fixture.file} height`, size.height, 1440);
      assertPixelRegions(size);

      const villagers = await recognizeRegion(image, DEFAULT_OCR_REGIONS.villagerRegion, ocr);
      failures += reportRead(fixture.file, 'villagers', villagers, fixture.villagers);

      if (Number.isFinite(fixture.food)) {
        const food = await recognizeRegion(image, DEFAULT_OCR_REGIONS.foodVilRegion, ocr);
        failures += reportRead(fixture.file, 'food', food, fixture.food);
      }
    }
  } finally {
    await ocr.dispose();
  }

  if (failures > 0) {
    throw new Error(`${failures} Screenshot-Fixture-Pruefung(en) fehlgeschlagen.`);
  }

  console.log('Screenshot-Fixtures OK: OCR-Regionen passen fuer 2560x1440.');
}

async function recognizeRegion(image, region, ocr) {
  const variants = [];
  const crop = image.crop(regionToPixels(region, image.getSize()));

  for (const variant of DIGIT_OCR_VARIANTS) {
    const dataUrl = preprocessDigits(nativeImage, crop, {
      scale: variant.scale,
      threshold: variant.threshold,
      invert: variant.invert
    });
    const result = await ocr.recognize(dataUrl, DIGIT_WHITELIST, variant.pageSegMode);
    const count = parseLeadingCount(result.text);
    variants.push({
      text: (result.text || '').trim(),
      count: Number.isFinite(count) ? count : null,
      confidence: Math.round(result.confidence),
      variant
    });
  }

  return chooseDigitRead(variants);
}

function reportRead(file, label, read, expected) {
  if (read.count === expected) {
    console.log(`${file} ${label}: ${read.count} OK (${read.confidence})`);
    return 0;
  }

  console.error(`${file} ${label}: erwartet ${expected}, gelesen ${read.count ?? '-'} aus "${read.text || '-'}" (${read.confidence})`);
  return 1;
}

function assertPixelRegions(size) {
  for (const [name, expected] of Object.entries(EXPECTED_PIXELS_2560)) {
    const actual = regionToPixels(DEFAULT_OCR_REGIONS[name], size);
    assertEqual(`${name}.x`, actual.x, expected.x);
    assertEqual(`${name}.y`, actual.y, expected.y);
    assertEqual(`${name}.width`, actual.width, expected.width);
    assertEqual(`${name}.height`, actual.height, expected.height);
  }
}

function regionToPixels(region, size) {
  return {
    x: Math.round(size.width * region.x),
    y: Math.round(size.height * region.y),
    width: Math.round(size.width * region.width),
    height: Math.round(size.height * region.height)
  };
}

function assertEqual(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label}: erwartet ${expected}, bekommen ${actual}`);
  }
}

function parseLeadingCount(text) {
  const cleaned = String(text || '');
  const beforeSlash = cleaned.split('/')[0];
  const match = beforeSlash.match(/\d+/) || cleaned.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : NaN;
}

function chooseDigitRead(variants) {
  const groups = new Map();

  for (const variant of variants) {
    if (!Number.isFinite(variant.count)) {
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
    return { text: '', count: null, confidence: 0 };
  }

  return [...groups.values()].sort((a, b) => {
    if (a.votes !== b.votes) {
      return b.votes - a.votes;
    }
    return b.confidence - a.confidence;
  })[0];
}

class WorkerClient {
  constructor(workerPath) {
    this.worker = new Worker(workerPath);
    this.nextId = 1;
    this.pending = new Map();
    this.worker.on('message', (message) => {
      const entry = this.pending.get(message.id);
      if (!entry) {
        return;
      }
      this.pending.delete(message.id);
      if (message.ok) {
        entry.resolve(message.result);
      } else {
        entry.reject(new Error(message.error || 'OCR fehlgeschlagen.'));
      }
    });
    this.worker.on('error', (error) => {
      for (const entry of this.pending.values()) {
        entry.reject(error);
      }
      this.pending.clear();
    });
  }

  recognize(dataUrl, whitelist, pageSegMode) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ type: 'recognize', id, dataUrl, whitelist, pageSegMode });
    });
  }

  async dispose() {
    await this.worker.terminate();
  }
}

app.whenReady()
  .then(() => main())
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    app.quit();
  });
