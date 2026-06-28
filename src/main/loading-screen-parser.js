function parseLoadingScreenText(text, options = {}) {
  const civilizations = Array.isArray(options.civilizations) ? options.civilizations : [];
  const playerName = String(options.playerName || '').trim();
  const civMatches = findCivilizationMatches(text, civilizations);
  const playerNameIndex = playerName ? normalizeText(text).indexOf(normalizeText(playerName)) : -1;
  const ownIndex = findOwnIndex(civMatches, playerNameIndex);
  const playerCount = civMatches.length;
  const hasTeamSignal = /\bTEAM\b/i.test(text) || /KEIN\s*TEAM/i.test(text);
  const detected = playerCount > 0 && (hasTeamSignal || playerCount > 1);
  const players = civMatches.map((match, index) => ({
    slot: index + 1,
    color: index + 1,
    civ: match.name,
    team: getTeamForIndex(index, playerCount)
  }));
  const self = players[ownIndex] || null;
  const enemies = self
    ? players.filter((player) => player.slot !== self.slot && (self.team === null || player.team !== self.team))
    : [];

  return {
    status: detected ? 'detected' : 'idle',
    rawText: String(text || '').trim(),
    players,
    self,
    enemies,
    confidence: Number.isFinite(options.confidence) ? Math.round(options.confidence) : null,
    source: options.source || 'live',
    capturedAt: Number.isFinite(options.capturedAt) ? options.capturedAt : null,
    lastReadAt: Date.now()
  };
}

function findCivilizationMatches(text, civilizations) {
  const normalizedSource = normalizeText(text);
  const aliases = getCivilizationAliases(civilizations);
  const candidates = [
    ...findExactCivilizationMatches(text, normalizedSource, aliases),
    ...findFuzzyCivilizationMatches(text, normalizedSource, aliases)
  ];

  candidates.sort((left, right) => left.index - right.index || right.length - left.length);
  const matches = [];
  for (const candidate of candidates) {
    const overlaps = matches.some((match) => rangesOverlap(
      candidate.index,
      candidate.index + candidate.length,
      match.index,
      match.index + match.length
    ));
    if (!overlaps) {
      matches.push(candidate);
    }
  }

  return matches.sort((left, right) => left.index - right.index);
}

function findExactCivilizationMatches(text, normalizedSource, aliases) {
  const matches = [];
  const lines = String(text || '').split(/\r?\n/);
  let searchFrom = 0;

  for (const line of lines) {
    const normalizedLine = normalizeText(line);
    if (normalizedLine.length < 3 || isNonCivLine(normalizedLine)) {
      continue;
    }

    const lineIndex = normalizedSource.indexOf(normalizedLine, searchFrom);
    if (lineIndex >= 0) {
      searchFrom = lineIndex + normalizedLine.length;
    }

    for (const alias of aliases) {
      let offset = normalizedLine.indexOf(alias.normalized);
      while (offset >= 0) {
        matches.push({
          index: (lineIndex >= 0 ? lineIndex : searchFrom) + offset,
          length: alias.normalized.length,
          name: alias.civ
        });
        offset = normalizedLine.indexOf(alias.normalized, offset + alias.normalized.length);
      }
    }
  }

  return matches;
}

function getCivilizationAliases(civilizations) {
  return civilizations.flatMap((civ) => {
    const names = [civ.name, ...(Array.isArray(civ.aliases) ? civ.aliases : [])]
      .map((name) => String(name || '').trim())
      .filter(Boolean)
      .sort((left, right) => right.length - left.length);

    return names.map((name) => ({
      civ: civ.name,
      normalized: normalizeText(name)
    }));
  }).filter((alias) => alias.normalized.length >= 3)
    .sort((left, right) => right.normalized.length - left.normalized.length);
}

function findFuzzyCivilizationMatches(text, normalizedSource, aliases) {
  const matches = [];
  const lines = String(text || '').split(/\r?\n/);
  let searchFrom = 0;

  for (const line of lines) {
    const normalizedLine = normalizeText(line);
    if (normalizedLine.length < 3 || isNonCivLine(normalizedLine)) {
      continue;
    }

    const index = normalizedSource.indexOf(normalizedLine, searchFrom);
    if (index >= 0) {
      searchFrom = index + normalizedLine.length;
    }

    const best = findBestAliasForLine(normalizedLine, aliases);
    if (!best) {
      continue;
    }

    matches.push({
      index: index >= 0 ? index : searchFrom,
      length: Math.min(normalizedLine.length, best.normalized.length),
      name: best.civ,
      fuzzy: true
    });
  }

  return matches;
}

function findBestAliasForLine(normalizedLine, aliases) {
  let best = null;

  for (const alias of aliases) {
    if (alias.normalized.length < 5) {
      continue;
    }

    const distance = getLineAliasDistance(normalizedLine, alias.normalized);
    const maxDistance = Math.max(1, Math.floor(alias.normalized.length * 0.25));
    if (distance > maxDistance) {
      continue;
    }

    if (!best || distance < best.distance || (distance === best.distance && alias.normalized.length > best.normalized.length)) {
      best = { ...alias, distance };
    }
  }

  return best;
}

function getLineAliasDistance(line, alias) {
  if (line.includes(alias)) {
    return 0;
  }

  if (line.length > alias.length + 3 || line.length < alias.length - 2) {
    return Number.POSITIVE_INFINITY;
  }

  return levenshtein(line, alias);
}

function isNonCivLine(line) {
  return line === 'team'
    || line === 'keinteam'
    || /^team\d*$/.test(line)
    || /^\d+$/.test(line);
}

function findOwnIndex(matches, playerNameIndex) {
  if (playerNameIndex >= 0) {
    const afterName = matches.findIndex((match) => match.index > playerNameIndex);
    if (afterName >= 0) {
      return afterName;
    }
  }

  return 0;
}

function getTeamForIndex(index, playerCount) {
  if (playerCount <= 2) {
    return null;
  }

  const teamSize = Math.ceil(playerCount / 2);
  return index < teamSize ? 1 : 2;
}

function rangesOverlap(leftStart, leftEnd, rightStart, rightEnd) {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function levenshtein(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_value, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + cost
      );
    }

    for (let index = 0; index < previous.length; index += 1) {
      previous[index] = current[index];
    }
  }

  return previous[right.length];
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

module.exports = {
  parseLoadingScreenText,
  findCivilizationMatches,
  normalizeText
};
