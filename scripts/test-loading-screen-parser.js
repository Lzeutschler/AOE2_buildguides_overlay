const assert = require('node:assert/strict');
const civData = require('../src/data/civilizations.json');
const { parseLoadingScreenText } = require('../src/main/loading-screen-parser');

const germanSamples = [
  ['Roemer', 'Romans'],
  ['Briten', 'Britons'],
  ['Byzantiner', 'Byzantines'],
  ['Achameniden', 'Achaemenids'],
  ['Aethiopier', 'Ethiopians'],
  ['Ethiopier', 'Ethiopians'],
  ['Franken', 'Franks'],
  ['Goten', 'Goths'],
  ['Drawiden', 'Dravidians'],
  ['Gurjaras', 'Gurjaras'],
  ['Hindustanis', 'Hindustanis'],
  ['Hunnen', 'Huns'],
  ['Japaner', 'Japanese'],
  ['Kitanen', 'Khitans'],
  ['Koreaner', 'Koreans'],
  ['Litauer', 'Lithuanians'],
  ['Malayen', 'Malay'],
  ['Malier', 'Malians'],
  ['Mongolen', 'Mongols'],
  ['Perser', 'Persians'],
  ['Portugiesen', 'Portuguese'],
  ['Romern', 'Romans'],
  ['Sarazenen', 'Saracens'],
  ['Slawen', 'Slavs'],
  ['Spanier', 'Spanish'],
  ['Tataren', 'Tatars'],
  ['Teutonen', 'Teutons'],
  ['Tuerken', 'Turks'],
  ['Vietnamesisch', 'Vietnamese'],
  ['Wikinger', 'Vikings'],
  ['Bohmen', 'Bohemians'],
  ['Burgunder', 'Burgundians'],
  ['Kumanen', 'Cumans'],
  ['Georgier', 'Georgians'],
  ['Sizilianer', 'Sicilians'],
  ['Sizilier', 'Sicilians']
];

for (const [germanName, expected] of germanSamples) {
  const parsed = parseLoadingScreenText(`TEAM 1\nTestodines\n${germanName}\nTEAM 2\nEnemy\nBerber`, {
    civilizations: civData.civilizations,
    playerName: 'Testodines'
  });
  assert.equal(parsed.self?.civ, expected, germanName);
}

const fuzzy = parseLoadingScreenText('TEAM 1\nTestodines\nMALIER LL\nTEAM 2\nEnemy\nSIZILIANER', {
  civilizations: civData.civilizations,
  playerName: 'Testodines'
});
assert.equal(fuzzy.self?.civ, 'Malians');
assert.equal(fuzzy.enemies[0]?.civ, 'Sicilians');

console.log('Loading-screen parser OK: German aliases and fuzzy OCR lines recognized.');
