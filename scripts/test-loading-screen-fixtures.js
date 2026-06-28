// Offline Loading-screen fixture test.
//
// Uses the saved screenshots in manuel_testing/Loading screen/ to verify that
// the left player panel yields own civ plus enemy civs for 1v1 through 4v4.

const path = require('node:path');
const { Worker } = require('node:worker_threads');
const { app, nativeImage } = require('electron');
const { DEFAULT_OCR_REGIONS } = require('../src/main/ocr-defaults');
const civData = require('../src/data/civilizations.json');
const { parseLoadingScreenText } = require('../src/main/loading-screen-parser');

const PROJECT_ROOT = path.join(__dirname, '..');
const SCREENSHOT_DIR = path.join(PROJECT_ROOT, 'manuel_testing', 'Loading screen');
const WORKER_PATH = path.join(PROJECT_ROOT, 'src', 'main', 'ocr-worker-thread.js');
const TEXT_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -';

const FIXTURES = [
  {
    file: '20260628174827_1.jpg',
    self: 'Romans',
    enemies: ['Berbers']
  },
  {
    file: '20260628174900_1.jpg',
    self: 'Romans',
    enemies: ['Malians', 'Georgians']
  },
  {
    file: '20260628174938_1.jpg',
    self: 'Romans',
    enemies: ['Cumans', 'Shu', 'Bohemians']
  },
  {
    file: '20260628175021_1.jpg',
    self: 'Romans',
    enemies: ['Hindustanis', 'Sicilians', 'Tatars', 'Burgundians']
  }
];

async function main() {
  const ocr = new WorkerClient(WORKER_PATH);
  let failures = 0;

  try {
    for (const fixture of FIXTURES) {
      const image = nativeImage.createFromPath(path.join(SCREENSHOT_DIR, fixture.file));
      if (image.isEmpty()) {
        throw new Error(`${fixture.file}: Bild konnte nicht geladen werden.`);
      }

      const text = await recognizeLoadingPanel(image, ocr);
      const parsed = parseLoadingScreenText(text, {
        civilizations: civData.civilizations,
        playerName: 'Testodines'
      });

      failures += reportFixture(fixture, parsed, text);
    }
  } finally {
    await ocr.dispose();
  }

  if (failures > 0) {
    throw new Error(`${failures} Loading-Screen-Fixture-Pruefung(en) fehlgeschlagen.`);
  }

  console.log('Loading-Screen-Fixtures OK: eigene Civ und Gegner-Civs erkannt.');
}

async function recognizeLoadingPanel(image, ocr) {
  const region = regionToPixels(DEFAULT_OCR_REGIONS.loadingScreenRegion, image.getSize());
  const crop = image.crop(region);
  const size = crop.getSize();
  const scaled = crop.resize({
    width: Math.max(1, Math.round(size.width * 4)),
    height: Math.max(1, Math.round(size.height * 4)),
    quality: 'best'
  });
  const result = await ocr.recognize(scaled.toDataURL(), TEXT_WHITELIST, '6');
  return result.text || '';
}

function reportFixture(fixture, parsed, text) {
  const actualSelf = parsed.self?.civ || null;
  const actualEnemies = parsed.enemies.map((enemy) => enemy.civ);
  const missingEnemies = fixture.enemies.filter((civ) => !actualEnemies.includes(civ));
  const ok = actualSelf === fixture.self && missingEnemies.length === 0;

  if (ok) {
    console.log(`${fixture.file}: ${actualSelf} vs ${actualEnemies.join(', ')} OK`);
    return 0;
  }

  console.error(`${fixture.file}: erwartet ${fixture.self} vs ${fixture.enemies.join(', ')}`);
  console.error(`  bekommen ${actualSelf || '-'} vs ${actualEnemies.join(', ') || '-'}`);
  console.error(`  OCR "${text.trim().replace(/\s+/g, ' ')}"`);
  return 1;
}

function regionToPixels(region, size) {
  return {
    x: Math.round(size.width * region.x),
    y: Math.round(size.height * region.y),
    width: Math.round(size.width * region.width),
    height: Math.round(size.height * region.height)
  };
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
