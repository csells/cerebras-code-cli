# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cerebras Code CLI is a fork of [OpenCode](https://github.com/sst/opencode), adapted for Cerebras's lightning-fast inference. It's a terminal-native AI coding agent with a TUI built on SolidJS + opentui, featuring a dual-agent system (build/plan), multi-provider LLM support, and LSP/MCP integration.

## Common Commands

```bash
bun install              # Install dependencies
bun dev                  # Run CLI in dev mode (from repo root)
bun typecheck            # TypeScript checking across all packages (uses turbo)
bun test                 # Run all tests in opencode package
```

**Running a single test:**
```bash
bun test packages/opencode/test/snapshot/snapshot.test.ts
```

**Regenerate JS SDK** (after modifying `packages/opencode/src/server/server.ts`):
```bash
./packages/sdk/js/script/build.ts
```

**Build for distribution:**
```bash
bun run build
```

## Monorepo Structure

- **Bun workspaces** with **Turbo** for task orchestration
- Package manager: Bun 1.3.7 (enforced via husky pre-push hook)

Key packages:
- `packages/opencode` — Core CLI, agent logic, TUI, server, and provider system
- `packages/util` — Shared utilities (error handling, paths, binary helpers)
- `packages/plugin` — Plugin system (`@opencode-ai/plugin`)
- `packages/sdk/js` — TypeScript SDK generated from OpenAPI schema
- `packages/script` — Script utilities

## Architecture

### CLI Entry Point
`packages/opencode/src/index.ts` — yargs-based CLI with ~17 commands defined in `packages/opencode/src/cli/cmd/`. Commands use a `cmd()` helper wrapper.

### Dual-Agent System
`packages/opencode/src/agent/agent.ts` — Four built-in agents:
- **build** (primary) — Full tool access, default for development tasks
- **plan** (primary) — Read-only with restricted bash (safe commands only)
- **general** (subagent) — General-purpose multi-step task execution
- **explore** (subagent) — Read-only codebase exploration specialist

Agents are configurable via `opencode.jsonc` with permissions for edit, bash patterns, webfetch, etc.

### Provider System
`packages/opencode/src/provider/provider.ts` — Abstraction over multiple LLM providers:
- Cerebras (OpenAI-compatible), Anthropic, OpenAI, Google, Azure, Bedrock, OpenRouter, GitHub Copilot
- All use Vercel AI SDK (`ai` package) with provider-specific SDK adapters
- Custom loaders handle auth, headers, and response format differences

### TUI
`packages/opencode/src/cli/cmd/tui/` — Terminal UI built with SolidJS + `@opentui/solid`. Main app logic in `app.tsx`, with components, context, and routing subdirectories.
- **Sidebar**: `routes/session/sidebar/` contains analytics utilities and beads DAG visualization (`beads-dag.tsx`)

### Configuration
`packages/opencode/src/config/config.ts` — Merged config from:
1. Global: `~/.opencode/config.jsonc`
2. Environment overrides: `OPENCODE_CONFIG`, `OPENCODE_CONFIG_CONTENT`
3. Project: `opencode.jsonc` / `opencode.json` (found via findUp)

Uses JSONC format (JSON with comments) via `jsonc-parser`.

### Instance Context
`packages/opencode/src/project/instance.ts` — Async local storage pattern for dependency injection. `Instance.state()` creates scoped state, `Instance.provide()` sets context.

### Error Handling
`packages/util/src/error.ts` — `NamedError` base class with Zod schema validation, `.create()` factory, and type-safe error instances. Use structured errors, not generic `Error`.

### Logging
`packages/opencode/src/util/log.ts` — File-based logging to `~/.opencode/logs/` with service tags, level filtering, and time measurement.

### Beads Task Management
`packages/opencode/src/session/bead.ts` — DAG-based task tracking using Steve Yegge's [beads](https://github.com/steveyegge/beads) tool (`bd` CLI):
- **Tools**: `beads_create`, `beads_update`, `beads_list`, `beads_show` in `src/tool/beads.ts`
- **Command**: `/beads` lists available tasks and lets users select which to work on
- **Auto-install**: If `bd` CLI isn't found, attempts npm/bun global install
- **Time tracking**: Records start time when status → `in_progress`, calculates duration on close
- **Events**: `bead.updated` event broadcasts changes to TUI sidebar

### Composable Prompt System
`packages/opencode/src/session/prompt/composer.ts` — Assembles model prompts from shared sections:
- **Sections** in `prompt/sections/`: `identity.txt`, `tone-and-style.txt`, `beads-workflow.txt`, `doing-tasks.txt`, `tool-usage.txt`, `code-references.txt`
- **Compose**: `PromptComposer.compose(order, overrides)` builds prompts from sections
- **Model-specific**: Each model can override sections or use custom order
- Eliminates duplication across anthropic.txt, polaris.txt, etc.

## Testing

- Framework: Bun's native test runner (`bun:test`)
- Tests in `packages/opencode/test/`
- Fixture helper: `test/fixture/fixture.ts` provides `tmpdir()` for isolated temp directories with optional git init and auto-cleanup via `await using`

## Style Guide

From `STYLE_GUIDE.md` and `CONTRIBUTING.md`:
- Avoid `try`/`catch` — prefer `.catch()` or pure functions
- Avoid `else` statements — use early returns
- Avoid `any` types and `let` — use precise types and `const`
- Prefer single-word variable names when descriptive
- Use Bun APIs (`Bun.file()`, `Bun.write()`, `$`) over Node equivalents
- Keep logic in one function unless clearly composable/reusable
- No unnecessary destructuring

## Formatting

Prettier with: `semi: false`, `printWidth: 120`
