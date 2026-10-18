# JavaScript and Electron Application Reverse Engineering

## 1. Electron Application Architecture
Electron applications combine Chromium and Node.js. Typically, an installer extracts to:
- Executable binary (`App.exe` or macOS binary)
- `resources/app.asar` or `resources/app/` (contain the bundled frontend and backend code)
- `resources/electron.asar` (internal Electron framework logic)

## 2. Analyzing ASAR Archives
When you encounter an `.asar` archive or extracted directory:

1. **Static Module Analysis**:
   ```powershell
   npx -y rea-agents@latest analyze-javascript-application <path-to-asar-or-folder> --json
   ```
   REA parses the bundle, traces Webpack/Vite chunk imports, resolves package aliases (`#alias`), and maps out:
   - Entry points (`package.json`, `main.js`, `preload.js`)
   - IPC communication channels (`ipcRenderer.send`, `ipcMain.on`, `ipcRenderer.invoke`)
   - Native Node addon bindings (`.node` files)

2. **Recovering Readable Sources**:
   If modules are heavily minified or bundled:
   ```powershell
   npx -y rea-agents@latest recover-javascript-sources <path-to-bundle> --json
   ```

## 3. Electron Fuses Inspection
Electron uses compile-time fuses embedded in the binary to disable features for security:
```powershell
npx -y rea-agents@latest inspect-electron-fuses <path-to-electron-executable> --json
```

Key Fuses to Observe:
- `runAsNode`: Allows running the executable as Node via `ELECTRON_RUN_AS_NODE=1`.
- `enableNodeCliInspectArguments`: If `false`, `--inspect` and `--inspect-brk` flags are ignored.
- `enableEmbeddedAsarIntegrityValidation`: Validates ASAR header checksum before mounting.
- `onlyLoadAppFromAsar`: Enforces that only bundled ASAR files can be loaded.

## 4. Tracing Application Features
To trace a specific capability (e.g. search, license check, cluster connection):
1. Locate `preload.js` and list context bridge exposed functions (`contextBridge.exposeInMainWorld`).
2. Search for the handler in the main process (`ipcMain.handle("<channel-name>")`).
3. Follow imported backend modules to inspect core business logic.
