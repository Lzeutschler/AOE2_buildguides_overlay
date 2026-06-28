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

function getBuildProgress(build, villagerCount, resourceVillagers = {}) {
  if (!build) {
    return {
      current: null,
      next: null,
      completed: [],
      progress: 0
    };
  }

  const sorted = annotateResourceGoals([...build.steps].sort((a, b) => a.villagers - b.villagers));
  const completed = [];
  let current = sorted[0] || null;

  for (let index = 0; index < sorted.length; index += 1) {
    const step = sorted[index];
    const nextStep = sorted[index + 1] || null;
    if (!isStepComplete(step, nextStep, villagerCount, resourceVillagers)) {
      current = step;
      break;
    }

    completed.push(step);
    current = nextStep || step;
  }

  const currentIndex = current ? sorted.findIndex((step) => step.villagers === current.villagers) : -1;
  const next = currentIndex >= 0 ? sorted[currentIndex + 1] || null : null;
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

function isStepComplete(step, nextStep, villagerCount, resourceVillagers) {
  const resourceState = getResourceGoalState(step, resourceVillagers);
  if (resourceState.known) {
    return resourceState.complete;
  }

  if (nextStep) {
    return Number.isFinite(villagerCount) && villagerCount >= nextStep.villagers;
  }

  return Number.isFinite(villagerCount) && villagerCount >= step.villagers;
}

function getResourceGoalState(step, resourceVillagers) {
  const goal = step?.resourceGoal;
  if (!goal || !RESOURCE_KEYS.includes(goal.key) || !Number.isFinite(goal.target)) {
    return { known: false, complete: false };
  }

  const value = resourceVillagers?.[goal.key];
  if (!Number.isFinite(value)) {
    return { known: false, complete: false };
  }

  return {
    known: true,
    complete: value >= goal.target
  };
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
  getBuildProgress
};
