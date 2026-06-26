const overlayCiv = document.querySelector('#overlayCiv');
const overlayVillagers = document.querySelector('#overlayVillagers');
const overlaySteps = document.querySelector('#overlaySteps');

window.aoeOverlay.getState().then(render);
window.aoeOverlay.onState(render);

function render(state) {
  const current = state.progress.current || state.build.steps[0];
  const steps = state.progress.upcoming?.length
    ? state.progress.upcoming
    : [current, ...(state.build.steps || []).filter((step) => step.villagers > state.villagerCount).slice(0, 3)];

  overlayCiv.textContent = state.civ;
  overlayVillagers.textContent = `${state.villagerCount} Dorfb.`;
  overlaySteps.replaceChildren(...steps.slice(0, 4).map((step, index) => renderStep(step, current, index)));
}

function renderStep(step, current, index) {
  const li = document.createElement('li');
  li.classList.toggle('current', step.villagers === current.villagers && index === 0);

  const villagers = document.createElement('span');
  villagers.className = 'step-vils';
  const icon = getStepIcon(step);
  const iconNode = document.createElement('img');
  iconNode.src = icon.src;
  iconNode.alt = icon.label;
  const count = document.createElement('b');
  count.textContent = `${step.villagers}`;
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

function getStepIcon(step) {
  const text = `${step?.title || ''} ${step?.instruction || ''}`.toLowerCase();
  const icons = {
    food: './assets/aoe2/resource-food.png',
    wood: './assets/aoe2/resource-wood.png',
    gold: './assets/aoe2/resource-gold.png',
    stone: './assets/aoe2/resource-stone.png'
  };

  if (/(gold|mining camp|mining|mine|relic)/.test(text)) {
    return { src: icons.gold, label: 'Gold' };
  }

  if (/(stone|castle|donjon|krepost)/.test(text)) {
    return { src: icons.stone, label: 'Stein' };
  }

  if (/(wood|lumber|barracks|stable|range|blacksmith|market|dock|house|wall|farm)/.test(text)) {
    return { src: icons.wood, label: 'Holz' };
  }

  return { src: icons.food, label: 'Nahrung' };
}
