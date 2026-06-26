const { Monitor } = require('node-screenshots');

const DEFAULT_DURATION_MS = 180000;
const TEST_INTERVALS = [1000, 2500];
const TOP_BAR_REGION = { x: 0, y: 0, width: 1, height: 0.075 };

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const monitors = Monitor.all();
  const monitor = monitors[options.monitorIndex] || monitors[0];

  if (!monitor) {
    throw new Error('Kein Monitor gefunden.');
  }

  console.log(`Monitor: ${monitor.id()} ${monitor.name()} ${monitor.width()}x${monitor.height()} @ ${monitor.x()},${monitor.y()}`);
  console.log(`Dauer je Intervall: ${options.durationMs}ms`);

  for (const intervalMs of TEST_INTERVALS) {
    const result = await runBenchmark(monitor, intervalMs, options.durationMs);
    console.log(formatResult(result));
  }
}

async function runBenchmark(monitor, intervalMs, durationMs) {
  const samples = [];
  const deadline = Date.now() + durationMs;
  let captures = 0;
  let failures = 0;

  while (Date.now() < deadline) {
    const loopStartedAt = Date.now();
    try {
      const startedAt = performance.now();
      const image = await monitor.captureImage();
      const region = regionToPixels(TOP_BAR_REGION, monitor.width(), monitor.height());
      const crop = image.cropSync(region.x, region.y, region.width, region.height);
      crop.toRawSync(true);
      samples.push(Math.round(performance.now() - startedAt));
      captures += 1;
    } catch (error) {
      failures += 1;
      console.error(`Capture fehlgeschlagen: ${error.message}`);
    }

    const elapsed = Date.now() - loopStartedAt;
    const waitMs = Math.max(0, intervalMs - elapsed);
    if (waitMs > 0) {
      await sleep(waitMs);
    }
  }

  return {
    intervalMs,
    captures,
    failures,
    p50: percentile(samples, 50),
    p95: percentile(samples, 95),
    max: samples.length ? Math.max(...samples) : null
  };
}

function formatResult(result) {
  return [
    `Intervall ${result.intervalMs}ms`,
    `Captures ${result.captures}`,
    `Fehler ${result.failures}`,
    `p50 ${formatMs(result.p50)}`,
    `p95 ${formatMs(result.p95)}`,
    `max ${formatMs(result.max)}`
  ].join(' / ');
}

function regionToPixels(region, width, height) {
  return {
    x: Math.max(0, Math.round(width * region.x)),
    y: Math.max(0, Math.round(height * region.y)),
    width: Math.max(1, Math.round(width * region.width)),
    height: Math.max(1, Math.round(height * region.height))
  };
}

function percentile(values, percent) {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil((percent / 100) * sorted.length) - 1);
  return sorted[index];
}

function formatMs(value) {
  return value === null ? '-' : `${value}ms`;
}

function parseArgs(args) {
  const options = {
    durationMs: DEFAULT_DURATION_MS,
    monitorIndex: 0
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--duration-ms' && next) {
      options.durationMs = Math.max(1000, Number.parseInt(next, 10) || DEFAULT_DURATION_MS);
      index += 1;
    } else if (arg === '--monitor' && next) {
      options.monitorIndex = Math.max(0, Number.parseInt(next, 10) || 0);
      index += 1;
    }
  }

  return options;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
