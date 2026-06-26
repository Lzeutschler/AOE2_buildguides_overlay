const fs = require('node:fs');
const path = require('node:path');

const SETTINGS_FILE = 'settings.json';

function loadSettings(userDataPath) {
  const filePath = path.join(userDataPath, SETTINGS_FILE);

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

function saveSettings(userDataPath, settings) {
  const filePath = path.join(userDataPath, SETTINGS_FILE);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));
}

module.exports = {
  loadSettings,
  saveSettings
};
