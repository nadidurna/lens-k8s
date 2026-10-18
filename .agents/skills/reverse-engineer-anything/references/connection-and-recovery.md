# Connection, Troubleshooting, and Recovery

## 1. Prerequisites
- **Node.js**: Requires Node.js >= 22.19 (tested with Node 22.23.1).
- **npm / npx**: Available on PATH.
- **Optional Native Disassemblers**: Hopper, Ghidra, IDA Pro, or Cutter (only required for deep native binary decompilation). Static JavaScript and artifact container analysis do NOT require any disassembler.

## 2. Diagnostics
To verify REA readiness and test client connections:
```powershell
npx -y rea-agents@latest doctor --client antigravity --json
```

To test MCP server stdio health:
```powershell
npx -y rea-agents@latest mcp doctor --json
```

## 3. Resolving Common Issues
- **`npx` TLS certificate warning**: Normal in corporate environments or custom proxy setups (`NODE_TLS_REJECT_UNAUTHORIZED`).
- **`command not found: rea`**: Run via `npx -y rea-agents@latest <command>` or install globally using `npm install -g rea-agents`.
- **Large output truncation**: Always use `--filter-output` or `--format json` to target specific fields when examining large artifact graphs.
