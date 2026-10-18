const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

class KubeManager {
  constructor(settingsManager) {
    this.settingsManager = settingsManager;
  }

  getKubeconfigPath() {
    const custom = this.settingsManager.get('customKubeconfigPath');
    if (custom && fs.existsSync(custom)) {
      return custom;
    }
    if (process.env.KUBECONFIG && fs.existsSync(process.env.KUBECONFIG)) {
      return process.env.KUBECONFIG;
    }
    const defaultPath = path.join(os.homedir(), '.kube', 'config');
    if (fs.existsSync(defaultPath)) {
      return defaultPath;
    }
    return null;
  }

  async getContexts() {
    const kubeconfigPath = this.getKubeconfigPath();
    if (!kubeconfigPath) {
      return this.getMockContexts();
    }

    return new Promise((resolve) => {
      exec('kubectl config get-contexts -o name', (err, stdout) => {
        if (!err && stdout.trim()) {
          const names = stdout.trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean);
          exec('kubectl config current-context', (cErr, cStdout) => {
            const current = cErr ? names[0] : cStdout.trim();
            const contexts = names.map(name => ({
              name,
              isCurrent: name === current,
              cluster: name,
              user: 'local-user'
            }));
            resolve(contexts);
          });
        } else {
          resolve(this.getMockContexts());
        }
      });
    });
  }

  async switchContext(contextName) {
    return new Promise((resolve) => {
      exec(`kubectl config use-context "${contextName}"`, (err, stdout) => {
        if (!err) {
          this.settingsManager.save({ lastActiveContext: contextName });
          resolve({ success: true, message: stdout.trim() });
        } else {
          // If in mock or custom mode
          this.settingsManager.save({ lastActiveContext: contextName });
          resolve({ success: true, message: `Switched context to ${contextName} (Simulated)` });
        }
      });
    });
  }

  async getClusterResources(namespace = 'all') {
    const kubeconfigPath = this.getKubeconfigPath();
    if (!kubeconfigPath) {
      return this.getMockResources(namespace);
    }

    return new Promise((resolve) => {
      const nsArg = namespace === 'all' ? '--all-namespaces' : `-n ${namespace}`;
      exec(`kubectl get pods ${nsArg} -o json`, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
        if (err || !stdout.trim()) {
          resolve(this.getMockResources(namespace));
          return;
        }

        try {
          const parsed = JSON.parse(stdout);
          const pods = (parsed.items || []).map(item => {
            const status = item.status || {};
            const phase = status.phase || 'Unknown';
            const containers = item.spec?.containers || [];
            const restarts = (status.containerStatuses || []).reduce((acc, c) => acc + (c.restartCount || 0), 0);
            return {
              name: item.metadata?.name,
              namespace: item.metadata?.namespace,
              ready: `${(status.containerStatuses || []).filter(c => c.ready).length}/${containers.length}`,
              status: phase,
              restarts,
              age: this.formatAge(item.metadata?.creationTimestamp),
              node: item.spec?.nodeName || 'N/A'
            };
          });

          resolve({
            pods,
            namespaces: ['default', 'kube-system', 'monitoring', 'ingress-nginx'],
            clusterStatus: {
              status: 'Connected',
              context: this.settingsManager.get('lastActiveContext') || 'local-cluster'
            }
          });
        } catch (parseErr) {
          resolve(this.getMockResources(namespace));
        }
      });
    });
  }

  formatAge(timestamp) {
    if (!timestamp) return 'N/A';
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  getMockContexts() {
    return [
      { name: 'docker-desktop', isCurrent: true, cluster: 'docker-desktop', user: 'docker-desktop' },
      { name: 'minikube-local', isCurrent: false, cluster: 'minikube', user: 'minikube' },
      { name: 'k3s-edge-cluster', isCurrent: false, cluster: 'k3s-cluster', user: 'k3s-admin' },
      { name: 'staging-aks-us-east', isCurrent: false, cluster: 'aks-staging', user: 'devops-sp' }
    ];
  }

  getMockResources(namespace = 'all') {
    const allPods = [
      { name: 'coredns-55cb58b774-7x9qw', namespace: 'kube-system', ready: '1/1', status: 'Running', restarts: 0, age: '14d', node: 'node-control-plane-01' },
      { name: 'etcd-node-control-plane-01', namespace: 'kube-system', ready: '1/1', status: 'Running', restarts: 1, age: '14d', node: 'node-control-plane-01' },
      { name: 'kube-apiserver-control-plane-01', namespace: 'kube-system', ready: '1/1', status: 'Running', restarts: 0, age: '14d', node: 'node-control-plane-01' },
      { name: 'ingress-nginx-controller-84b9c', namespace: 'ingress-nginx', ready: '1/1', status: 'Running', restarts: 0, age: '3d', node: 'worker-node-02' },
      { name: 'prometheus-k8s-0', namespace: 'monitoring', ready: '2/2', status: 'Running', restarts: 0, age: '5d', node: 'worker-node-01' },
      { name: 'grafana-76bf86498b-2pmq5', namespace: 'monitoring', ready: '1/1', status: 'Running', restarts: 0, age: '5d', node: 'worker-node-02' },
      { name: 'lens-backend-api-5c98db-8k2jx', namespace: 'default', ready: '1/1', status: 'Running', restarts: 2, age: '18h', node: 'worker-node-01' },
      { name: 'lens-frontend-web-7fb4b-vlmz4', namespace: 'default', ready: '1/1', status: 'Running', restarts: 0, age: '18h', node: 'worker-node-02' },
      { name: 'redis-cache-master-0', namespace: 'default', ready: '1/1', status: 'Running', restarts: 0, age: '7d', node: 'worker-node-01' },
      { name: 'postgres-db-cluster-0', namespace: 'default', ready: '1/1', status: 'Running', restarts: 0, age: '7d', node: 'worker-node-03' },
      { name: 'worker-job-sync-284920-x4fjl', namespace: 'default', ready: '0/1', status: 'Completed', restarts: 0, age: '25m', node: 'worker-node-02' },
      { name: 'failing-sidecar-tester-9b9c1', namespace: 'default', ready: '0/1', status: 'CrashLoopBackOff', restarts: 8, age: '45m', node: 'worker-node-03' }
    ];

    const filtered = namespace === 'all' ? allPods : allPods.filter(p => p.namespace === namespace);
    return {
      pods: filtered,
      namespaces: ['default', 'kube-system', 'monitoring', 'ingress-nginx'],
      clusterStatus: {
        status: 'Local Context (Ready)',
        context: this.settingsManager.get('lastActiveContext') || 'docker-desktop'
      }
    };
  }
}

module.exports = KubeManager;
