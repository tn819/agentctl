---
status: accepted
date: 2026-03-13
---

# 0002 — Model router: OpenAI-compatible local proxy for multi-backend LLM routing

## Context

vakt already intercepts the *tool call* layer — it sits in the stdio path between AI coding agents (Claude Code, Cursor, Gemini CLI, etc.) and MCP servers, enforcing policy, recording audit events, and managing secrets. This positions vakt as the natural control plane for AI agent infrastructure.

The adjacent problem is *model completion routing*. AI coding agents currently send completions directly to a single model API. This creates several tensions:

**Cost.** Large frontier models (Claude, GPT-4o, Gemini) are expensive at volume. Routine, short-context completions — autocomplete, small edits, quick tool summaries — do not require a 100B+ parameter model. A self-hosted fine-tuned 7B model on a €250/mo GPU (Hetzner RTX 4090) can handle these cases at near-zero marginal cost.

**Context length.** The self-hosted model has a hard limit (typically 8k–32k tokens). Long-context tasks — large refactors, multi-file analysis, tasks with many tool schemas injected — must be routed to a frontier API with 128k+ context.

**EU data sovereignty.** Some deployments require that data not leave EU jurisdiction. Frontier APIs from US hyperscalers (Anthropic, OpenAI) are problematic. Mistral AI (Paris) offers comparable frontier capability with EU hosting. The router is the enforcement point for "this workspace must stay EU."

**Provider diversity.** Teams already using vakt for MCP policy want one tool to manage both concerns. Bolting routing onto a separate proxy (LiteLLM, PortKey, OpenRouter) means a second control plane with no awareness of vakt's policy, secrets, or audit trail.

The routing decision is simple and deterministic: two observable signals — estimated prompt token count and number of tool schemas in the request — reliably predict whether a small local model will succeed or struggle. This is not ML; it is a short-circuit rule list evaluated in order.

## Decision

We add `vakt route` — a new CLI command that starts a local OpenAI-compatible HTTP proxy on a configurable port (default: 4000). Routing rules are declared in `~/.agents/config.json` under `modelRouter`, alongside existing MCP and provider config. API keys for remote backends use the existing `secret:KEY` syntax resolved at startup.

The routing logic lives in a pure function (`selectBackend`) in `src/lib/router.ts` with no I/O, making it trivially unit-testable. The HTTP proxy uses Bun's built-in `Bun.serve()` and `fetch()` — no new runtime dependencies. All routing events are written to the existing `AuditStore` SQLite database (`model_route_events` table), keeping observability in one place.

Config shape (stored in `~/.agents/config.json`):

```json
{
  "modelRouter": {
    "port": 4000,
    "backends": {
      "local":   { "url": "http://10.0.0.5:8000/v1", "apiKey": "secret:HETZNER_KEY", "maxCtx": 8192 },
      "mistral": { "url": "https://api.mistral.ai/v1",  "apiKey": "secret:MISTRAL_KEY", "maxCtx": 131072 }
    },
    "rules": [
      { "if": { "promptTokens": { "gt": 16000 } }, "use": "mistral" },
      { "if": { "toolCount":    { "gt": 5 }      }, "use": "mistral" },
      { "use": "local" }
    ]
  }
}
```

Rules are evaluated in order; first match wins. A rule without `if` is the catch-all.

Token estimation uses `Math.ceil(JSON.stringify(messages).length / 4)` — O(n) in message length, no tokenizer dependency, accurate enough to drive a routing threshold (not billing).

## Alternatives Considered

### LiteLLM (existing open-source project)

LiteLLM is an OpenAI-compatible proxy that routes to 100+ model backends. It is the closest existing product to what we are building.

**Why not chosen:** LiteLLM has no awareness of MCP tool calls, vakt policy, `secret:KEY` refs, or the existing AuditStore. Running it alongside vakt creates two separate control planes with no shared audit trail, duplicated secret management, and no way to correlate "which model was used for this tool call session." The value of vakt is a single control plane; adding LiteLLM fragments it.

### PortKey / OpenRouter / Helicone

Hosted routing/gateway products. Same fragmentation concern as LiteLLM, plus: they are external services, meaning EU-sovereignty deployments cannot use them without sending traffic outside the EU.

**Why not chosen:** External dependency, EU sovereignty violation for regulated deployments, no integration with vakt's existing policy/audit/secrets layer.

### Route inside the existing `vakt proxy` MCP proxy (same process)

The existing proxy intercepts JSON-RPC tool calls. Model completion requests are a different protocol (OpenAI HTTP API) on a different transport (TCP) initiated by the AI coding tool, not by the MCP server. Conflating the two in one process mixes concerns and requires the MCP proxy to also bind a TCP port, complicating deployment and testing.

**Why not chosen:** Wrong abstraction level; MCP proxy and model proxy are separate concerns on separate transports.

### Client-side routing (configure the AI tool directly with multiple backends)

Some AI coding tools support configuring multiple model endpoints and switching manually. This requires per-developer configuration, has no central audit trail, and cannot enforce routing policy across a team.

**Why not chosen:** No central enforcement point, no audit trail, per-developer config drift — exactly the problem vakt exists to solve.

### ML-based routing (e.g. a small classifier predicting which model to use)

Projects like RouteLLM train a classifier on prompt features to predict which model will give the best quality/cost trade-off.

**Why not chosen:** Adds a training pipeline, model artifact, and inference dependency to a security/policy tool where predictability and auditability matter more than marginal quality optimization. The two signals we use (token count, tool count) are observable, deterministic, and sufficient for the routing decisions we need today. Can be revisited if rule-based routing proves insufficient.

## Consequences

**Positive:**

- AI coding agents can be pointed at `http://localhost:4000/v1` as their model endpoint; vakt handles all backend routing transparently
- Cost reduction: routine completions (~80% of requests in practice) served from local 7B at near-zero marginal cost
- EU data sovereignty enforcement: policy can mandate EU-only backends for specific workspaces
- Single audit trail: model routing events alongside MCP tool call events in the same SQLite database
- No new runtime dependencies — Bun's built-in HTTP primitives handle the proxy

**Negative / trade-offs:**

- Token estimation is approximate (`chars / 4`); edge cases (code-heavy prompts, non-ASCII content) may over- or under-estimate by 20–30%. This is acceptable for a routing threshold but must not be treated as billing-accurate
- The `vakt route` process must be running for the coding agent to work; it is one more process to manage (mitigated by daemon integration — future work)
- Response streaming (`text/event-stream`) is passed through but not inspected; streaming token counting is not possible without buffering the full response. This is acceptable — we route on *request* signals, not response content

**Neutral / to monitor:**

- `maxCtx` on backends is metadata only — the router does not enforce it dynamically (the upstream model will return an error if exceeded). Consider adding a hard-block rule if context overflow errors become common
- As rule complexity grows, consider adding a `--test` subcommand that simulates routing for a given token/tool count against the current config — makes debugging rules easier
- Provider-side prompt caching (Anthropic, Mistral cache repeated system prompt prefixes) means skills injected via vakt already benefit from ~90% token savings on the skill content portion of requests. This stacks with model routing — local model for short requests, cached prefix for the rest
- MCP tool response caching is explicitly deferred pending MCP spec standardization of `cache-control` semantics on tool schemas. The `interceptResponse` path in `daemon/proxy.ts` is already positioned to act on this when it arrives
