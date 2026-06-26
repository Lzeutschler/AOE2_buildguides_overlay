const { parentPort } = require('node:worker_threads');
const tesseract = require('tesseract.js');

let worker = null;

async function getWorker() {
  if (!worker) {
    worker = await tesseract.createWorker('eng');
  }

  return worker;
}

async function recognize(message) {
  const ocrWorker = await getWorker();
  await ocrWorker.setParameters({
    tessedit_char_whitelist: message.whitelist,
    tessedit_pageseg_mode: '7'
  });

  const result = await ocrWorker.recognize(message.dataUrl);
  return {
    text: result.data.text || '',
    confidence: Number.isFinite(result.data.confidence) ? result.data.confidence : 0
  };
}

parentPort.on('message', async (message) => {
  if (!message || message.type !== 'recognize') {
    return;
  }

  try {
    const result = await recognize(message);
    parentPort.postMessage({
      id: message.id,
      ok: true,
      result
    });
  } catch (error) {
    parentPort.postMessage({
      id: message.id,
      ok: false,
      error: error.message
    });
  }
});

process.on('beforeExit', async () => {
  if (worker) {
    await worker.terminate();
  }
});
