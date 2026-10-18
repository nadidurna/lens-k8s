const fs = require('fs');
const path = require('path');
const os = require('os');

class SettingsManager {
  constructor() {
    this.configDir = path.join(os.homedir(), '.k8s-local-lens');
    this.configFile = path.join(this.configDir, 'settings.json');
    this.defaultSettings = {
      theme: 'dark',
      customKubeconfigPath: null,
      favoriteClusters: [],
      recentNamespaces: ['default', 'kube-system'],
      refreshIntervalSeconds: 5,
      offlineDemoMode: false,
      lastActiveContext: null
    };
    this.settings = this.load();
  }

  ensureDir() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  load() {
    try {
      this.ensureDir();
      if (fs.existsSync(this.configFile)) {
        const raw = fs.readFileSync(this.configFile, 'utf8');
        return Object.assign({}, this.defaultSettings, JSON.parse(raw));
      }
    } catch (err) {
      console.warn('Failed to load local settings, using defaults:', err.message);
    }
    return Object.assign({}, this.defaultSettings);
  }

  save(newSettings) {
    try {
      this.ensureDir();
      this.settings = Object.assign({}, this.settings, newSettings);
      fs.writeFileSync(this.configFile, JSON.stringify(this.settings, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error('Failed to save local settings:', err.message);
      return false;
    }
  }

  get(key) {
    return this.settings[key];
  }

  getAll() {
    return Object.assign({}, this.settings);
  }
}

module.exports = SettingsManager;
