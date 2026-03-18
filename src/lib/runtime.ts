import type { AgentConfig } from "./schemas";

export type RuntimeBackend = "local" | "e2b";

export function getRuntimeForServer(name: string, config: AgentConfig): RuntimeBackend {
  return (config.runtime?.servers?.[name] ?? config.runtime?.default ?? "local") as RuntimeBackend;
}

// E2B cloud sandbox helpers (resolvedE2BApiKey, startServerInE2B, stopSandbox)
// are pending implementation in commands/runtime.ts (feat/e2b-sandbox).
