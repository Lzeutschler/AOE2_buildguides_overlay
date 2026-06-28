const assert = require('node:assert/strict');
const { getBuildProgress, isBuildFinished } = require('../src/main/build-engine');

const build = {
  id: 'test-linear',
  name: 'Test Linear Build',
  steps: [
    { villagers: 6, title: 'Start', instruction: '6 villagers on sheep.' },
    { villagers: 10, title: 'Wood', instruction: 'Villagers 7-10 to wood.' },
    { villagers: 14, title: 'Berries', instruction: 'Villagers 11-14 to berries.' }
  ]
};

function advanceHighWater(previous, villagerCount) {
  return Math.max(Number.isFinite(previous) ? previous : 0, villagerCount);
}

let highWater = 0;
highWater = advanceHighWater(highWater, 6);
assert.equal(getBuildProgress(build, highWater).current.title, 'Start');
assert.equal(getBuildProgress(build, highWater).next.title, 'Wood');
assert.equal(isBuildFinished(build, highWater), false);

highWater = advanceHighWater(highWater, 11);
assert.equal(getBuildProgress(build, highWater).current.title, 'Wood');
assert.equal(getBuildProgress(build, highWater).next.title, 'Berries');

highWater = advanceHighWater(highWater, 8);
assert.equal(highWater, 11);
assert.equal(getBuildProgress(build, highWater).current.title, 'Wood');

const lowResources = { food: 0, wood: 0, gold: 0, stone: 0 };
const highResources = { food: 99, wood: 99, gold: 99, stone: 99 };
assert.deepEqual(
  simplify(getBuildProgress(build, 10, lowResources)),
  simplify(getBuildProgress(build, 10, highResources))
);

assert.equal(getBuildProgress(build, 14).current.title, 'Berries');
assert.equal(getBuildProgress(build, 14).progress < 1, true);
assert.equal(isBuildFinished(build, 14), false);
assert.equal(isBuildFinished(build, 15), true);
assert.equal(getBuildProgress(build, 15).progress, 1);

console.log('Build-progress logic OK: linear villager-only progress is monotonic.');

function simplify(progress) {
  return {
    current: progress.current?.title || null,
    next: progress.next?.title || null,
    completed: progress.completed.map((step) => step.title),
    progress: progress.progress
  };
}
