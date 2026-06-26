// Resource villager-region calibration.
//
// The per-resource villager counts (small number at the bottom-left of each
// resource cell in the AoE2 top bar) all share the same baseline, the same
// glyph size and an equal horizontal spacing. This dev helper measures the
// tight digit bounding box for each resource in the saved fixtures and fits a
// single shared template:
//   - one shared y / height
//   - one shared width (wide enough for two digits, e.g. food "11")
//   - x = baseX + index * stride   (wood=0, food=1, gold=2, stone=3)
//
// It prints ready-to-paste percentage regions plus the 2560x1440 pixel values
// and writes the tight crops to manuel_testing/out/calib/ for visual review.
//
// Usage (from project root):
//   npm run calibrate:resources

const path = require('node:path');
const fs = require('node:fs');
const { app, nativeImage } = require('electron');

const PROJECT_ROOT = path.join(__dirname, '..');
const SCREENSHOT_DIR = path.join(PROJECT_ROOT, 'manuel_testing');
const OUTPUT_DIR = path.join(SCREENSHOT_DIR, 'out', 'calib');

// Reference resolution the default regions are locked to.
const REF_WIDTH = 2560;
const REF_HEIGHT = 1440;

// Bar order (left to right). Index drives the equal-spacing template.
const RESOURCE_ORDER = ['wood', 'food', 'gold', 'stone'];

// Fixtures with known per-resource villager counts. Only food varies, which is
// exactly why the equal-spacing template is needed to place the zero cells.
const FIXTURES = [
  { file: '20260626181404_1.jpg', resources: { wood: 0, food: 0, gold: 0, stone: 0 } },
  { file: '20260626181432_1.jpg', resources: { wood: 0, food: 3, gold: 0, stone: 0 } },
  { file: '20260626181454_1.jpg', resources: { wood: 0, food: 5, gold: 0, stone: 0 } },
  { file: '20260626181509_1.jpg', resources: { wood: 0, food: 6, gold: 0, stone: 0 } },
  { file: '20260626181525_1.jpg', resources: { wood: 0, food: 7, gold: 0, stone: 0 } },
  { file: '20260626222550_1.jpg', resources: { wood: 0, food: 7, gold: 0, stone: 0 } },
  { file: '20260626222556_1.jpg', resources: { wood: 0, food: 7, gold: 0, stone: 0 } },
  { file: '20260626222617_1.jpg', resources: { wood: 0, food: 8, gold: 0, stone: 0 } },
  { file: '20260626222703_1.jpg', resources: { wood: 0, food: 11, gold: 0, stone: 0 } }
];

// The per-resource villager count is the small white number on the
// bottom-right corner of each resource ICON (to the LEFT of the larger
// stockpile number). These search windows (2560x1440 px) bracket that corner
// only: they end before the stockpile starts and the colored icon art sits to
// the left of the right-aligned digit, so scanning the right-most bright
// cluster isolates the count.
const SEARCH_PX = {
  wood: { x: 28, y: 47, width: 36, height: 24 },
  food: { x: 159, y: 47, width: 36, height: 24 },
  gold: { x: 295, y: 47, width: 36, height: 24 },
  stone: { x: 431, y: 47, width: 36, height: 24 }
};

