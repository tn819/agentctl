import { describe, it, expect, beforeEach } from "bun:test";
import { join } from "path";
import { rmSync } from "fs";
import { AuditStore } from "./audit";

const DB = join(process.env["AGENTS_DIR"]!, "audit.db");

describe("AuditStore", () => {
  let store: AuditStore;

  beforeEach(() => {
    try { rmSync(DB); } catch { /* ok if not exists */ }
    store = new AuditStore(DB);
    store.init();
  });

  it("records and retrieves a tool call", () => {
    const now = Date.now();
    store.recordToolCall({
      sessionId: "s1", serverName: "github", toolName: "list_repos",
      runtime: "local", provider: "cursor", policyResult: "allow",
      startedAt: now, endedAt: now + 80, responseOk: true,
    });
    const rows = store.query({ serverName: "github", limit: 10 });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tool_name).toBe("list_repos");
    expect(rows[0]!.duration_ms).toBeGreaterThanOrEqual(80);
  });

  it("records a sync event", () => {
    store.recordSync({ providers: ["cursor", "gemini"], servers: ["github"], dryRun: false });
    const syncs = store.recentSyncs(5);
    expect(syncs).toHaveLength(1);
    expect(JSON.parse(syncs[0]!.providers as string)).toContain("cursor");
  });

  it("filters tool calls by time window", () => {
    const old = Date.now() - 10_000;
    store.recordToolCall({
      sessionId: "s2", serverName: "github", toolName: "old_call",
      runtime: "local", provider: "cursor", policyResult: "allow",
      startedAt: old, endedAt: old + 50, responseOk: true,
    });
    const recent = store.query({ since: Date.now() - 1000 });
    expect(recent).toHaveLength(0);
  });

  it("filters by server name", () => {
    const now = Date.now();
    store.recordToolCall({
      sessionId: "s3", serverName: "filesystem", toolName: "read_file",
      runtime: "local", provider: "gemini", policyResult: "allow",
      startedAt: now, endedAt: now + 10, responseOk: true,
    });
    expect(store.query({ serverName: "github" })).toHaveLength(0);
    expect(store.query({ serverName: "filesystem" })).toHaveLength(1);
  });
});

describe("AuditStore — sandbox sessions", () => {
  const SESSION_DB = join(process.env["AGENTS_DIR"]!, "agent-session-test.db");
  let store: AuditStore;

  beforeEach(() => {
    try { rmSync(SESSION_DB); } catch { /* ok */ }
    store = new AuditStore(SESSION_DB);
    store.init();
  });

  it("creates a session and retrieves it by id", () => {
    const id = store.createSession({
      provider: "docker",
      containerId: "abc123",
      image: "node:20-slim",
      repo: "/tmp/myrepo",
    });
    expect(typeof id).toBe("string");
    expect(id).toHaveLength(36); // UUID

    const session = store.getSession(id);
    expect(session).not.toBeNull();
    expect(session!.provider).toBe("docker");
    expect(session!.container_id).toBe("abc123");
    expect(session!.status).toBe("running");
  });

  it("closes a session", () => {
    const id = store.createSession({ provider: "docker", containerId: "def456" });
    store.closeSession(id);
    const session = store.getSession(id);
    expect(session!.status).toBe("closed");
  });

  it("lists running sessions", () => {
    store.createSession({ provider: "docker", containerId: "c1" });
    store.createSession({ provider: "docker", containerId: "c2" });
    const running = store.listSessions({ status: "running" });
    expect(running).toHaveLength(2);
  });
});
