const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('k8sApi', {
  isElectron: true,
  getContexts: () => ipcRenderer.invoke('k8s:getContexts'),
  switchContext: (name) => ipcRenderer.invoke('k8s:switchContext', name),
  getResources: (namespace) => ipcRenderer.invoke('k8s:getResources', namespace),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings)
});
