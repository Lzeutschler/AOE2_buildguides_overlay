const overlayCiv = document.querySelector('#overlayCiv');
const overlayVillagers = document.querySelector('#overlayVillagers');
const overlayStep = document.querySelector('#overlayStep');
const overlayInstruction = document.querySelector('#overlayInstruction');
const overlayNext = document.querySelector('#overlayNext');

window.aoeOverlay.getState().then(render);
window.aoeOverlay.onState(render);

function render(state) {
  const current = state.progress.current || state.build.steps[0];
  const next = state.progress.next;

  overlayCiv.textContent = state.civ;
  overlayVillagers.textContent = `${state.villagerCount} vils`;
  overlayStep.textContent = current.title;
  overlayInstruction.textContent = current.instruction;
  overlayNext.textContent = next ? `Next: ${next.villagers}` : 'Done';
}
