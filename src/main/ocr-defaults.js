const DEFAULT_OCR_REGIONS = {
  topBarRegion: { x: 0, y: 0, width: 1, height: 0.075 },
  villagerRegion: { x: 0.224, y: 0.029, width: 0.018, height: 0.022 },
  civRegion: { x: 0.83, y: 0.006, width: 0.15, height: 0.065 },
  woodVilRegion: { x: 0.01875, y: 0.034, width: 0.0095, height: 0.017 },
  foodVilRegion: { x: 0.067, y: 0.033, width: 0.023, height: 0.018 },
  goldVilRegion: { x: 0.123, y: 0.034, width: 0.01, height: 0.017 },
  stoneVilRegion: { x: 0.178, y: 0.034, width: 0.01, height: 0.017 }
};

const LEGACY_OCR_REGIONS = {
  topBarRegion: { x: 0, y: 0, width: 1, height: 0.075 },
  villagerRegion: { x: 0.265, y: 0.004, width: 0.04, height: 0.06 },
  civRegion: { x: 0.83, y: 0.006, width: 0.15, height: 0.065 },
  foodVilRegion: { x: 0.052, y: 0.028, width: 0.028, height: 0.03 },
  woodVilRegion: { x: 0.108, y: 0.028, width: 0.028, height: 0.03 },
  goldVilRegion: { x: 0.164, y: 0.028, width: 0.028, height: 0.03 },
  stoneVilRegion: { x: 0.22, y: 0.028, width: 0.028, height: 0.03 }
};

const PREVIOUS_OCR_REGIONS = {
  foodVilRegion: { x: 0.073, y: 0.03, width: 0.015, height: 0.019 }
};

const INTERMEDIATE_OCR_REGIONS = {
  woodVilRegion: { x: 0.014, y: 0.03, width: 0.015, height: 0.019 },
  foodVilRegion: { x: 0.064, y: 0.034, width: 0.028, height: 0.02 },
  goldVilRegion: { x: 0.128, y: 0.03, width: 0.015, height: 0.019 },
  stoneVilRegion: { x: 0.183, y: 0.03, width: 0.015, height: 0.019 }
};

const RECENT_OCR_REGIONS = {
  goldVilRegion: { x: 0.13, y: 0.034, width: 0.0095, height: 0.017 },
  stoneVilRegion: { x: 0.185, y: 0.034, width: 0.0095, height: 0.017 }
};

const SWAPPED_FOOD_WOOD_REGION_PAIRS = [
  {
    foodVilRegion: { x: 0.014, y: 0.03, width: 0.015, height: 0.019 },
    woodVilRegion: { x: 0.073, y: 0.03, width: 0.015, height: 0.019 }
  },
  {
    foodVilRegion: { x: 0.014, y: 0.03, width: 0.015, height: 0.019 },
    woodVilRegion: { x: 0.067, y: 0.033, width: 0.023, height: 0.018 }
  },
  {
    foodVilRegion: { x: 0.01875, y: 0.034, width: 0.0095, height: 0.017 },
    woodVilRegion: { x: 0.067, y: 0.033, width: 0.023, height: 0.018 }
  }
];

const DEFAULT_OCR_SETTINGS = {
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
  imageScale: 6,
  ...DEFAULT_OCR_REGIONS
};

const DIGIT_OCR_VARIANTS = [
  { scale: 6, threshold: 150, invert: false, pageSegMode: '13' },
  { scale: 6, threshold: 150, invert: false, pageSegMode: '7' },
  { scale: 6, threshold: 180, invert: false, pageSegMode: '13' },
  { scale: 6, threshold: 180, invert: false, pageSegMode: '7' },
  { scale: 5, threshold: 150, invert: false, pageSegMode: '13' },
  { scale: 5, threshold: 150, invert: false, pageSegMode: '7' },
  { scale: 5, threshold: 120, invert: false, pageSegMode: '13' },
  { scale: 5, threshold: 180, invert: false, pageSegMode: '7' },
  { scale: 6, threshold: 120, invert: false, pageSegMode: '13' },
  { scale: 6, threshold: 150, invert: true, pageSegMode: '7' }
];

const RESOURCE_DIGIT_OCR_VARIANTS = [
  ...DIGIT_OCR_VARIANTS,
  { scale: 6, threshold: 150, invert: false, pageSegMode: '10' },
  { scale: 6, threshold: 150, invert: false, pageSegMode: '11' },
  { scale: 6, threshold: 180, invert: false, pageSegMode: '8' },
  { scale: 6, threshold: 180, invert: false, pageSegMode: '10' },
  { scale: 5, threshold: 150, invert: false, pageSegMode: '10' },
  { scale: 5, threshold: 180, invert: false, pageSegMode: '8' },
  { scale: 5, threshold: 180, invert: false, pageSegMode: '10' },
  { scale: 6, threshold: 150, invert: true, pageSegMode: '10' },
  { scale: 6, threshold: 150, invert: true, pageSegMode: '11' }
];

module.exports = {
  DEFAULT_OCR_REGIONS,
  DEFAULT_OCR_SETTINGS,
  DIGIT_OCR_VARIANTS,
  RESOURCE_DIGIT_OCR_VARIANTS,
  migrateLegacyOcrRegions
};

function migrateLegacyOcrRegions(ocr) {
  if (!ocr) {
    return ocr;
  }

  const migrated = { ...ocr };
  if (isKnownFoodWoodSwap(migrated)) {
    migrated.foodVilRegion = DEFAULT_OCR_REGIONS.foodVilRegion;
    migrated.woodVilRegion = DEFAULT_OCR_REGIONS.woodVilRegion;
  }

  for (const key of Object.keys(DEFAULT_OCR_REGIONS)) {
    if (
      sameRegion(migrated[key], LEGACY_OCR_REGIONS[key])
      || sameRegion(migrated[key], PREVIOUS_OCR_REGIONS[key])
      || sameRegion(migrated[key], INTERMEDIATE_OCR_REGIONS[key])
      || sameRegion(migrated[key], RECENT_OCR_REGIONS[key])
    ) {
      migrated[key] = DEFAULT_OCR_REGIONS[key];
    }
  }

  return migrated;
}

function isKnownFoodWoodSwap(ocr) {
  return SWAPPED_FOOD_WOOD_REGION_PAIRS.some((pair) => (
    sameRegion(ocr.foodVilRegion, pair.foodVilRegion)
    && sameRegion(ocr.woodVilRegion, pair.woodVilRegion)
  ));
}

function sameRegion(left, right) {
  if (!left || !right) {
    return false;
  }

  return ['x', 'y', 'width', 'height'].every((key) => Math.abs(Number(left[key]) - right[key]) < 0.000001);
}