// Digits are near-white; a high threshold rejects the colored icon art (e.g.
// the bright gold nuggets) and keeps only the glyphs.
const INK_THRESHOLD = 200;
// Minimum ink pixels in a column for it to count, to ignore stray specks.
const MIN_COL_INK = 2;
// Allow this many empty columns inside the number before we cut the box (keeps
// a two-digit number like "11" together while excluding icon art further left).
const MAX_COL_GAP = 8;
// Padding added around the measured ink when building the final box (px @ ref).
const PAD_X = 4;
const PAD_Y = 4;
// The box must always be wide enough for a worst-case two-digit number, even
// though the fixtures only contain thin glyphs (food "11").
const MIN_WIDTH_PX = 30;

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const measurements = { wood: [], food: [], gold: [], stone: [] };

  for (const fixture of FIXTURES) {
    const image = nativeImage.createFromPath(path.join(SCREENSHOT_DIR, fixture.file));
    if (image.isEmpty()) {
      throw new Error(`${fixture.file}: Bild konnte nicht geladen werden.`);
    }

    const size = image.getSize();
    if (size.width !== REF_WIDTH || size.height !== REF_HEIGHT) {
      throw new Error(`${fixture.file}: erwartet ${REF_WIDTH}x${REF_HEIGHT}, bekommen ${size.width}x${size.height}`);
    }

    console.log(`\n=== ${fixture.file} ===`);
    for (const key of RESOURCE_ORDER) {
      const expected = fixture.resources[key];
      const bbox = measureDigitBox(image, SEARCH_PX[key]);
      if (!bbox) {
        console.log(`  ${key.padEnd(5)} (=${expected}): keine Ziffer-Pixel gefunden`);
        continue;
      }

      const digits = bbox.x1 - bbox.x0 + 1;
      const rows = bbox.y1 - bbox.y0 + 1;
      console.log(
        `  ${key.padEnd(5)} (=${expected}): x=${bbox.x0}..${bbox.x1} (w=${digits}) `
        + `y=${bbox.y0}..${bbox.y1} (h=${rows})`
      );
      measurements[key].push({ file: fixture.file, expected, ...bbox });
      saveDebugCrop(image, bbox, `${path.parse(fixture.file).name}_${key}.png`);
    }
  }

  fitTemplate(measurements);
}

// Measure the tight ink bounding box of the right-most digit cluster inside the
// search window. The villager count is right-aligned on the icon corner, so the
// right-most bright cluster is the number (icon art lies further left).
// Returns absolute (image) pixel coordinates.
function measureDigitBox(image, searchPx) {
  const crop = image.crop(searchPx);
  const { width, height } = crop.getSize();
  const bitmap = crop.toBitmap();

  const colInk = new Array(width).fill(0);
  const rowInkByCol = [];
  for (let x = 0; x < width; x += 1) {
    rowInkByCol.push([]);
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const blue = bitmap[index];
      const green = bitmap[index + 1];
      const red = bitmap[index + 2];
      const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
      if (luminance >= INK_THRESHOLD) {
        colInk[x] += 1;
        rowInkByCol[x].push(y);
      }
    }
  }

  // Find the right-most column with ink (right edge of the number).
  let end = -1;
  for (let x = width - 1; x >= 0; x -= 1) {
    if (colInk[x] >= MIN_COL_INK) {
      end = x;
      break;
    }
  }
  if (end === -1) {
    return null;
  }

  // Extend left while gaps between inked columns stay small (keeps multi-digit
  // numbers together, stops before the icon art further left).
  let start = end;
  let gap = 0;
  for (let x = end - 1; x >= 0; x -= 1) {
    if (colInk[x] >= MIN_COL_INK) {
      start = x;
      gap = 0;
    } else {
      gap += 1;
      if (gap > MAX_COL_GAP) {
        break;
      }
    }
  }

  // Row bounds across the selected columns.
  let y0 = height;
  let y1 = -1;
  for (let x = start; x <= end; x += 1) {
    for (const y of rowInkByCol[x]) {
      if (y < y0) {
        y0 = y;
      }
      if (y > y1) {
        y1 = y;
      }
    }
  }
  if (y1 < 0) {
    return null;
  }

  return {
    x0: searchPx.x + start,
    x1: searchPx.x + end,
    y0: searchPx.y + y0,
    y1: searchPx.y + y1
  };
}

