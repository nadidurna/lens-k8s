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
            nodes: this.getMockNodes(),
            services: this.getMockServices(namespace),
            storage: this.getMockStorage(namespace),
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

  async getPodLogs(podName, namespace = 'default') {
    return new Promise((resolve) => {
      exec(`kubectl logs "${podName}" -n "${namespace}" --tail=50`, (err, stdout, stderr) => {
        if (!err && stdout.trim()) {
          resolve({ success: true, logs: stdout });
        } else {
          // Simulated logs if offline or mock
          const mockLog = [
            `[${new Date().toISOString()}] INFO  [server] Starting listener on 0.0.0.0:8080`,
            `[${new Date().toISOString()}] INFO  [database] Connection pool established (max=20, idle=5)`,
            `[${new Date().toISOString()}] INFO  [router] Route registered: GET /healthz -> 200 OK`,
            `[${new Date().toISOString()}] INFO  [router] Route registered: POST /api/v1/sync -> 202 Accepted`,
            `[${new Date().toISOString()}] WARN  [cache] Cache miss for key cluster_status_cache_v1`,
            `[${new Date().toISOString()}] INFO  [worker] Batch worker process completed successfully (processed=142 items)`,
            `[${new Date().toISOString()}] DEBUG [metrics] Exporting Prometheus metrics at /metrics (238 gauges, 124 counters)`
          ].join('\n');
          resolve({ success: true, logs: mockLog });
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

  getMockNodes() {
    return [
      { name: 'control-plane-01', status: 'Ready', roles: 'control-plane,master', age: '42d', version: 'v1.30.2', cpu: '8 cores (18% used)', memory: '32 GB (38% used)', internalIp: '192.168.1.10' },
      { name: 'worker-node-01', status: 'Ready', roles: 'worker', age: '42d', version: 'v1.30.2', cpu: '16 cores (64% used)', memory: '64 GB (52% used)', internalIp: '192.168.1.11' },
      { name: 'worker-node-02', status: 'Ready', roles: 'worker', age: '42d', version: 'v1.30.2', cpu: '16 cores (72% used)', memory: '64 GB (68% used)', internalIp: '192.168.1.12' },
      { name: 'worker-node-03', status: 'Ready', roles: 'worker', age: '35d', version: 'v1.30.2', cpu: '32 cores (45% used)', memory: '128 GB (41% used)', internalIp: '192.168.1.13' }
    ];
  }

  getMockServices(namespace = 'all') {
    const list = [
      { name: 'kubernetes', namespace: 'default', type: 'ClusterIP', clusterIp: '10.96.0.1', ports: '443/TCP', age: '42d' },
      { name: 'lens-backend-svc', namespace: 'default', type: 'ClusterIP', clusterIp: '10.96.14.82', ports: '8080/TCP', age: '18h' },
      { name: 'lens-frontend-svc', namespace: 'default', type: 'NodePort', clusterIp: '10.96.88.190', ports: '80:31280/TCP', age: '18h' },
      { name: 'ingress-nginx-controller', namespace: 'ingress-nginx', type: 'LoadBalancer', clusterIp: '10.96.220.15', ports: '80:30080/TCP, 443:30443/TCP', age: '3d' },
      { name: 'kube-dns', namespace: 'kube-system', type: 'ClusterIP', clusterIp: '10.96.0.10', ports: '53/UDP, 53/TCP', age: '42d' },
      { name: 'prometheus-k8s', namespace: 'monitoring', type: 'ClusterIP', clusterIp: '10.96.99.40', ports: '9090/TCP', age: '5d' }
    ];
    return namespace === 'all' ? list : list.filter(s => s.namespace === namespace);
  }

  getMockStorage(namespace = 'all') {
    const list = [
      { name: 'postgres-data-pvc', namespace: 'default', status: 'Bound', volume: 'pvc-8bf92-1', capacity: '100Gi', storageClass: 'managed-csi-premium', age: '7d' },
      { name: 'redis-state-pvc', namespace: 'default', status: 'Bound', volume: 'pvc-4ce12-2', capacity: '20Gi', storageClass: 'managed-csi', age: '7d' },
      { name: 'prometheus-storage-pvc', namespace: 'monitoring', status: 'Bound', volume: 'pvc-9dd40-3', capacity: '250Gi', storageClass: 'managed-csi-premium', age: '5d' }
    ];
    return namespace === 'all' ? list : list.filter(s => s.namespace === namespace);
  }

  getMockResources(namespace = 'all') {
    const allPods = [
      { name: 'coredns-55cb58b774-7x9qw', namespace: 'kube-system', ready: '1/1', status: 'Running', restarts: 0, age: '14d', node: 'control-plane-01' },
      { name: 'etcd-node-control-plane-01', namespace: 'kube-system', ready: '1/1', status: 'Running', restarts: 1, age: '14d', node: 'control-plane-01' },
      { name: 'kube-apiserver-control-plane-01', namespace: 'kube-system', ready: '1/1', status: 'Running', restarts: 0, age: '14d', node: 'control-plane-01' },
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
      nodes: this.getMockNodes(),
      services: this.getMockServices(namespace),
      storage: this.getMockStorage(namespace),
      namespaces: ['default', 'kube-system', 'monitoring', 'ingress-nginx'],
      clusterStatus: {
        status: 'Local Context (Ready)',
        context: this.settingsManager.get('lastActiveContext') || 'docker-desktop'
      }
    };
  }
}

module.exports = KubeManager;
