// Client-side controller for K8s Local Lens
(function () {
  // Check if running inside Electron or HTTP server
  const isElectron = Boolean(window.k8sApi && window.k8sApi.isElectron);

  // Client Bridge Layer
  const api = {
    async getContexts() {
      if (isElectron) return await window.k8sApi.getContexts();
      const res = await fetch('/api/contexts');
      const data = await res.json();
      return data.contexts || [];
    },
    async switchContext(contextName) {
      if (isElectron) return await window.k8sApi.switchContext(contextName);
      const res = await fetch('/api/switch-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextName })
      });
      return await res.json();
    },
    async getResources(namespace) {
      if (isElectron) return await window.k8sApi.getResources(namespace);
      const res = await fetch(`/api/resources?namespace=${encodeURIComponent(namespace)}`);
      const json = await res.json();
      return json.data || { pods: [], namespaces: [] };
    },
    async getSettings() {
      if (isElectron) return await window.k8sApi.getSettings();
      const res = await fetch('/api/settings');
      const json = await res.json();
      return json.settings || {};
    },
    async saveSettings(settings) {
      if (isElectron) return await window.k8sApi.saveSettings(settings);
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      return await res.json();
    }
  };

  // State
  let currentContext = '';
  let currentNamespace = 'all';
  let cachedPods = [];
  let refreshTimer = null;

  // DOM Elements
  const contextSelect = document.getElementById('contextSelect');
  const namespaceSelect = document.getElementById('namespaceSelect');
  const podSearchInput = document.getElementById('podSearchInput');
  const refreshBtn = document.getElementById('refreshBtn');
  const podsTableBody = document.getElementById('podsTableBody');
  const totalPodsCount = document.getElementById('totalPodsCount');
  const runningPodsCount = document.getElementById('runningPodsCount');
  const pendingPodsCount = document.getElementById('pendingPodsCount');
  const failedPodsCount = document.getElementById('failedPodsCount');
  const connectionStatus = document.getElementById('connectionStatus');
  const navItems = document.querySelectorAll('.nav-item');
  const viewPanels = document.querySelectorAll('.view-panel');
  const pageTitle = document.getElementById('pageTitle');
  const customKubeconfigInput = document.getElementById('customKubeconfigInput');
  const refreshIntervalInput = document.getElementById('refreshIntervalInput');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const settingsSaveStatus = document.getElementById('settingsSaveStatus');

  // Initialize
  async function init() {
    setupNavListeners();
    await loadSettings();
    await loadContexts();
    await loadResources();
    startAutoRefresh();
  }

  function setupNavListeners() {
    navItems.forEach(btn => {
      btn.addEventListener('click', () => {
        navItems.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const view = btn.dataset.view;
        viewPanels.forEach(p => p.classList.remove('active'));

        if (view === 'workloads') {
          document.getElementById('workloadsView').classList.add('active');
          pageTitle.textContent = 'Pods & Workloads';
        } else if (view === 'settings') {
          document.getElementById('settingsView').classList.add('active');
          pageTitle.textContent = 'Local Settings';
        } else {
          document.getElementById('workloadsView').classList.add('active');
          pageTitle.textContent = btn.textContent.trim();
        }
      });
    });

    contextSelect.addEventListener('change', async (e) => {
      currentContext = e.target.value;
      connectionStatus.textContent = 'Switching context...';
      await api.switchContext(currentContext);
      await loadResources();
    });

    namespaceSelect.addEventListener('change', async (e) => {
      currentNamespace = e.target.value;
      await loadResources();
    });

    podSearchInput.addEventListener('input', () => {
      renderPodsTable(cachedPods);
    });

    refreshBtn.addEventListener('click', async () => {
      refreshBtn.textContent = '⏳ Loading...';
      await loadResources();
      refreshBtn.textContent = '🔄 Refresh';
    });

    saveSettingsBtn.addEventListener('click', async () => {
      const customPath = customKubeconfigInput.value.trim() || null;
      const interval = parseInt(refreshIntervalInput.value, 10) || 5;

      saveSettingsBtn.disabled = true;
      await api.saveSettings({
        customKubeconfigPath: customPath,
        refreshIntervalSeconds: interval
      });

      settingsSaveStatus.textContent = '✓ Settings saved locally!';
      setTimeout(() => {
        settingsSaveStatus.textContent = '';
        saveSettingsBtn.disabled = false;
      }, 2500);

      await loadContexts();
      await loadResources();
    });
  }

  async function loadSettings() {
    try {
      const settings = await api.getSettings();
      if (settings.customKubeconfigPath) {
        customKubeconfigInput.value = settings.customKubeconfigPath;
      }
      if (settings.refreshIntervalSeconds) {
        refreshIntervalInput.value = settings.refreshIntervalSeconds;
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  }

  async function loadContexts() {
    try {
      const contexts = await api.getContexts();
      contextSelect.innerHTML = '';

      if (!contexts || contexts.length === 0) {
        contextSelect.innerHTML = '<option value="">No Contexts Found</option>';
        return;
      }

      contexts.forEach(ctx => {
        const opt = document.createElement('option');
        opt.value = ctx.name;
        opt.textContent = ctx.name;
        if (ctx.isCurrent) {
          opt.selected = true;
          currentContext = ctx.name;
        }
        contextSelect.appendChild(opt);
      });

      if (!currentContext && contexts.length > 0) {
        currentContext = contexts[0].name;
      }
    } catch (err) {
      console.error('Failed to load contexts:', err);
    }
  }

  async function loadResources() {
    try {
      const data = await api.getResources(currentNamespace);
      cachedPods = data.pods || [];

      // Update Namespaces dropdown if needed
      const namespaces = data.namespaces || [];
      const currentSelected = namespaceSelect.value;
      namespaceSelect.innerHTML = '<option value="all">All Namespaces</option>';
      namespaces.forEach(ns => {
        const opt = document.createElement('option');
        opt.value = ns;
        opt.textContent = ns;
        if (ns === currentSelected) opt.selected = true;
        namespaceSelect.appendChild(opt);
      });

      // Update Cluster Status Badge
      if (data.clusterStatus) {
        connectionStatus.textContent = `${data.clusterStatus.status} (${currentContext})`;
      }

      renderMetrics(cachedPods);
      renderPodsTable(cachedPods);
    } catch (err) {
      console.error('Failed to load resources:', err);
      connectionStatus.textContent = 'Offline';
    }
  }

  function renderMetrics(pods) {
    totalPodsCount.textContent = pods.length;

    const running = pods.filter(p => p.status === 'Running').length;
    const pending = pods.filter(p => p.status === 'Pending' || p.status === 'Completed').length;
    const failed = pods.filter(p => p.status !== 'Running' && p.status !== 'Pending' && p.status !== 'Completed').length;

    runningPodsCount.textContent = running;
    pendingPodsCount.textContent = pending;
    failedPodsCount.textContent = failed;
  }

  function renderPodsTable(pods) {
    const query = podSearchInput.value.trim().toLowerCase();
    const filtered = pods.filter(p => {
      if (!query) return true;
      return (
        (p.name && p.name.toLowerCase().includes(query)) ||
        (p.namespace && p.namespace.toLowerCase().includes(query)) ||
        (p.node && p.node.toLowerCase().includes(query))
      );
    });

    if (filtered.length === 0) {
      podsTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="loading-cell">No matching pods found in namespace "${currentNamespace}".</td>
        </tr>
      `;
      return;
    }

    podsTableBody.innerHTML = filtered.map(pod => {
      let statusClass = 'status-running';
      if (pod.status === 'Completed') statusClass = 'status-completed';
      else if (pod.status === 'Pending') statusClass = 'status-pending';
      else if (pod.status.includes('Crash') || pod.status.includes('Fail') || pod.status.includes('Error')) statusClass = 'status-crashloop';

      return `
        <tr>
          <td><span class="status-pill ${statusClass}">${escapeHtml(pod.status)}</span></td>
          <td style="font-weight: 600; font-family: monospace;">${escapeHtml(pod.name)}</td>
          <td><span style="color: var(--text-secondary);">${escapeHtml(pod.namespace)}</span></td>
          <td>${escapeHtml(pod.ready)}</td>
          <td>${pod.restarts > 0 ? `<span style="color: var(--color-warning);">${pod.restarts}</span>` : '0'}</td>
          <td style="color: var(--text-muted);">${escapeHtml(pod.age)}</td>
          <td style="font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(pod.node)}</td>
        </tr>
      `;
    }).join('');
  }

  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    const intervalSec = parseInt(refreshIntervalInput.value, 10) || 5;
    refreshTimer = setInterval(() => {
      // Only refresh if workloads view is active to conserve CPU
      const isWorkloadsActive = document.getElementById('workloadsView').classList.contains('active');
      if (isWorkloadsActive) {
        loadResources();
      }
    }, intervalSec * 1000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.addEventListener('DOMContentLoaded', init);
})();
