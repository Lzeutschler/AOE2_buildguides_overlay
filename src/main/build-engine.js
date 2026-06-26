function findBuild(builds, buildId) {
  return builds.find((build) => build.id === buildId) || builds[0];
}

function getRecommendedBuilds(data, civ) {
  const ids = data.civRecommendations[civ] || data.civRecommendations.Generic || [];
  const recommended = ids
    .map((id) => findBuild(data.builds, id))
    .filter(Boolean);

  if (recommended.length > 0) {
    return recommended;
  }

  return data.builds;
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

  const sorted = [...build.steps].sort((a, b) => a.villagers - b.villagers);
  const completed = sorted.filter((step) => step.villagers <= villagerCount);
  const current = completed[completed.length - 1] || sorted[0];
  const next = sorted.find((step) => step.villagers > villagerCount) || null;
  const progress = Math.min(1, completed.length / sorted.length);

  return {
    current,
    next,
    completed,
    progress
  };
}

module.exports = {
  findBuild,
  getRecommendedBuilds,
  getBuildProgress
};
