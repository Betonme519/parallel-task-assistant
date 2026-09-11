const { contextBridge, ipcRenderer } = require('electron');
const call = channel => (...args) => ipcRenderer.invoke(channel, ...args);
contextBridge.exposeInMainWorld('flowline', {
  load: call('workspace:load'), command: call('workspace:command'), undo: call('workspace:undo'),
  importImage: call('image:import'), clipboardImage: call('image:clipboard'), getImage: call('image:get'),
  analyze: call('ai:analyze'), aiStatus:call('ai:status'), configureAI:call('ai:configure'), clearAI:call('ai:clear'), startVoice:call('voice:start'), exportBackup: call('backup:export'), importBackup: call('backup:import'),
  view: call('dock:view'), hold: call('dock:hold'), collapse: call('dock:collapse'), quit: call('app:quit'),
  onDock: callback => { const listener = (_e, value) => callback(value); ipcRenderer.on('dock:state', listener); return () => ipcRenderer.removeListener('dock:state', listener); },
});
