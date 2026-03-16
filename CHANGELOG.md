# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added
- `global` field on MCP server entries in `mcp-config.json` — opt-in to sync across tools (default: `false`)
- `global` field in SKILL.md frontmatter — opt-in to sync skill to providers (default: `true` for backwards compat)
- `--global` flag on `vakt add-skill` and `vakt add-server`
- `--all` flag on `vakt sync` to sync all resources including local-only
- `[global]`/`[local]` tags in `vakt list` output
- `_note` and other `_*` keys in `mcp-config.json` are silently stripped (human-readable comments)

### Changed
- `vakt sync` now only syncs `global: true` MCP servers and skills by default (use `--all` to sync everything)
- `global` is stripped before writing to provider configs (providers don't understand it)

## [0.0.1] - 2025-03-06

### Added

- Initial release of agentctl
- Core CLI commands: `init`, `sync`, `secrets`, `config`, `add-server`, `add-skill`, `list`
- Cross-platform secrets management (macOS Keychain, Linux pass, env fallback)
- Path templating system (`{{paths.code}}`)
- Secret reference system (`secret:KEY_NAME`)
- 5 bundled skills:
  - `skill-creator` - Create and manage new skills
  - `find-skills` - Discover and install skills
  - `credential-best-practices` - Secure credential setup wizard
  - `audit-credentials` - Audit credential security
  - `export-credentials` - Export credentials to deployment targets
- One-line installer (`curl | bash`)
- Comprehensive test suite (97 e2e tests)
- GitHub Actions workflows (CI, Tests, Release)
- Support for 4 AI coding tools: OpenCode, Claude Code, Gemini CLI, Codex

### Security

- Secrets never stored in provider configs
- Secure backend resolution (Keychain/pass/env)
- File permission checks (600 for sensitive files)
- No hardcoded secrets in codebase

### Testing

- 97 end-to-end tests with bats
- Cross-platform testing (macOS + Linux)
- Integration workflow tests
- Security and lint checks in CI

[0.0.1]: https://github.com/yourorg/agentctl/releases/tag/v0.0.1
