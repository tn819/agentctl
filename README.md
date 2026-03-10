# agentctl

> Configure your MCP servers and skills once. Use them in every AI coding tool — with zero plaintext credentials, ever.

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

The agent CLI landscape is fragmented. Every tool has its own config format, its own secrets story, its own place to drop skills. You end up copy-pasting the same MCP server definitions across six files, **scattering API keys in plaintext JSON**, and starting from scratch every time you try a new tool.

**agentctl fixes this.** One directory (`~/.agents/`) is your single source of truth. Secrets never leave your OS keychain. Skills symlink everywhere. Switch from Cursor to Codex to Windsurf without losing a thing — or leaking a credential.

---

## 🔐 Security-first design

Most AI tools write your API keys directly into config files like `~/.cursor/mcp.json`. Those files get picked up by backups, sync services, dotfile repos, and screenshots. **agentctl treats this as unacceptable.**

### Guarantees

- **Zero plaintext secrets on disk.** `~/.agents/mcp-config.json` never contains actual credential values — only named references (`secret:MY_KEY`). The resolved value exists in memory only, for the duration of a sync.
- **OS keychain by default.** On macOS, all secrets are stored in the system Keychain. On Linux, `pass` (GPG-encrypted). No homebrew secrets management, no custom encryption — the same store your browser and SSH agent use.
- **Provider configs contain no credentials.** What agentctl writes to `~/.cursor/mcp.json`, `~/.gemini/settings.json`, etc. are the resolved env vars for that MCP server process — they live in those tool configs as expected, but they are never the source of truth and are never stored in `~/.agents/`.
- **No secrets in shell profiles.** `GITHUB_TOKEN=...` in `.bashrc` is a credential leak waiting to happen. agentctl's secrets backend bypasses this entirely.
- **Auditable reference layer.** You can `cat ~/.agents/mcp-config.json` and share it freely — it contains zero sensitive data. Every credential is a named reference you can audit at a glance.

### Threat model

| Threat | agentctl's defence |
|--------|-------------------|
| Dotfiles repo accidentally public | `mcp-config.json` is safe to commit — no secrets inside |
| iCloud / Dropbox syncing `~/.cursor/` | Credentials rotate at sync time from keychain, not stored long-term |
| Screenshot / screen share leaks config | Nothing sensitive in any file agentctl owns |
| Compromised AI tool reads config files | No credentials in `~/.agents/` — only opaque references |
| Shoulder surfing during `agentctl list` | List output never prints secret values |

### How secret references work

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

At sync time, `secret:GITHUB_TOKEN` is resolved from your keychain and injected into the provider config. **The reference string is what gets committed, shared, or backed up — never the value.**

**Backends:** macOS Keychain · `pass` / GPG (Linux) · base64 env file (CI / fallback)

---

## Get started in 60 seconds

```bash
git clone https://github.com/tn819/agentctl ~/.agentctl
export PATH="$PATH:$HOME/.agentctl/src"

agentctl init                    # scaffold ~/.agents/
agentctl import-from-everywhere  # pull in your existing provider configs
agentctl secrets set GITHUB_TOKEN ghp_...  # store in keychain, not in a file
agentctl sync                    # write to every installed CLI
```

On first run, `init` auto-detects your existing Claude, Cursor, Gemini, and other configs and imports them — so you're not starting from scratch. Any plaintext secrets it finds in those existing configs are flagged so you can migrate them to the keychain.

---

## Why this exists

| Problem | How agentctl solves it |
|---|---|
| MCP config scattered across 6 tools | Single `~/.agents/mcp-config.json` synced everywhere |
| **API keys in plaintext JSON files** | **Resolved from OS keychain at sync time, never persisted** |
| Starting over when trying a new CLI | `agentctl sync` populates any new tool instantly |
| Skills only work in one tool | Symlinked into every provider's skills directory |
| Can't audit what credentials you've handed to AI tools | Every secret is a named reference — full visibility, zero exposure |
| Dotfiles repo leaks credentials | `~/.agents/` is safe to version-control and share |

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

agentctl secrets set KEY VALUE       Store a secret in your OS keychain
agentctl secrets get KEY             Retrieve a secret
agentctl secrets delete KEY          Remove a secret
agentctl secrets list                List all stored secret keys (values never shown)

agentctl config list                 Show current config
agentctl config set paths.code ~/Projects
```

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
├── mcp-config.json      # MCP server definitions (safe to commit — no secrets)
├── AGENTS.md            # shared agent preferences / persona
└── skills/
    ├── gh-cli/          # symlinked into every provider
    ├── sql-reviewer/
    └── ...
```

Path variables expand from `config.json` at sync time:

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

Tests run in a fully sandboxed `HOME` — nothing touches your real config files or keychain.

---

## License

MIT
