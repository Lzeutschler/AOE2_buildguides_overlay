const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aoeOverlay', {
  getState: () => ipcRenderer.invoke('state:get'),
  getOcrPreview: () => ipcRenderer.invoke('ocr:preview'),
  testOcr: () => ipcRenderer.invoke('ocr:test'),
  importBuilds: () => ipcRenderer.invoke('builds:import'),
  exportBuilds: () => ipcRenderer.invoke('builds:export'),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('state:update', listener);
    return () => ipcRenderer.removeListener('state:update', listener);
  },
  updateState: (partial) => ipcRenderer.send('state:update', partial),
  adjustVillagers: (delta) => ipcRenderer.send('villager:adjust', delta),
  moveOverlay: (position) => ipcRenderer.send('overlay:move', position)
});
