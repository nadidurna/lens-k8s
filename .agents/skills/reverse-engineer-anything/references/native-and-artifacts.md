# Native and Packaged Artifacts Reference

## 1. PE & NSIS Installers
Many Windows applications (such as Lens, Slack, Discord, VS Code) ship as self-extracting NSIS installers.
- An NSIS installer wraps a 32-bit bootstrap stub around compressed LZMA / 7z streams.
- To inspect the container without running it:
  ```powershell
  npx -y rea-agents@latest inspect-artifact <installer.exe> --json
  ```
- To unpack an NSIS installer on Windows:
  Use 7-Zip (`7z x <installer.exe> -o<output_dir>`) or a PowerShell extraction tool to unpack the inner payloads (`app-64.7z` or `$PLUGINSDIR`).

## 2. Go Binary Metadata
Go binaries often embed full compiler, build, and dependency manifests.
- Command:
  ```powershell
  npx -y rea-agents@latest inspect-go-binary <binary-path> --json
  ```
- Output details:
  - Exact Go compiler version (`devel`, `go1.22.x`, etc.)
  - Complete list of module paths and semantic versions
  - Build settings (flags, vcs revision, tags)

## 3. Rust Dependency Metadata
Rust binaries built with `cargo-auditable` embed dependency metadata in `.dep-v0`.
- Command:
  ```powershell
  npx -y rea-agents@latest inspect-rust-binary <binary-path> --json
  ```
- Output details:
  - Full dependency graph
  - Crate versions and source hashes

## 4. SQLite Snapshots
To inspect schemas and extract table rows from local desktop app databases (e.g. IndexedDB, local storage, history):
```powershell
npx -y rea-agents@latest inspect-sqlite-database <db-path> --json
```
- Includes schema structure, table definitions, and row samples.
- Safely handles companion WAL files (`-wal`) without corrupting production data.
