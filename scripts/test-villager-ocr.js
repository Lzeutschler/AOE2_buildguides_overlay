// Offline villager OCR harness.
//
// Runs the exact OCR worker (src/main/ocr-worker-thread.js) and the live digit
// preprocessing (src/main/capture-provider.js) against the saved screenshots in
// manuel_testing/ so we can tune region / scale / threshold without launching a
// game. Must run under Electron because the preprocessing relies on nativeImage.
//
// Usage (from project root):
//   npm run test:villager
//   npm run test:villager -- --file "manuel_testing/Screenshot 2026-06-26 135425.png"
//   npm run test:villager -- --region 0.265,0.004,0.04,0.06 --scale 4 --threshold 150
//
// Region values are screen-relative percentages (x,y,width,height), matching the
// live villagerRegion setting. Processed crops are written to manuel_testing/out/.

const path = require('node:path');
const fs = require('node:fs');
const { Worker } = require('node:worker_threads');
const { app, nativeImage } = require('electron');
const { preprocessDigits, DEFAULT_DIGIT_THRESHOLD } = require('../src/main/capture-provider');

const PROJECT_ROOT = path.join(__dirname, '..');
const SCREENSHOT_DIR = path.join(PROJECT_ROOT, 'manuel_testing');
const OUTPUT_DIR = path.join(SCREENSHOT_DIR, 'out');
const WORKER_PATH = path.join(PROJECT_ROOT, 'src', 'main', 'ocr-worker-thread.js');
const DIGIT_WHITELIST = '0123456789';

const DEFAULT_REGION = { x: 0.265, y: 0.004, width: 0.04, height: 0.06 };
const DEFAULT_SCALES = [3, 4, 5];
const DEFAULT_THRESHOLDS = [120, 150, 180];

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const files = options.file
    ? [resolveFile(options.file)]
    : listScreenshots();

  if (files.length === 0) {
    console.log(`Keine PNG-Screenshots in ${SCREENSHOT_DIR} gefunden.`);
    return;
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const region = options.region || DEFAULT_REGION;
  const scales = options.scale ? [options.scale] : DEFAULT_SCALES;
  const thresholds = options.threshold ? [options.threshold] : DEFAULT_THRESHOLDS;
  const inverts = options.invert === undefined ? [true, false] : [options.invert];

  const ocr = new WorkerClient(WORKER_PATH);

  try {
    for (const file of files) {
      await processFile({ file, region, scales, thresholds, inverts, ocr });
    }
  } finally {
    await ocr.dispose();
  }
}

async function processFile({ file, region, scales, thresholds, inverts, ocr }) {
  const image = nativeImage.createFromPath(file);
  if (image.isEmpty()) {
    console.log(`\n${path.basename(file)}: konnte Bild nicht laden.`);
    return;
  }

  const size = image.getSize();
  const pixelRegion = regionToPixels(region, size);
  const crop = image.crop(pixelRegion);

  console.log(`\n=== ${path.basename(file)} (${size.width}x${size.height}) ===`);
  console.log(`Region px: x=${pixelRegion.x} y=${pixelRegion.y} w=${pixelRegion.width} h=${pixelRegion.height}`);

  const rows = [];
  for (const invert of inverts) {
    for (const scale of scales) {
      for (const threshold of thresholds) {
        const dataUrl = preprocessDigits(nativeImage, crop, { scale, threshold, invert });
        const result = await ocr.recognize(dataUrl, DIGIT_WHITELIST);
        const digits = (result.text || '').replace(/\D/g, '');
        const outName = `${path.parse(file).name}_s${scale}_t${threshold}_${invert ? 'inv' : 'pos'}.png`;
        saveDataUrl(dataUrl, path.join(OUTPUT_DIR, outName));
        rows.push({
          variant: `scale=${scale} thr=${threshold} ${invert ? 'invert' : 'direct'}`,
          digits: digits || '-',
          confidence: Math.round(result.confidence)
        });
      }
    }
  }

  rows.sort((a, b) => b.confidence - a.confidence);
  for (const row of rows) {
    console.log(`  ${row.variant.padEnd(34)} -> "${row.digits}" (conf ${row.confidence})`);
  }
  console.log(`  Verarbeitete Ausschnitte: ${OUTPUT_DIR}`);
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

  recognize(dataUrl, whitelist) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ type: 'recognize', id, dataUrl, whitelist });
    });
  }

  async dispose() {
    await this.worker.terminate();
  }
}

function listScreenshots() {
  try {
    return fs.readdirSync(SCREENSHOT_DIR)
      .filter((name) => name.toLowerCase().endsWith('.png'))
      .map((name) => path.join(SCREENSHOT_DIR, name));
  } catch {
    return [];
  }
}

function resolveFile(file) {
  return path.isAbsolute(file) ? file : path.join(PROJECT_ROOT, file);
}

function regionToPixels(region, size) {
  const x = clamp(Math.round(size.width * region.x), 0, Math.max(0, size.width - 1));
  const y = clamp(Math.round(size.height * region.y), 0, Math.max(0, size.height - 1));
  const width = clamp(Math.round(size.width * region.width), 1, size.width - x);
  const height = clamp(Math.round(size.height * region.height), 1, size.height - y);
  return { x, y, width, height };
}

function saveDataUrl(dataUrl, filePath) {
  const base64 = dataUrl.split(',')[1] || '';
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === '--file' && next) {
      options.file = next;
      index += 1;
    } else if (arg === '--region' && next) {
      const parts = next.split(',').map(Number);
      if (parts.length === 4 && parts.every(Number.isFinite)) {
        options.region = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
      }
      index += 1;
    } else if (arg === '--scale' && next) {
      options.scale = clamp(Number.parseFloat(next) || 3, 1, 8);
      index += 1;
    } else if (arg === '--threshold' && next) {
      options.threshold = clamp(Number.parseInt(next, 10) || DEFAULT_DIGIT_THRESHOLD, 0, 255);
      index += 1;
    } else if (arg === '--invert' && next) {
      options.invert = next === 'true' || next === '1';
      index += 1;
    }
  }
  return options;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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
