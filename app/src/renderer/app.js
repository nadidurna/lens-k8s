// Client-side controller for K8s Local Lens
(function () {
  // Check if running inside Electron or HTTP server
  const isElectron = Boolean(window.k8sApi && window.k8sApi.isElectron);

  // Client Bridge Layer
  const api = {
    async getContexts() {
      if (isElectron && window.k8sApi.getContexts) return await window.k8sApi.getContexts();
      const res = await fetch('/api/contexts');
      const data = await res.json();
      return data.contexts || [];
    },
    async switchContext(contextName) {
      if (isElectron && window.k8sApi.switchContext) return await window.k8sApi.switchContext(contextName);
      const res = await fetch('/api/switch-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextName })
      });
      return await res.json();
    },
    async getResources(namespace) {
      if (isElectron && window.k8sApi.getResources) return await window.k8sApi.getResources(namespace);
      const res = await fetch(`/api/resources?namespace=${encodeURIComponent(namespace)}`);
      const json = await res.json();
      return json.data || { pods: [], nodes: [], services: [], storage: [], namespaces: [] };
    },
    async getPodLogs(podName, namespace) {
      if (isElectron && window.k8sApi.getPodLogs) return await window.k8sApi.getPodLogs(podName, namespace);
      const res = await fetch(`/api/pod-logs?pod=${encodeURIComponent(podName)}&namespace=${encodeURIComponent(namespace)}`);
      const json = await res.json();
      return json.logs || 'No logs found.';
    },
    async getSettings() {
      if (isElectron && window.k8sApi.getSettings) return await window.k8sApi.getSettings();
      const res = await fetch('/api/settings');
      const json = await res.json();
      return json.settings || {};
    },
    async saveSettings(settings) {
      if (isElectron && window.k8sApi.saveSettings) return await window.k8sApi.saveSettings(settings);
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
  let currentView = 'workloads';
  let cachedData = {
    pods: [],
    nodes: [],
    services: [],
    storage: []
  };
  let refreshTimer = null;

  // DOM Elements
  const contextSelect = document.getElementById('contextSelect');
  const namespaceSelect = document.getElementById('namespaceSelect');
  const namespaceFilterContainer = document.getElementById('namespaceFilterContainer');
  const resourceSearchInput = document.getElementById('resourceSearchInput');
  const refreshBtn = document.getElementById('refreshBtn');

  // Tables
  const podsTableBody = document.getElementById('podsTableBody');
  const nodesTableBody = document.getElementById('nodesTableBody');
  const servicesTableBody = document.getElementById('servicesTableBody');
  const storageTableBody = document.getElementById('storageTableBody');

  // Metrics
  const totalPodsCount = document.getElementById('totalPodsCount');
  const runningPodsCount = document.getElementById('runningPodsCount');
  const pendingPodsCount = document.getElementById('pendingPodsCount');
  const failedPodsCount = document.getElementById('failedPodsCount');
  const connectionStatus = document.getElementById('connectionStatus');

  // Layout / Views
  const navItems = document.querySelectorAll('.nav-item');
  const viewPanels = document.querySelectorAll('.view-panel');
  const pageTitle = document.getElementById('pageTitle');

  // Settings
  const customKubeconfigInput = document.getElementById('customKubeconfigInput');
  const refreshIntervalInput = document.getElementById('refreshIntervalInput');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const settingsSaveStatus = document.getElementById('settingsSaveStatus');

  // Modal
  const logModal = document.getElementById('logModal');
  const logModalPodName = document.getElementById('logModalPodName');
  const logModalNamespace = document.getElementById('logModalNamespace');
  const logContentContainer = document.getElementById('logContentContainer');
  const closeLogModalBtn = document.getElementById('closeLogModalBtn');

  // Initialize
  async function init() {
    setupNavListeners();
    setupModalListeners();
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
        currentView = view;
        viewPanels.forEach(p => p.classList.remove('active'));

        if (view === 'workloads') {
          document.getElementById('workloadsView').classList.add('active');
          pageTitle.textContent = 'Pods & Workloads';
          namespaceFilterContainer.style.display = 'flex';
          renderPodsTable(cachedData.pods);
        } else if (view === 'nodes') {
          document.getElementById('nodesView').classList.add('active');
          pageTitle.textContent = 'Nodes & Infrastructure';
          namespaceFilterContainer.style.display = 'none';
          renderNodesTable(cachedData.nodes);
        } else if (view === 'network') {
          document.getElementById('networkView').classList.add('active');
          pageTitle.textContent = 'Network & Services';
          namespaceFilterContainer.style.display = 'flex';
          renderServicesTable(cachedData.services);
        } else if (view === 'storage') {
          document.getElementById('storageView').classList.add('active');
          pageTitle.textContent = 'Storage & PersistentVolumeClaims';
          namespaceFilterContainer.style.display = 'flex';
          renderStorageTable(cachedData.storage);
        } else if (view === 'settings') {
          document.getElementById('settingsView').classList.add('active');
          pageTitle.textContent = 'Local Preferences & Kubeconfig';
          namespaceFilterContainer.style.display = 'none';
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

    resourceSearchInput.addEventListener('input', () => {
      renderCurrentActiveView();
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

  function setupModalListeners() {
    closeLogModalBtn.addEventListener('click', () => {
      logModal.classList.remove('active');
    });

    logModal.addEventListener('click', (e) => {
      if (e.target === logModal) {
        logModal.classList.remove('active');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && logModal.classList.contains('active')) {
        logModal.classList.remove('active');
      }
    });
  }

  async function openPodLogs(podName, namespace) {
    logModalPodName.textContent = podName;
    logModalNamespace.textContent = namespace;
    logContentContainer.textContent = 'Fetching logs from cluster...';
    logModal.classList.add('active');

    try {
      const logs = await api.getPodLogs(podName, namespace);
      logContentContainer.textContent = logs || 'No logs output returned.';
    } catch (err) {
      logContentContainer.textContent = `Error fetching pod logs: ${err.message}`;
    }
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
      cachedData.pods = data.pods || [];
      cachedData.nodes = data.nodes || [];
      cachedData.services = data.services || [];
      cachedData.storage = data.storage || [];

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
        connectionStatus.textContent = `${data.clusterStatus.status} (${currentContext || 'local'})`;
      }

      renderMetrics(cachedData.pods);
      renderCurrentActiveView();
    } catch (err) {
      console.error('Failed to load resources:', err);
      connectionStatus.textContent = 'Offline (Check kubeconfig)';
    }
  }

  function renderCurrentActiveView() {
    if (currentView === 'workloads') {
      renderPodsTable(cachedData.pods);
    } else if (currentView === 'nodes') {
      renderNodesTable(cachedData.nodes);
    } else if (currentView === 'network') {
      renderServicesTable(cachedData.services);
    } else if (currentView === 'storage') {
      renderStorageTable(cachedData.storage);
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
    const query = resourceSearchInput.value.trim().toLowerCase();
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
          <td colspan="8" class="loading-cell">No matching pods found in namespace "${escapeHtml(currentNamespace)}".</td>
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
          <td>
            <button class="btn-sm-action log-btn" data-pod="${escapeHtml(pod.name)}" data-ns="${escapeHtml(pod.namespace)}">📜 Logs</button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach Log Button Listeners
    podsTableBody.querySelectorAll('.log-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        openPodLogs(btn.dataset.pod, btn.dataset.ns);
      });
    });
  }

  function renderNodesTable(nodes) {
    const query = resourceSearchInput.value.trim().toLowerCase();
    const filtered = nodes.filter(n => {
      if (!query) return true;
      return (
        (n.name && n.name.toLowerCase().includes(query)) ||
        (n.roles && n.roles.toLowerCase().includes(query)) ||
        (n.version && n.version.toLowerCase().includes(query))
      );
    });

    if (filtered.length === 0) {
      nodesTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="loading-cell">No nodes found.</td>
        </tr>
      `;
      return;
    }

    nodesTableBody.innerHTML = filtered.map(node => {
      const isReady = node.status === 'Ready';
      const statusClass = isReady ? 'status-ready' : 'status-failed';

      return `
        <tr>
          <td><span class="status-pill ${statusClass}">${escapeHtml(node.status)}</span></td>
          <td style="font-weight: 600; font-family: monospace;">${escapeHtml(node.name)}</td>
          <td><span class="badge offline-badge">${escapeHtml(node.roles)}</span></td>
          <td style="color: var(--accent-k8s); font-family: monospace;">${escapeHtml(node.version)}</td>
          <td>${escapeHtml(node.cpu)}</td>
          <td>${escapeHtml(node.memory)}</td>
          <td style="color: var(--text-muted);">${escapeHtml(node.age)}</td>
        </tr>
      `;
    }).join('');
  }

  function renderServicesTable(services) {
    const query = resourceSearchInput.value.trim().toLowerCase();
    const filtered = services.filter(s => {
      if (!query) return true;
      return (
        (s.name && s.name.toLowerCase().includes(query)) ||
        (s.namespace && s.namespace.toLowerCase().includes(query)) ||
        (s.clusterIp && s.clusterIp.toLowerCase().includes(query))
      );
    });

    if (filtered.length === 0) {
      servicesTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="loading-cell">No services found in namespace "${escapeHtml(currentNamespace)}".</td>
        </tr>
      `;
      return;
    }

    servicesTableBody.innerHTML = filtered.map(svc => {
      return `
        <tr>
          <td style="font-weight: 600; font-family: monospace;">${escapeHtml(svc.name)}</td>
          <td><span style="color: var(--text-secondary);">${escapeHtml(svc.namespace)}</span></td>
          <td><span class="status-pill status-completed">${escapeHtml(svc.type)}</span></td>
          <td style="font-family: monospace; color: var(--text-secondary);">${escapeHtml(svc.clusterIp)}</td>
          <td style="font-family: monospace;">${escapeHtml(svc.ports)}</td>
          <td style="color: var(--text-muted);">${escapeHtml(svc.age)}</td>
        </tr>
      `;
    }).join('');
  }

  function renderStorageTable(storage) {
    const query = resourceSearchInput.value.trim().toLowerCase();
    const filtered = storage.filter(s => {
      if (!query) return true;
      return (
        (s.name && s.name.toLowerCase().includes(query)) ||
        (s.namespace && s.namespace.toLowerCase().includes(query)) ||
        (s.storageClass && s.storageClass.toLowerCase().includes(query))
      );
    });

    if (filtered.length === 0) {
      storageTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="loading-cell">No storage claims found in namespace "${escapeHtml(currentNamespace)}".</td>
        </tr>
      `;
      return;
    }

    storageTableBody.innerHTML = filtered.map(st => {
      const isBound = st.status === 'Bound';
      const statusClass = isBound ? 'status-bound' : 'status-pending';

      return `
        <tr>
          <td><span class="status-pill ${statusClass}">${escapeHtml(st.status)}</span></td>
          <td style="font-weight: 600; font-family: monospace;">${escapeHtml(st.name)}</td>
          <td><span style="color: var(--text-secondary);">${escapeHtml(st.namespace)}</span></td>
          <td style="font-weight: 600;">${escapeHtml(st.capacity)}</td>
          <td style="color: var(--text-muted);">${escapeHtml(st.storageClass)}</td>
          <td style="font-family: monospace; font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(st.volume)}</td>
          <td style="color: var(--text-muted);">${escapeHtml(st.age)}</td>
        </tr>
      `;
    }).join('');
  }

  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    const intervalSec = parseInt(refreshIntervalInput.value, 10) || 5;
    refreshTimer = setInterval(() => {
      // Refresh resources if active view is a cluster view
      if (['workloads', 'nodes', 'network', 'storage'].includes(currentView)) {
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
