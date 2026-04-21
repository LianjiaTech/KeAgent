# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**KeAgent** (ClawX) is an Electron-based desktop application that provides a GUI for OpenClaw AI agents. It bridges the gap between powerful AI agents and everyday users by transforming command-line AI orchestration into an accessible desktop experience.

## Common Commands

```bash
# Initialize project (install deps + download uv)
pnpm run init

# Development with hot reload
pnpm dev

# Linting
pnpm lint

# Type checking
pnpm typecheck

# Unit tests
pnpm test

# Build for production
pnpm run build

# Package for specific platforms
pnpm package:mac
pnpm package:win
pnpm package:linux
```

## Architecture

### Dual-Process Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ClawX Desktop App│
│┌────────────────────────────────────────────────────────────┐  │
│  │              Electron Main Process                          │  │
│  │  • Window & application lifecycle management               │  │
│  │  • Gateway process supervision                              │  │
│  │  • System integration (tray, notifications, keychain)       │  │
│  │  • Auto-update orchestration                                │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              │ IPC (authoritative control plane)  │
│                              ▼                                    │
│┌────────────────────────────────────────────────────────────┐  │
│  │              React Renderer Process                         │  │
│  │  • Modern component-based UI (React 19)                     │  │
│  │  • State management with Zustand                            │  │
│  │  • Unified host-api/api-client calls                        │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘└─────────────────────────────────────────────────────────────────┐
│                     OpenClaw Gateway│
│  • AI agent runtime and orchestration                           │
│  • Message channel management                                    │
│  • Skill/plugin execution environment                           │
└─────────────────────────────────────────────────────────────────┘
```

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `electron/main/` | App entry, windows, IPC registration |
| `electron/gateway/` | OpenClaw Gateway process manager |
| `electron/api/routes/` | RPC/HTTP proxy route modules |
| `electron/services/` | Provider, secrets and runtime services |
| `electron/utils/` | Utilities (storage, auth, paths, config) |
| `electron/preload/` | Secure IPC bridge |
| `src/` | React renderer process |
| `src/stores/` | Zustand stores (settings/chat/gateway) |
| `src/pages/` | Setup/Dashboard/Chat/Channels/Skills/Cron/Settings |
| `src/i18n/` | Localization resources (en/zh/ja) |

### OpenClaw Configuration

The OpenClaw configuration is stored in `~/.openclaw/openclaw.json`. Key sections:

```json
{
  "agents": {
    "defaults": {
      "workspace": "~/.openclaw/workspace",
      "model": "provider/model-name"
    },
    "list": [
      {
        "id": "main",
        "name": "Main Agent",
        "default": true,
        "workspace": "~/.openclaw/workspace",
        "agentDir": "~/.openclaw/agents/main/agent"
      }
    ]
  },
  "bindings": [
    { "agentId": "main", "match": { "channel": "telegram" } }
  ],
  "channels": {
    "telegram": {
      "botToken": "...",
      "allowFrom": ["*"]
    }
  }
}
```

### Agent Bootstrap Files

Each agent workspace contains these bootstrap files:
- `AGENTS.md` - Main agent instructions
- `SOUL.md` - Agent personality
- `IDENTITY.md` - Agent identity
- `TOOLS.md` - Tool usage instructions
- `USER.md` - User-specific customizations

### IPC Communication

The renderer communicates with main process via IPC channels defined in `electron/preload/index.ts`. Key patterns:

1. **Invoke (request-response)**: `ipcRenderer.invoke('channel:name', args)`
2. **Events (push)**: `ipcRenderer.on('channel:name', callback)`

## Multi-Agent System

KeAgent supports multiple agents with channel bindings:

1. **Agent creation**: Creates workspace directory + agent config entry
2. **Channel binding**: Associates a channel account with an agent
3. **Workspace isolation**: Each agent has its own `workspace-{id}` directory

## Channel Configuration

Channels support multiple accounts per channel type:
- `channels.{type}.accounts.{accountId}` - Per-account credentials
- `channels.{type}.defaultAccount` - Default account ID
- `bindings` - Maps channel accounts to agents

## Skills Management

Skills are managed via the `clawhub` npm package:
- Search/install from ClawHub registry
- Installed to `~/.openclaw/skills/`
- Tracked in `~/.openclaw/.clawhub/lock.json`

## Bundled Skills

Pre-installed skills are bundled in `resources/preinstalled-skills/` and deployed on first launch:
- `pdf`, `xlsx`, `docx`, `pptx` - Document processing
- `find-skills`, `self-improving-agent` - No API keys required
- `tavily-search`, `brave-web-search` - Web search (require API keys)

## Important Files

| File | Purpose |
|------|---------|
| `electron/utils/channel-config.ts` | Channel configuration management |
| `electron/utils/agent-config.ts` | Agent configuration management |
| `electron/gateway/manager.ts` | Gateway process lifecycle |
| `electron/api/server.ts` | Main-side API router |
| `src/lib/api-client.ts` | Unified frontend API layer |
| `src/lib/host-api.ts` | Host API client with error mapping |
