class NodeScreenshotsFrame {
  constructor({ image, width, height, provider, durationMs, nativeImage }) {
    this.image = image;
    this.width = width;
    this.height = height;
    this.provider = provider;
    this.durationMs = durationMs;
    this.nativeImage = nativeImage;
  }

  cropRaw(region) {
    return this.crop(region).toRawSync(true);
  }

  cropDataUrl(region, scale = 1) {
    const safeRegion = normalizePixelRegion(region, this.width, this.height);
    const png = this.crop(safeRegion).toPngSync(true);
    const factor = clampNumber(scale, 1, 1, 6);

    if (!this.nativeImage || factor === 1) {
      return pngToDataUrl(png);
    }

    const image = this.nativeImage.createFromBuffer(png);
    const resized = image.resize({
      width: Math.max(1, Math.round(safeRegion.width * factor)),
      height: Math.max(1, Math.round(safeRegion.height * factor)),
      quality: 'best'
    });

    return resized.toDataURL();
  }

  crop(region) {
    const safeRegion = normalizePixelRegion(region, this.width, this.height);
    return this.image.cropSync(safeRegion.x, safeRegion.y, safeRegion.width, safeRegion.height);
  }
}

class NativeCaptureProvider {
  constructor({ nativeImage } = {}) {
    this.nativeImage = nativeImage;
    this.nodeScreenshots = loadOptionalModule('node-screenshots');
    this.lastError = this.nodeScreenshots ? '' : 'node-screenshots ist nicht installiert.';
  }

  get activeProvider() {
    return this.nodeScreenshots ? 'node-screenshots' : 'unavailable';
  }

  isAvailable() {
    return Boolean(this.nodeScreenshots);
  }

  async captureFrame(display) {
    if (!this.nodeScreenshots) {
      throw new Error(this.lastError || 'Native Bildschirmaufnahme ist nicht verfuegbar.');
    }

    const monitor = this.getMonitorForDisplay(display);
    if (!monitor) {
      throw new Error('Kein passender Monitor fuer den ausgewaehlten AOE2-Bildschirm gefunden.');
    }

    const startedAt = performance.now();
    const image = await monitor.captureImage();
    const durationMs = Math.round(performance.now() - startedAt);

    return new NodeScreenshotsFrame({
      image,
      width: monitor.width(),
      height: monitor.height(),
      provider: this.activeProvider,
      durationMs,
      nativeImage: this.nativeImage
    });
  }

  getMonitorForDisplay(display) {
    const { Monitor } = this.nodeScreenshots;
    const centerX = Math.round(display.bounds.x + display.bounds.width / 2);
    const centerY = Math.round(display.bounds.y + display.bounds.height / 2);
    const monitorFromPoint = Monitor.fromPoint(centerX, centerY);

    if (monitorFromPoint) {
      return monitorFromPoint;
    }

    const monitors = Monitor.all();
    return monitors.find((monitor) => sameBounds(monitor, display.bounds)) || monitors[0] || null;
  }
}

function createCaptureProvider(options) {
  return new NativeCaptureProvider(options);
}

function loadOptionalModule(moduleName) {
  try {
    return require(moduleName);
  } catch {
    return null;
  }
}

function sameBounds(monitor, bounds) {
  return Math.abs(monitor.x() - bounds.x) <= 2
    && Math.abs(monitor.y() - bounds.y) <= 2
    && Math.abs(monitor.width() - bounds.width) <= 2
    && Math.abs(monitor.height() - bounds.height) <= 2;
}

function regionPercentToPixels(region, imageSize) {
  const safeRegion = normalizeRegion(region, { x: 0, y: 0, width: 0.1, height: 0.1 });
  return normalizePixelRegion({
    x: Math.round(imageSize.width * safeRegion.x),
    y: Math.round(imageSize.height * safeRegion.y),
    width: Math.round(imageSize.width * safeRegion.width),
    height: Math.round(imageSize.height * safeRegion.height)
  }, imageSize.width, imageSize.height);
}

function normalizePixelRegion(region, maxWidth, maxHeight) {
  const x = clampNumber(region.x, 0, 0, Math.max(0, maxWidth - 1));
  const y = clampNumber(region.y, 0, 0, Math.max(0, maxHeight - 1));
  const width = clampNumber(region.width, 1, 1, Math.max(1, maxWidth - x));
  const height = clampNumber(region.height, 1, 1, Math.max(1, maxHeight - y));

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height)
  };
}

function pngToDataUrl(buffer) {
  return `data:image/png;base64,${Buffer.from(buffer).toString('base64')}`;
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

module.exports = {
  createCaptureProvider,
  regionPercentToPixels,
  pngToDataUrl
};
