# agentctl

> Configure your MCP servers and skills once. Use them in every AI coding tool — safely.

```
 your mcps & skills
  ┌────────────────┐
  │  ~/.agents/    │
  │  mcp-config    │──► Claude Code   ~/.claude.json
  │  secrets       │──► Cursor        ~/.cursor/mcp.json
  │  skills/       │──► Gemini CLI    ~/.gemini/settings.json
  │  config.json   │──► Codex         ~/.codex/config.toml
  └────────────────┘──► OpenCode      ~/.config/opencode/opencode.json
                   └──► Windsurf      ~/.codeium/windsurf/mcp_config.json
```

The agent CLI landscape is fragmented. Every tool has its own config format, its own secrets story, its own place to drop skills. You end up copy-pasting the same MCP server definitions across six files, keeping secrets in plaintext, and starting from scratch every time you try a new tool.

**agentctl fixes this.** One directory (`~/.agents/`) is your single source of truth. Secrets stay in your OS keychain. Skills symlink everywhere. Switch from Cursor to Codex to Windsurf without losing a thing.

---

## Get started in 60 seconds

```bash
git clone https://github.com/tn819/agentctl ~/.agentctl
export PATH="$PATH:$HOME/.agentctl/src"

agentctl init                    # scaffold ~/.agents/
agentctl import-from-everywhere  # pull in your existing provider configs
agentctl secrets                 # store API keys in your OS keychain
agentctl sync                    # write to every installed CLI
```

On first run, `init` auto-detects your existing Claude, Cursor, Gemini, and other configs and imports them — so you're not starting from scratch.

---

## Why this exists

| Problem | How agentctl solves it |
|---|---|
| MCP config scattered across 6 tools | Single `~/.agents/mcp-config.json` synced everywhere |
| Secrets in plaintext JSON files | Resolved from OS keychain at sync time, never written to disk |
| Starting over when trying a new CLI | `agentctl sync` populates any new tool instantly |
| Skills only work in one tool | Symlinked into every provider's skills directory |
| Can't easily compare CLIs | Identical context in every tool — apples-to-apples testing |

---

## Commands

```
agentctl init                        Scaffold ~/.agents/, import existing configs
agentctl import-from-everywhere      Pull MCP servers and skills from all detected providers
agentctl sync                        Write config to every installed provider
agentctl sync --dry-run              Preview what would be written

agentctl add-server NAME CMD [ARGS]  Register a stdio MCP server
agentctl add-server NAME --http URL  Register an HTTP MCP server
agentctl add-skill ./path/to/skill   Link a local skill directory
agentctl add-skill https://...       Clone and link a skill from git

agentctl list                        Show servers, skills, and secrets
agentctl list servers
agentctl list skills
agentctl list secrets

agentctl secrets                     Interactive secrets setup
agentctl secrets set KEY VALUE       Store a secret
agentctl secrets get KEY             Retrieve a secret

agentctl config list                 Show current config
agentctl config set paths.code ~/Projects
```

---

## How secrets work

Secrets are **never** written to provider config files. Instead, `mcp-config.json` holds references:

```json
{
  "github": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": {
      "GITHUB_PERSONAL_ACCESS_TOKEN": "secret:GITHUB_TOKEN"
    }
  },
  "my-api": {
    "transport": "http",
    "url": "https://api.example.com/mcp",
    "headers": {
      "Authorization": "Bearer secret:MY_API_KEY"
    }
  }
}
```

At sync time, `secret:KEY` is resolved from your keychain and injected. The plaintext value is written to the provider config temporarily and never persisted in `~/.agents/`.

**Backends:** macOS Keychain (default on macOS) · `pass` (default on Linux) · env file (fallback)

---

## Supported providers

| Provider | Config written | Skills |
|---|---|---|
| **Claude Code** | `~/.claude.json` | `~/.claude/skills/` |
| **Cursor** | `~/.cursor/mcp.json` | `~/.cursor/skills/` |
| **Gemini CLI** | `~/.gemini/settings.json` | native (`~/.agents/skills/`) |
| **Codex** | `~/.codex/config.toml` | `~/.codex/skills/` |
| **OpenCode** | `~/.config/opencode/opencode.json` | `~/.config/opencode/skills/` |
| **Windsurf** | `~/.codeium/windsurf/mcp_config.json` | `~/.codeium/windsurf/skills/` |

`import-from-everywhere` reads from all of these locations too — so anything you've already configured in Cursor or Claude is pulled into `~/.agents/` automatically.

---

## Directory structure

```
~/.agents/
├── config.json          # paths, provider list, secrets backend
├── mcp-config.json      # MCP server definitions (source of truth)
├── AGENTS.md            # shared agent preferences / persona
└── skills/
    ├── gh-cli/          # symlinked into every provider
    ├── sql-reviewer/
    └── ...
```

Path variables in `mcp-config.json` expand from `config.json`:

```json
{ "paths": { "code": "~/Projects", "vault": "~/Documents/vault" } }
```

```json
{ "command": "npx", "args": ["server-filesystem", "{{paths.code}}"] }
```

---

## Skills

Skills are `SKILL.md` files with YAML frontmatter — instructions that travel with the agent into any context. agentctl symlinks `~/.agents/skills/` into every provider's skills directory.

```markdown
---
name: sql-reviewer
description: Review SQL queries for performance and safety issues
---

When reviewing SQL, always check for...
```

Install from git:

```bash
agentctl add-skill https://github.com/vercel-labs/agent-skills react-best-practices
```

Browse: [skills.sh](https://skills.sh) · Spec: [agentskills.io](https://agentskills.io)

---

## Testing

```bash
bats --recursive tests/
```

Tests run in a fully sandboxed `HOME` — nothing touches your real config files.

---

## License

MIT
