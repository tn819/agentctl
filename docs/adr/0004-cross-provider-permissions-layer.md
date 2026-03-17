---
status: proposed
date: 2026-03-16
---

# 0004 — Cross-provider tool permissions layer

## Context

The skill audit (ADR-0003) surfaces `allowed-tools` declarations and runs a static hazard gate at sync time. It does not enforce tool permissions at runtime beyond MCP tool calls intercepted by the proxy. The question this ADR addresses: can vakt be the single source of truth for tool permissions across all providers?

**What vakt controls today.** vakt enforces tool permissions in two places:

- **Layer 1 (MCP proxy):** `vakt --with-proxy` intercepts stdio MCP frames at runtime and can allow or deny MCP server tool calls for all providers.
- **Layer 4 (static gate):** `vakt sync` runs a pre-sync hazard scanner against skill content and `policy.json` rules at install time, for all providers.

Neither layer covers Claude Code's built-in tools (`Bash`, `Read`, `Write`, `Edit`, `WebSearch`, etc.). Those are dispatched client-side inside the Claude Code process and are never visible to the proxy.

**Research findings.** An audit of provider config schemas produced the following findings:

- Claude Code enforces `allowed-tools` client-side inside its own process; the proxy never sees these calls. There is no server-side hook.
- No other provider (Cursor, Gemini CLI, Codex, Windsurf) exposes a machine-writable tool permission config field. Their config schemas contain only MCP server definitions.
- Claude Code does have a global machine-writable permissions layer: `~/.claude/settings.json` → `permissions.allow[]` / `permissions.deny[]`. This is the standard managed-settings path used by MDM tools and enterprise deployments.
- The MCP OAuth 2.0 / authorization spec (2025-03) defines a resource server model. vakt's proxy could implement this as a universal hook — this is the long-term cross-provider path, but no provider has shipped it yet.

**The current gap.** The table below shows the four layers in the enforcement model and which are owned today:

| Layer | What is enforced | Enforced by | Coverage |
|-------|-----------------|-------------|----------|
| 1 | MCP tool calls | vakt proxy (`--with-proxy`) | All providers, runtime |
| 2 | Claude Code built-ins (global) | `~/.claude/settings.json` | Claude Code only, global |
| 3 | Claude Code built-ins (per-skill) | SKILL.md `allowed-tools` | Claude Code only, per-skill |
| 4 | Static hazards / unscoped gate | vakt pre-sync gate | All providers, install-time |

vakt owns layers 1 and 4 today. Layer 3 is Claude Code's responsibility (ADR-0003 ensures skills declare it). Layer 2 is the first new gap vakt can close: a global policy applied at sync time, before any session begins.

**The agentic-curl / subprocess gap.** A structural limitation that any permissions layer must acknowledge: the proxy inspects MCP frame `params.name` (tool name) but never `params.arguments`. This means:

- Denying `Bash` via policy is the only way to prevent `curl`/`wget`/arbitrary API calls made inside Bash — the proxy cannot see what commands run inside it.
- If `Bash` is allowed, any outbound HTTP call made inside it is invisible to vakt and to the proxy.
- The static hazard scanner catches patterns (`curl-pipe-sh`, `eval-exec`, etc.) in SKILL.md and scripts at install time — not runtime behaviour.
- HTTP MCP servers bypass the proxy entirely; the proxy is stdio-only per the MCP spec.

This gap is structural and cannot be closed without argument-level inspection or process-level sandboxing (e.g., E2B). The decision below explicitly documents it rather than papering over it.

## Decision

We will add a `tools` section to `policy.json` and write a vakt-managed block to provider-specific permission files during `vakt sync`.

### `policy.json` schema extension

```json
{
  "tools": {
    "allow": ["Read", "Edit", "Glob", "Grep"],
    "deny": ["Bash", "WebSearch", "WebFetch"]
  }
}
```

`tools.allow` and `tools.deny` name Claude Code built-in tools (the same namespace as SKILL.md `allowed-tools`). Both fields are optional arrays; absence means no vakt-managed opinion on that tool.

### Claude Code: write to `~/.claude/settings.json`

During `vakt sync`, when `policy.tools` is non-empty, vakt:

1. Reads `~/.claude/settings.json` (or `{}` if absent).
2. Identifies vakt-managed entries via a `_vakt` marker in the permissions object.
3. Replaces only the vakt-managed block with the current policy; preserves user-managed entries untouched.
4. Writes back atomically via temp file + rename to avoid corrupting the file on partial writes.

The merge strategy is the critical invariant: vakt must not clobber user customisations. The `_vakt` marker — a sentinel key or a structured comment convention — is the mechanism that separates managed from unmanaged entries in the same file.