function fitTemplate(measurements) {
  // Per-resource medians of the tight ink box.
  const stats = {};
  for (const key of RESOURCE_ORDER) {
    const list = measurements[key];
    if (list.length === 0) {
      throw new Error(`Keine Messungen fuer ${key}.`);
    }
    stats[key] = {
      left: median(list.map((m) => m.x0)),
      right: median(list.map((m) => m.x1)),
      top: median(list.map((m) => m.y0)),
      bottom: median(list.map((m) => m.y1)),
      maxWidth: Math.max(...list.map((m) => m.x1 - m.x0 + 1)),
      maxBottom: Math.max(...list.map((m) => m.y1)),
      minTop: Math.min(...list.map((m) => m.y0))
    };
  }

  // The villager count shares one baseline across all resources, so derive the
  // vertical band and glyph width from the FOOD cell: its dark meat background
  // gives a clean read (and food is the only varying / two-digit sample). The
  // wood/gold cells have bright icon art that would inflate top/height/width.
  const ref = stats.food;
  const yPx = Math.max(0, ref.top - PAD_Y);
  const heightPx = (ref.bottom - ref.top) + PAD_Y * 2;
  // Width floored so a worst-case two-digit number always fits.
  const widthPx = Math.max(ref.maxWidth + PAD_X * 2, MIN_WIDTH_PX);

  // Digits are right-aligned on the icon corner, so the consistent anchor is the
  // RIGHT edge. Fit right-edge = baseRight + index * stride via least squares
  // over the four per-resource medians, then extend the box left for two digits.
  const indices = RESOURCE_ORDER.map((_key, index) => index);
  const { slope: stride, intercept: baseRight } = linearFit(indices, RESOURCE_ORDER.map((k) => stats[k].right));

  console.log('\n=== Gemessene Mediane (px @ 2560x1440) ===');
  for (const key of RESOURCE_ORDER) {
    const s = stats[key];
    console.log(`  ${key.padEnd(5)}: left=${s.left} right=${s.right} top=${s.top} bottom=${s.bottom} maxW=${s.maxWidth}`);
  }
  console.log(`\nbaseRight=${baseRight.toFixed(2)} stride=${stride.toFixed(2)} (digit-right = baseRight + index*stride)`);
  console.log(`yPx=${yPx} heightPx=${heightPx} widthPx=${widthPx}`);

  console.log('\n=== Vorlage: Pixel (2560x1440) ===');
  const pixelRegions = {};
  RESOURCE_ORDER.forEach((key, index) => {
    const digitRight = Math.round(baseRight + index * stride);
    const boxRight = digitRight + PAD_X;
    const xPx = Math.max(0, boxRight - widthPx);
    pixelRegions[key] = { x: xPx, y: yPx, width: widthPx, height: heightPx };
    console.log(`  ${key}VilRegion: x=${xPx} y=${yPx} w=${widthPx} h=${heightPx}`);
  });

  console.log('\n=== Vorlage: Prozent (zum Einsetzen in ocr-defaults.js) ===');
  RESOURCE_ORDER.forEach((key) => {
    const p = pixelRegions[key];
    const region = {
      x: round6(p.x / REF_WIDTH),
      y: round6(p.y / REF_HEIGHT),
      width: round6(p.width / REF_WIDTH),
      height: round6(p.height / REF_HEIGHT)
    };
    console.log(`  ${key}VilRegion: { x: ${region.x}, y: ${region.y}, width: ${region.width}, height: ${region.height} },`);
  });

  console.log(`\nDebug-Crops: ${OUTPUT_DIR}`);
}

function saveDebugCrop(image, bbox, name) {
  const region = {
    x: bbox.x0,
    y: bbox.y0,
    width: bbox.x1 - bbox.x0 + 1,
    height: bbox.y1 - bbox.y0 + 1
  };
  const crop = image.crop(region);
  fs.writeFileSync(path.join(OUTPUT_DIR, name), crop.toPNG());
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}

function linearFit(xs, ys) {
  const n = xs.length;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
  const sumXX = xs.reduce((acc, x) => acc + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function round6(value) {
  return Number(value.toFixed(6));
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
