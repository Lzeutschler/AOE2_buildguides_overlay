function findBuild(builds, buildId) {
  return builds.find((build) => build.id === buildId) || builds[0];
}

function getRecommendedBuilds(data, civ) {
  const genericIds = data.civRecommendations.Generic || [];
  const ids = civ === 'Generic'
    ? genericIds
    : [
      ...(data.civRecommendations[civ] || []),
      ...getCivNamedBuildIds(data.builds, civ),
      ...genericIds
    ];
  const seen = new Set();
  const recommended = ids
    .map((id) => findBuild(data.builds, id))
    .filter(Boolean)
    .filter((build) => {
      if (seen.has(build.id)) {
        return false;
      }

      seen.add(build.id);
      return true;
    });

  if (recommended.length > 0) {
    return recommended;
  }

  return data.builds;
}

function getCivNamedBuildIds(builds, civ) {
  if (!civ || civ === 'Generic') {
    return [];
  }

  const normalizedCiv = normalizeName(civ);
  return builds
    .filter((build) => {
      const civs = Array.isArray(build.civs) ? build.civs : [];
      return civs.some((name) => normalizeName(name) === normalizedCiv)
        || normalizeName(build.name).includes(normalizedCiv);
    })
    .map((build) => build.id);
}

function getBuildProgress(build, villagerCount) {
  if (!build) {
    return {
      current: null,
      next: null,
      completed: [],
      progress: 0
    };
  }

  const sorted = annotateResourceGoals([...build.steps].sort((a, b) => a.villagers - b.villagers));
  if (sorted.length === 0) {
    return {
      current: null,
      next: null,
      upcoming: [],
      completed: [],
      progress: 0
    };
  }

  const safeVillagerCount = Number.isFinite(villagerCount) ? villagerCount : 0;
  const lastStep = sorted[sorted.length - 1] || null;
  const currentIndex = Math.max(0, sorted.findLastIndex((step) => safeVillagerCount >= step.villagers));
  const current = sorted[currentIndex] || sorted[0] || null;
  const next = currentIndex >= 0 ? sorted[currentIndex + 1] || null : null;
  const completed = lastStep && safeVillagerCount > lastStep.villagers
    ? sorted
    : sorted.slice(0, currentIndex);
  const upcoming = [
    current,
    ...sorted.slice(currentIndex + 1, currentIndex + 4)
  ].filter(Boolean);
  const progress = Math.min(1, completed.length / sorted.length);

  return {
    current,
    next,
    upcoming,
    completed,
    progress
  };
}

function isBuildFinished(build, villagerCount) {
  const maxVillagers = getBuildMaxVillagers(build);
  return Number.isFinite(maxVillagers)
    && Number.isFinite(villagerCount)
    && villagerCount > maxVillagers;
}

function getBuildMaxVillagers(build) {
  const values = Array.isArray(build?.steps)
    ? build.steps.map((step) => Number(step.villagers)).filter(Number.isFinite)
    : [];
  return values.length > 0 ? Math.max(...values) : NaN;
}

const RESOURCE_KEYS = ['food', 'wood', 'gold', 'stone'];
const RESOURCE_WORDS = {
  food: ['food', 'sheep', 'boar', 'hunt', 'berries', 'berry', 'deer', 'farm', 'shore fish', 'fish'],
  wood: ['wood', 'woodline', 'lumber', 'straggler', 'tree', 'trees'],
  gold: ['gold', 'relic'],
  stone: ['stone']
};

function annotateResourceGoals(steps) {
  const totals = { food: 0, wood: 0, gold: 0, stone: 0 };

  return steps.map((step) => {
    const deltas = inferResourceDeltas(step);
    for (const key of RESOURCE_KEYS) {
      totals[key] = Math.max(0, totals[key] + (deltas[key] || 0));
    }

    const key = choosePrimaryResource(deltas);
    return key
      ? {
        ...step,
        resourceGoal: {
          key,
          target: totals[key],
          delta: deltas[key]
        }
      }
      : { ...step };
  });
}

function inferResourceDeltas(step) {
  const text = normalizeInstruction(`${step?.title || ''}. ${step?.instruction || ''}`);
  const deltas = { food: 0, wood: 0, gold: 0, stone: 0 };

  applyAssignmentMatches(text, deltas, /villagers?\s+(\d+)\s*-\s*(\d+)\s+([^.;]+)/g, (match) => {
    const start = Number.parseInt(match[1], 10);
    const end = Number.parseInt(match[2], 10);
    return Math.max(1, end - start + 1);
  });

  applyAssignmentMatches(text, deltas, /(?:send|put)\s+the\s+first\s+(\d+)\s+villagers?\s+([^.;]+)/g);
  applyAssignmentMatches(text, deltas, /(?:send|add|move|take)\s+(?:the\s+next\s+)?(\d+)(?:-\d+)?\s+(?:more\s+)?([a-z-]+\s+)?villagers?\s+([^.;]+)/g, null, 3, 2);
  applyAssignmentMatches(text, deltas, /(?:then|and)\s+(\d+)(?:-\d+)?\s+(?:more\s+)?([a-z-]+\s+)?villagers?\s+([^.;]+)/g, null, 3, 2);
  applyAssignmentMatches(text, deltas, /(?:send|add|move|take)\s+(?:the\s+next\s+)?villager\s+([^.;]+)/g, () => 1, 1);
  applyAssignmentMatches(text, deltas, /villager\s+\d+\s+([^.;]+)/g, () => 1, 1);
  applyAssignmentMatches(text, deltas, /^(\d+)\s+villagers?\s+on\s+([^.;]+)/g);

  return deltas;
}

function applyAssignmentMatches(text, deltas, pattern, amountReader = null, fragmentIndex = 2, originIndex = null) {
  for (const match of text.matchAll(pattern)) {
    const amount = amountReader
      ? amountReader(match)
      : Number.parseInt(match[1], 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      continue;
    }

    const fragment = match[fragmentIndex] || match[0];
    const key = detectResource(fragment);
    if (!key) {
      continue;
    }

    const origin = originIndex ? detectResource(match[originIndex]) : null;
    if (origin && origin !== key && isMoveMatch(match[0])) {
      deltas[origin] -= amount;
    }
    deltas[key] += amount;
  }
}

function detectResource(text) {
  const source = ` ${String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  let best = null;

  for (const [key, words] of Object.entries(RESOURCE_WORDS)) {
    for (const word of words) {
      const index = source.lastIndexOf(` ${word} `);
      if (index > best?.index || (best === null && index >= 0)) {
        best = { key, index };
      }
    }
  }

  return best?.key || null;
}

function choosePrimaryResource(deltas) {
  return RESOURCE_KEYS
    .filter((key) => deltas[key] > 0)
    .sort((left, right) => deltas[right] - deltas[left])[0] || null;
}

function isMoveMatch(text) {
  return /^\s*(?:move|take)\b/.test(text);
}

function normalizeInstruction(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ');
}

function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

module.exports = {
  findBuild,
  getRecommendedBuilds,
  getBuildProgress,
  getBuildMaxVillagers,
  isBuildFinished
};
