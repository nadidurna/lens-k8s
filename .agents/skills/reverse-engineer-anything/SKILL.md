---
name: reverse-engineer-anything
description: >-
  Reverse engineer native, managed, Electron/JavaScript, packaged, firmware, and browser targets using REA.
  Use shipped-artifact inspection, ASAR extraction, Electron fuse checking, decompilation, and passive runtime
  evidence to explain features, compare versions, or guide reconstructions. Use this skill whenever inspecting
  executables (PE, ELF, Mach-O), Electron/Node apps, APKs, or network captures.
metadata:
  version: "1.0.0"
  provider: "morluto/rea"
  target_environments: ["windows", "linux", "darwin"]
---

# Reverse Engineer Anything (REA) for Antigravity

This skill enables Antigravity to reverse-engineer local software targets—including desktop applications,
Electron apps, native binaries, installers, mobile packages, and web runtime captures—using the REA
(Reverse Engineer Anything) toolkit and verified evidence workflows.

---

## 1. Quick Route: Identifying Your Target

When given a file or target in the workspace, determine its type and use the matching workflow:

| Target Type | Primary Command / Approach | Reference Guide |
| :--- | :--- | :--- |
| **Electron App / ASAR** | `npx -y rea-agents@latest analyze-javascript-application <path> --json` | [JavaScript Applications](./references/javascript-applications.md) |
| **Electron Executable / Fuses** | `npx -y rea-agents@latest inspect-electron-fuses <path> --json` | [JavaScript Applications](./references/javascript-applications.md) |
| **Installer / Container (PE, NSIS)** | `npx -y rea-agents@latest inspect-artifact <path> --json` | [Native & Artifacts](./references/native-and-artifacts.md) |
| **Go Binary Metadata** | `npx -y rea-agents@latest inspect-go-binary <path> --json` | [Native & Artifacts](./references/native-and-artifacts.md) |
| **Rust Binary Crates** | `npx -y rea-agents@latest inspect-rust-binary <path> --json` | [Native & Artifacts](./references/native-and-artifacts.md) |
| **SQLite Snapshot** | `npx -y rea-agents@latest inspect-sqlite-database <path> --json` | [Native & Artifacts](./references/native-and-artifacts.md) |
| **Network Capture (HAR, SAZ)** | `npx -y rea-agents@latest inspect-web-network-capture <path> --json` | [Evidence Workflows](./references/evidence-workflows.md) |

---

## 2. Execution Modes in Antigravity

REA can be invoked in two ways:

### Mode A: Direct CLI Runner (Default, zero configuration required)
Run REA commands directly in the terminal using `npx -y rea-agents@latest <command> <args> --json`
or via the helper script:
```powershell
.\.agents\skills\reverse-engineer-anything\scripts\rea-cli.ps1 <command> <args>
```

### Mode B: Native MCP Server
REA provides a full MCP server with 200+ specialized tools. To connect REA as a persistent MCP server
in Antigravity, add it to your global or plugin `mcp_config.json`:
```json
{
  "mcpServers": {
    "rea": {
      "command": "npx",
      "args": ["-y", "rea-agents@latest", "--mcp"]
    }
  }
}
```

---

## 3. Core Investigation Workflow

Follow this 4-step loop for all reverse engineering tasks:

1. **Fingerprint the Target**:
   Compute hashes (SHA-256), file size, and inspect high-level artifact properties:
   ```powershell
   npx -y rea-agents@latest inspect-artifact <target-file> --json
   ```

2. **Decompose / Unpack**:
   - For NSIS installers (`.exe`), unpack with 7-Zip or an extraction tool to locate the payload (`resources/app.asar` or `app-64.7z`).
   - For Electron applications, extract the ASAR archive or run:
     ```powershell
     npx -y rea-agents@latest analyze-javascript-application <extracted-dir-or-asar> --json
     ```

3. **Inspect Fuses & Security Boundaries**:
   Check if Electron fuses permit Node.js inspect or remote debugging:
   ```powershell
   npx -y rea-agents@latest inspect-electron-fuses <binary-path> --json
   ```

4. **Trace Features & Build Evidence**:
   - Trace IPC channels (`ipcRenderer.invoke`, `ipcMain.handle`).
   - Identify API routes, license verification checks, or authentication flows.
   - Record claims only with matching `evidence_id` hashes returned by REA tools.

---

## 4. Verification & Evidence Integrity

- Never speculate or infer behavior without cited file evidence, code locations, or observed runtime data.
- Read `normalized_result` in REA JSON outputs to retrieve structured discoveries.
- Record any unanswered questions or missing engine prerequisites as explicit unknowns.
