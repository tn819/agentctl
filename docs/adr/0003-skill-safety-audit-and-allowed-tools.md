---
status: proposed
date: 2026-03-15
---

# 0003 — Skill safety audit and `allowed-tools` frontmatter support

## Context

vakt manages the full control plane for AI coding agents: MCP server config, policy enforcement, secret injection, and an audit log of every tool call. Skills are the other side of that equation — they define the *behaviour* layer, injecting instructions into the agent at runtime.

Until now, vakt has been blind to skills. It syncs them to providers (Claude Code, Cursor, Gemini CLI, etc.) but has no view of what each skill asks the agent to do or which tools it expects to use. That blind spot becomes a real problem as skills proliferate:

**Unscoped skills are ambient-capability risks.** A skill that says "here is how to deploy to production" but does not declare `allowed-tools` can direct the agent to use any tool available — Bash, file writes, network calls — without the operator or user knowing in advance what surface area the skill covers.

**`allowed-tools` exists but vakt ignores it.** Claude Code already supports an `allowed-tools` YAML frontmatter field in SKILL.md that limits which of Claude's own tools (Bash, Read, Write, Edit, etc.) a skill may direct it to use. Other platforms (Cursor, Gemini CLI, Codex, GitHub Copilot) ignore this field gracefully rather than breaking on it — skill content is fully interoperable; the annotation is Claude Code-specific. vakt currently discards this field when syncing.

