const assert = require('node:assert/strict');
const { Detector } = require('../src/main/detector');

const detector = new Detector({
  desktopCapturer: null,
  screen: { getAllDisplays: () => [] },
  nativeImage: null
});

const now = Date.now();

detector.lastTickAt = now - 300;
assert.equal(detector.isOcrDue(250), true, 'OCR should be due after the startup probe interval');

detector.lastTickAt = now - 100;
assert.equal(detector.isOcrDue(250), false, 'OCR should not be due before the startup probe interval');

assert.equal(detector.shouldBufferLoadingScreenSnapshots({
  aoeRunning: true,
  detectionMode: 'ocr',
  inMatch: false
}), true, 'Startup/loading state should keep the loading snapshot buffer warm');

detector.lastTopBarAt = Date.now();
assert.equal(detector.shouldBufferLoadingScreenSnapshots({
  aoeRunning: true,
  detectionMode: 'ocr',
  inMatch: true
}), false, 'Fresh in-match topbar detection should not buffer loading snapshots');

detector.lastTopBarAt = Date.now() - 1000;
assert.equal(detector.shouldBufferLoadingScreenSnapshots({
  aoeRunning: true,
  detectionMode: 'ocr',
  inMatch: true
}), true, 'Stale in-match topbar state should buffer possible loading snapshots');

detector.stop();
console.log('Detector timing OK: short loading-screen snapshot buffering stays active.');
