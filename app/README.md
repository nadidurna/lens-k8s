# K8s Local Lens

A clean-room, local-first, zero-login Kubernetes desktop manager and cluster observer.

---

## 🎯 Design Goals

1. **100% Offline & Local-First:** No accounts, no cloud authentication, no telemetry, no subscription prompts.
2. **Context & Settings Preservation:** Automatically reads your active `~/.kube/config` (or `$KUBECONFIG`), preserves contexts, and stores all user preferences in `~/.k8s-local-lens/settings.json`.
3. **Dual Execution Architecture:**
   - **Desktop App (Electron):** Runs as a standalone desktop window with native OS integration.
   - **Local Web Server (Node.js):** Runs via built-in HTTP server (`http://localhost:3721`) without requiring Electron dependencies.

---

## 🚀 Getting Started

### 1. Running as Local Web Dashboard (Instant, Zero Setup)
```bash
node src/main/server.js
```
Open [http://localhost:3721](http://localhost:3721) in your browser.

### 2. Running as Native Electron Desktop App
```bash
npm install
npm start
```

---

## 📁 Project Structure

```text
app/
├── package.json               # Package configuration & scripts
├── main.js                    # Electron main process & IPC handlers
├── README.md                  # Project documentation
└── src/
    ├── main/
    │   ├── kubeManager.js     # Kubeconfig discovery, kubectl integration & fallback mock data
    │   ├── settingsManager.js # Local JSON persistence in ~/.k8s-local-lens/
    │   └── server.js          # Built-in lightweight HTTP & REST API server
    ├── preload.js             # Electron contextBridge secure API
    └── renderer/
        ├── index.html         # Modern Kubernetes cluster dashboard UI
        ├── style.css          # Sleek dark-mode theme
        └── app.js             # Context switching, pod search, and real-time metrics
```