**No skills.sh/audits equivalent at install time.** [skills.sh/audits](https://skills.sh/audits) shows a security audit table for published skills — Gen Agent Trust Hub status, Socket alerts, Snyk risk ratings. There is no equivalent local view for skills already installed on a developer's machine: no summary of what tools they claim, no policy compliance check, no way to spot an unscoped skill without reading every SKILL.md manually.

**Two distinct tool namespaces.** `allowed-tools` names Claude Code's built-in tools (`Bash`, `Read`, `Write`, `Edit`, `WebSearch`, etc.). vakt's `PolicyEngine` operates on MCP server tool names (e.g., `github/create_issue`, `filesystem/read_file`). These are different layers, operated by different parties. Any policy integration must be explicit about which namespace it operates in.

## Decision

We will add first-class `allowed-tools` support to vakt across four areas:

### 1. Frontmatter parser (`src/lib/skills.ts`, new)

A new `parseSkillFrontmatter(content: string): SkillMeta` function parses the YAML `---…---` block from a SKILL.md file, extracting `name`, `description`, `version`, and `allowed-tools`. No new npm dependency is added — only two array patterns appear in practice:

```yaml
allowed-tools: [Bash, Read, Write]       # inline array
allowed-tools:                            # block array
  - Bash
  - Read
```

A companion `readSkillMeta(skillDir: string): SkillMeta` reads `SKILL.md` from a skill directory and returns the parsed meta.

### 2. Policy schema extension (`src/lib/schemas.ts`)

An optional `skills` section is added to `PolicySchema`:

```json
{
  "skills": {
    "scopeRequired": true
  }
}
```

`scopeRequired: true` means: the pre-sync safety gate treats an unscoped skill as an error (default severity is `warn`). Default is `false` — no behaviour change for existing users.

### 3. `vakt list` output (`src/commands/list.ts`)

`printSkills()` is updated to call `readSkillMeta()` and display the `allowed-tools` value alongside each skill. Skills with no declaration show `⚠ unscoped`. This makes the tool surface of every installed skill visible at a glance.

### 4. `vakt audit skills` subcommand (`src/commands/audit.ts`)

A new subcommand provides the skills.sh/audits equivalent view for locally installed skills:

```
SKILL                  TOOLS                    SCOPED   POLICY
audit-credentials      Bash                     ✓        ✓ allow
credential-best-prac…  Bash, Write              ✓        ✓ allow
find-skills            —                        ⚠ no     —
```

- `--json` emits `{ name, allowedTools, scoped, hazards }[]` for piping / SIEM integration.

> **Future work:** A `--policy-check` flag is planned to map each declared tool name against `PolicyEngine.checkTool("*", toolName)` to catch broad deny patterns. Not implemented in this iteration due to the namespace mismatch between Claude Code tool names and MCP tool names (documented in Alternatives Considered).

### 5. `vakt sync` integration (`src/commands/sync.ts`)

A unified pre-sync safety gate (`src/lib/sync-gate.ts`) runs before any writes. It checks both skills (unscoped, hazards) and MCP servers (unpinned-npx, http-url, unverified), then presents a summary. Two flags control gate behaviour:

- `--ci` — non-interactive; gate errors block sync (exit 1), warnings pass through
- `--force` — skip the gate entirely (useful in scripts and tests)

When `policy.skills.scopeRequired` is set, the gate escalates unscoped-skill findings from `warn` to `error`. When `policy.skills.blockOnHazards` is set, hazard findings are escalated to `error`. This replaces the earlier `--strict-skills` design (dropped before shipping) with a more general gate that covers both skills and MCP servers.

### 6. `skill-creator/SKILL.md` update

The `allowed-tools` field is documented as optional in the frontmatter reference, with a note explaining its cross-platform behaviour and the unscoped-skill warning it avoids.

## Alternatives Considered

### Parse full YAML with a library (e.g., `yaml` npm package)

A full YAML parser handles all edge cases: multi-line strings, quoted scalars, nested maps, anchors.

**Why not chosen:** The only YAML that appears in SKILL.md frontmatter is scalar strings and flat string arrays. Adding a 35 kB dependency (yaml@2) to handle two array patterns that fit in 20 lines of regex is not justified. If the frontmatter schema grows, we can add the dependency then.

### Add `allowed-tools` to the vakt skills registry index (`SkillsIndexEntrySchema`)

The registry index (`~/.agents/skills/index.json`) is a catalogue of available skills. Putting `allowed-tools` there would make it machine-readable without parsing SKILL.md.

**Why not chosen:** The registry index is an installation manifest, not a trust document. Trust declarations should live in the skill's own SKILL.md — the canonical source of truth — not in a file that vakt controls. Reading from SKILL.md ensures the declaration travels with the skill when shared via git.

### Enforce `allowed-tools` at the proxy layer (deny tool calls not in the skill's list)

The vakt proxy intercepts MCP tool calls at runtime. We could cross-reference the active skill list and deny calls not declared by any loaded skill.

**Why not chosen:** The namespace mismatch makes this unsound — `allowed-tools: [Bash]` is a Claude Code tool, not an MCP server tool. There is no reliable mapping between the two without parsing provider-specific tool call structures. Runtime enforcement is also the wrong layer for a declaration about agent-level tools. Claude Code's own `allowed-tools` enforcement already handles this at the correct layer.

### Surface `vakt audit skills` as a separate top-level command (`vakt skills audit`)

Keeping skill audit as a subcommand of the existing `audit` command (`vakt audit skills`) is not obviously better than a dedicated top-level `vakt skills audit` or `vakt skills` command group.

**Why not chosen:** The audit log and skills audit are both read-only inspection surfaces. Grouping them under `audit` is consistent with the existing `audit show` / `audit export` commands. A `vakt skills` command group would make sense if there were more skills subcommands (install, remove, update), but at this point `add-skill` and sync-time handling are already in place. We can migrate to `vakt skills audit` in a later ADR if the skills command surface grows.

### Hard-block unscoped skills during sync (not just warn)

Making `scopeRequired: true` block the sync rather than warn would enforce the policy strictly.

**Why not chosen:** vakt's existing `registryPolicy` tiers (`allow-unverified`, `warn-unverified`, `registry-only`) establish a warn-first default. Hard-blocking without user opt-in (`policy.skills.scopeRequired` + `--ci`) would break existing workflows for teams that haven't yet added `allowed-tools` to their bundled skills — including vakt's own. Progressive opt-in is more practical.

## Consequences

**Positive:**

- Operators get a skills.sh/audits equivalent view for their local install — unscoped skills are immediately visible
- `vakt audit skills --json` is pipeable to SIEM, scripts, or CI gates
- Skills that declare `allowed-tools` become auditable as a class; unscoped skills are explicitly flagged rather than silently assumed safe
- `--ci` + `policy.skills.scopeRequired` gives teams a CI-enforced gate against unscoped skill installs
- No new runtime dependency; parser is < 50 lines of focused regex
- vakt's own bundled skills will be updated to add `allowed-tools` declarations as part of this work, dogfooding the feature

**Negative / trade-offs:**

- `allowed-tools` names Claude Code tools; the `--policy-check` mapping to vakt's MCP tool namespace is approximate. This is documented in the output, but users who conflate the two namespaces may get confused
- Parsing SKILL.md on every `vakt list` and `vakt audit skills` call adds a small I/O cost for large skill sets (dozens of skills). Acceptable at current scale; cache if needed later

**Neutral / to monitor:**

- If other providers adopt their own frontmatter extensions (Cursor's equivalent of `allowed-tools`), the `SkillMeta` type will need extending. The parser is intentionally lenient — unknown frontmatter fields are ignored
- The `skills.scopeRequired` policy key is the first `skills`-namespaced policy key. If skill-level policy grows (per-skill tool allow/deny lists, skill-level path restrictions), it should expand this same `skills` object rather than adding top-level keys
- `vakt audit skills --policy-check` operates on installed skills, not skills being added. A future `vakt add-skill --check` flag that runs the audit before installing would close that gap
