# agentctl

Provider-agnostic MCP server and skills manager. One config, all AI coding tools.

**What it does:**

- Single source of truth in `~/.agents/` for MCP servers and skills
- Syncs to OpenCode, Claude Code, Gemini CLI, and Codex
- Cross-platform secrets management (macOS Keychain, Linux pass)
- Configurable paths via JSON config

## Installation

```bash
curl -fsSL https://raw.githubusercontent.com/yourorg/agentctl/main/install.sh | bash
```

Or manually:

```bash
git clone https://github.com/yourorg/agentctl ~/.agentctl
export PATH="$PATH:$HOME/.agentctl/src"
```

## Quick Start

```bash
# 1. Initialize ~/.agents/
agentctl init

# 2. Edit config with your paths
nano ~/.agents/config.json

# 3. Add your API keys
agentctl secrets

# 4. Sync to all providers
agentctl sync
```

## Commands

```
agentctl init                    Create ~/.agents/ with templates
agentctl sync                    Sync MCP servers and skills to all providers
agentctl secrets                 Manage secrets interactively
agentctl secrets set KEY VALUE   Set a secret
agentctl secrets get KEY         Get a secret value
agentctl config list             Show current config
agentctl config set paths.code ~/Projects
agentctl add-server name npx -y my-mcp
agentctl add-skill ./my-skill
agentctl list                    List servers, skills, and secrets
agentctl upgrade                 Update to latest version
```

## Directory Structure

```
~/.agents/
├── config.json          # User configuration (paths, providers)
├── mcp-config.json      # MCP server definitions
├── AGENTS.md            # Agent preferences
└── skills/              # Skill definitions (SKILL.md files)
    ├── gh-cli/
    ├── copywriting/
    └── ...
```

## Configuration

### config.json

```json
{
  "paths": {
    "code": "~/Code",
    "documents": "~/Documents",
    "vault": "~/Documents/vault"
  },
  "providers": ["opencode", "claude", "gemini", "codex"],
  "secretsBackend": "auto"
}
```

**secretsBackend options:**

- `auto` - Auto-detect (keychain on macOS, pass on Linux)
- `keychain` - macOS Keychain only
- `pass` - Linux pass only
- `env` - Environment file (not recommended for production)

### mcp-config.json

```json
{
  "filesystem": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "{{paths.code}}"]
  },
  "github": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": {
      "GITHUB_PERSONAL_ACCESS_TOKEN": "secret:GITHUB_PERSONAL_ACCESS_TOKEN"
    }
  },
  "buffer": {
    "transport": "http",
    "url": "https://mcp.buffer.com/mcp",
    "headers": {
      "Authorization": "Bearer secret:BUFFER_ACCESS_TOKEN"
    }
  }
}
```

**Path variables:**

- `{{paths.code}}` - Expands to `config.json` paths.code value
- `{{paths.documents}}` - Expands to paths.documents
- `{{paths.vault}}` - Expands to paths.vault

**Secret references:**

- `secret:KEY_NAME` - Resolved from your secrets backend at sync time

## Skills

Skills are stored as `SKILL.md` files with YAML frontmatter:

```
~/.agents/skills/my-skill/
├── SKILL.md
├── references/
│   └── examples.md
└── scripts/
    └── helper.sh
```

SKILL.md format:

```markdown
---
name: my-skill
description: What this skill does
---

# Skill Name

Instructions for the AI agent...
```

### Adding Skills

From a local directory:

```bash
agentctl add-skill ./path/to/skill
```

From a git repository:

```bash
agentctl add-skill https://github.com/user/skill-repo skill-name
```

## Supported Providers

| Provider    | Config Location                    | Status       |
| ----------- | ---------------------------------- | ------------ |
| OpenCode    | `~/.config/opencode/opencode.json` | Full support |
| Claude Code | `~/.claude.json`                   | Full support |
| Gemini CLI  | `~/.gemini/settings.json`          | Full support |
| Codex       | `~/.codex/config.toml`             | Full support |
| Cursor      | Coming soon                        | Planned      |
| Windsurf    | Coming soon                        | Planned      |

## Secrets Management

### macOS (Keychain)

Secrets stored in macOS Keychain under service `agentctl`:

```bash
# List secrets
security dump-keychain | grep -A2 "agrp:\"agentctl\""

# Manual add
security add-generic-password -s "agentctl" -a "MY_KEY" -w "myvalue" -U
```

### Linux (pass)

Secrets stored via `pass` under `agentctl/`:

```bash
# Requires pass setup
pass init your-gpg-id

# List secrets
pass ls agentctl/

# Manual add
pass insert agentctl/MY_KEY
```

### Environment File (Fallback)

If no secrets manager is available, secrets stored in `~/.agents/secrets.env`:

```bash
MY_KEY=myvalue
OTHER_KEY=othervalue
```

## How It Works

1. **Source of Truth**: `~/.agents/` contains all MCP configs, skills, and preferences
2. **Sync**: Translates your config to each provider's format
3. **Secrets**: Resolved at sync time (never stored in provider configs)
4. **Paths**: Template variables expanded from your config.json

When you run `agentctl sync`:

1. Reads `~/.agents/mcp-config.json`
2. Resolves `secret:KEY` references from your secrets backend
3. Expands `{{paths.X}}` variables from config.json
4. Writes provider-specific configs to each AI tool
5. Symlinks skills to each provider's skills directory

## Included Skills

This package includes these skills by default:

- **skill-creator** - Create and manage new skills
- **find-skills** - Discover available skills from registries
- **credential-best-practices** - Secure local credential management setup
- **audit-credentials** - Audit credential setup for security compliance
- **export-credentials** - Export credentials to GitHub Secrets and other destinations

Additional skills can be installed from git repositories:

```bash
agentctl add-skill https://github.com/user/skill-repo
```

## License

MIT

## Release Process

### Option 1: GitHub UI (Recommended)

1. Go to the **Actions** tab on GitHub
2. Select the **Release** workflow
3. Click **Run workflow**
4. Enter the version (e.g., `v0.0.2`)
5. Click **Run workflow**

The workflow will:
- Run tests on the `develop` branch
- Merge `develop` into `main`
- Create a GitHub Release with changelog
- Upload a tarball for download

### Option 2: Manual Release

```bash
# 1. Update version in src/agentctl.sh
#    Change the version() function output

# 2. Update CHANGELOG.md
#    Add new version section at the top

# 3. Commit changes
git add src/agentctl.sh CHANGELOG.md
git commit -m "chore: bump version to v0.0.2"

# 4. Push to develop
git push origin develop

# 5. Create and push tag
git tag v0.0.2
git push origin v0.0.2

# GitHub Actions will:
# - Run tests
# - Merge develop → main
# - Create release with changelog
```

### Version Format

Use semantic versioning:
- `v0.0.1` - Patch release (bug fixes)
- `v0.1.0` - Minor release (new features)
- `v1.0.0` - Major release (breaking changes)

## Testing

Run `bats tests/` to execute the test suite.
