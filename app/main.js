const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const SettingsManager = require('./src/main/settingsManager');
const KubeManager = require('./src/main/kubeManager');

const settingsManager = new SettingsManager();
const kubeManager = new KubeManager(settingsManager);

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f172a',
    title: 'K8s Local Lens - Offline Desktop Cluster Manager',
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));

  // Remove default menu bar for clean modern desktop feel
  mainWindow.setMenuBarVisibility(false);
}

// IPC Handlers
ipcMain.handle('k8s:getContexts', async () => {
  return await kubeManager.getContexts();
});

ipcMain.handle('k8s:switchContext', async (event, contextName) => {
  return await kubeManager.switchContext(contextName);
});

ipcMain.handle('k8s:getResources', async (event, namespace) => {
  return await kubeManager.getClusterResources(namespace);
});

ipcMain.handle('settings:get', async () => {
  return settingsManager.getAll();
});

ipcMain.handle('settings:save', async (event, newSettings) => {
  return settingsManager.save(newSettings);
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
