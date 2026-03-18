import type { AgentConfig } from "./schemas";

export type RuntimeBackend = "local" | "e2b";

export function getRuntimeForServer(name: string, config: AgentConfig): RuntimeBackend {
  return (config.runtime?.servers?.[name] ?? config.runtime?.default ?? "local") as RuntimeBackend;
}

// TODO: wire resolvedE2BApiKey / startServerInE2B / stopSandbox into commands/runtime.ts
// when the E2B cloud sandbox execution path is implemented.