### All other providers: proxy only

For Cursor, Gemini CLI, Codex, Windsurf, and any future provider: until a provider exposes a native machine-writable permission config, the proxy (layer 1) remains the only runtime enforcement path for that provider. `vakt sync` logs a notice when `policy.tools` is set but a provider has no settings-file target.

### Long-term: MCP OAuth 2.0 resource server

The MCP authorization spec (2025-03) defines a resource server model that vakt's proxy could implement as a universal, spec-defined permission hook regardless of provider or transport. This is tracked separately and is out of scope for this ADR; it is noted here so that the proxy architecture does not foreclose it.

## Alternatives Considered

### Full ownership of `~/.claude/settings.json`

Write the entire file from `policy.json`, replacing all existing content.

**Why not chosen:** This overwrites user customisations unconditionally. Operators and developers add entries to `settings.json` by hand (tool unlocks, workspace-specific grants). Replacing the file silently removes those entries. The merge-with-marker strategy achieves policy enforcement without this destructive side-effect.

### Per-skill enforcement only (layer 3)

Rely solely on `allowed-tools` in SKILL.md to constrain Claude Code built-in tool usage. ADR-0003 already implements this.

**Why not chosen:** Per-skill declarations cover the skill's own tool surface, but a global policy is a different concern — it applies across all skills, all sessions, and built-in agent behaviour that is not driven by any skill. Layer 3 and layer 2 are complementary, not substitutes.

### Wait for all providers to expose permission hooks

Defer this work until Cursor, Gemini, Codex, and others expose native machine-writable permission config fields.

**Why not chosen:** The timeline is open-ended and outside vakt's control. Claude Code already has the mechanism. Unblocking layer 2 for Claude Code now delivers real value to a large portion of vakt's user base without waiting. The design is provider-agnostic by construction: when other providers add the hook, vakt sync can write to their config file in the same pattern.

### Proxy argument inspection now

Inspect `frame.params?.arguments.command` at the proxy layer to catch shell commands that violate a network or command policy, instead of relying on a blanket Bash deny.

**Why not chosen:** Shell command parsing inside a proxy is unreliable at the required fidelity. Bash quoting, variable expansion, subshells, and heredocs make it impossible to statically determine what a command string will do without executing it. A blanket `deny: [Bash]` in policy is blunt but sound; argument inspection would give false confidence. This path is noted as a future enhancement, not a near-term commitment.

### Proxy-only enforcement (layer 1 only)

Accept that the proxy already enforces MCP tool calls and do not add a `settings.json` write.

**Why not chosen:** The proxy never sees Claude Code built-in tool calls. Proxy-only enforcement leaves a named, documented gap with no mitigation path. Layer 2 closes that gap for Claude Code users at low implementation cost.

## Consequences

**Positive:**

- `policy.json` becomes the single source of truth for tool permissions across both MCP (layer 1) and Claude Code built-ins (layer 2)
- `vakt sync` gains a Permissions section in its output, making the permission state visible and auditable
- Claude Code users get layer-2 enforcement; all providers keep layer-1 (proxy) + layer-4 (static gate)
- The merge-with-marker pattern is safe to run repeatedly — idempotent syncs will not accumulate duplicate or conflicting entries in `settings.json`

**Negative / trade-offs:**

- **Known gap (documented):** allowing `Bash` gives the agent unrestricted outbound network access from inside Bash. Operators who care about this must either deny `Bash` in policy or use a sandbox runtime (E2B, gVisor, Kata) that constrains network egress at the OS level. vakt cannot close this gap without argument inspection or sandbox integration.
- Atomic writes to `~/.claude/settings.json` require a temp-file-and-rename pattern. This adds implementation complexity and must handle the case where the file is on a filesystem that does not support atomic rename.
- The `_vakt` marker convention must be documented and stable. If the marker format changes, a migration step is needed to avoid vakt-managed entries being treated as user-managed on the next sync.
- `policy.json` `tools` entries name Claude Code built-in tools. Operators who use `policy.json` across providers may be confused that a `tools.deny: [Bash]` entry has no effect on Cursor. This must be called out in documentation.

**Neutral / to monitor:**

- MCP OAuth 2.0 resource server alignment is the path to true cross-provider runtime enforcement. The proxy architecture should not foreclose this; tracked separately.
- If other providers add machine-writable permission config, the `vakt sync` provider handler for that provider can implement the same merge-with-marker pattern without changing `policy.json` schema.
- A `vakt permissions status` subcommand (showing the current state of each layer per provider) would make the enforcement model more visible; left for a follow-up once implementation lands.
- Issue #72 tracks implementation. This ADR covers design rationale only; no code changes are part of this record.
