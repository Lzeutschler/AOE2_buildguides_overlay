const overlayCiv = document.querySelector('#overlayCiv');
const overlayVillagers = document.querySelector('#overlayVillagers');
const overlaySteps = document.querySelector('#overlaySteps');
const overlayResources = document.querySelector('#overlayResources');
const resourceCells = {
  food: document.querySelector('#resFood'),
  wood: document.querySelector('#resWood'),
  gold: document.querySelector('#resGold'),
  stone: document.querySelector('#resStone')
};

window.aoeOverlay.getState().then(render);
window.aoeOverlay.onState(render);

function render(state) {
  const current = state.progress.current || state.build.steps[0];
  const steps = state.progress.upcoming?.length
    ? state.progress.upcoming
    : [current, ...(state.build.steps || []).filter((step) => step.villagers > state.villagerCount).slice(0, 3)];

  overlayCiv.textContent = state.civ;
  overlayVillagers.textContent = `${state.villagerCount} Dorfb.`;
  renderResources(state.resourceVillagers);
  overlaySteps.replaceChildren(...steps.slice(0, 4).map((step, index) => renderStep(step, current, index, state.resourceVillagers)));
}

function renderResources(resourceVillagers) {
  const hasAny = resourceVillagers
    && ['food', 'wood', 'gold', 'stone'].some((key) => Number.isFinite(resourceVillagers[key]));
  overlayResources.hidden = !hasAny;
  if (!hasAny) {
    return;
  }

  for (const key of Object.keys(resourceCells)) {
    const value = resourceVillagers[key];
    resourceCells[key].textContent = Number.isFinite(value) ? String(value) : '-';
  }
}

function renderStep(step, current, index, resourceVillagers) {
  const li = document.createElement('li');
  li.classList.toggle('current', step.villagers === current.villagers && index === 0);

  const villagers = document.createElement('span');
  villagers.className = 'step-vils';
  const icon = getStepIcon(step);
  const iconNode = document.createElement('img');
  iconNode.src = icon.src;
  iconNode.alt = icon.label;
  const count = document.createElement('b');
  count.textContent = formatStepProgress(step, icon.key, index, resourceVillagers);
  villagers.append(iconNode, count);

  const body = document.createElement('div');
  body.className = 'step-body';

  const title = document.createElement('strong');
  title.textContent = index === 0 ? `Jetzt: ${step.title}` : `Danach: ${step.title}`;

  const instruction = document.createElement('p');
  instruction.textContent = step.instruction;

  body.append(title, instruction);
  li.append(villagers, body);
  return li;
}

function formatStepProgress(step, resourceKey, index, resourceVillagers) {
  const goal = step.resourceGoal;
  const key = goal?.key || resourceKey;
  const value = resourceVillagers?.[key];
  if (index === 0 && Number.isFinite(value) && Number.isFinite(goal?.target)) {
    return `${value}/${goal.target}`;
  }

  return `${step.villagers}`;
}

function getStepIcon(step) {
  const resourceGoal = step?.resourceGoal?.key;
  const text = `${step?.title || ''} ${step?.instruction || ''}`.toLowerCase();
  const icons = {
    food: './assets/aoe2/resource-food.png',
    wood: './assets/aoe2/resource-wood.png',
    gold: './assets/aoe2/resource-gold.png',
    stone: './assets/aoe2/resource-stone.png'
  };

  if (resourceGoal && icons[resourceGoal]) {
    return { key: resourceGoal, src: icons[resourceGoal], label: resourceGoal };
  }

  if (/(gold|mining camp|mining|mine|relic)/.test(text)) {
    return { key: 'gold', src: icons.gold, label: 'Gold' };
  }

  if (/(stone|castle|donjon|krepost)/.test(text)) {
    return { key: 'stone', src: icons.stone, label: 'Stein' };
  }

  if (/(wood|lumber|barracks|stable|range|blacksmith|market|dock|house|wall|farm)/.test(text)) {
    return { key: 'wood', src: icons.wood, label: 'Holz' };
  }

  return { key: 'food', src: icons.food, label: 'Nahrung' };
}
