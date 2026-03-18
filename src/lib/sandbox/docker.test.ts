import { describe, it, expect, mock, beforeEach, afterAll } from "bun:test";
import type { SandboxHandle } from "../sandbox";

const mockResponses: Array<{ ok: boolean; body: unknown; status?: number }> = [];

const originalFetch = globalThis.fetch;
function pushMock(body: unknown, ok = true, status = 200) {
  mockResponses.push({ ok, body, status });
}

beforeEach(() => {
  mockResponses.length = 0;
  (globalThis as any).fetch = mock(async (_url: string, _opts?: RequestInit) => {
    const resp = mockResponses.shift();
    if (!resp) throw new Error("Unexpected fetch call");
    return {
      ok: resp.ok,
      status: resp.status ?? 200,
      json: async () => resp.body,
      text: async () => JSON.stringify(resp.body),
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as Response;
  });
});

afterAll(() => { globalThis.fetch = originalFetch; });

import { DockerSandboxProvider } from "../sandbox/docker";

describe("DockerSandboxProvider", () => {
  let provider: DockerSandboxProvider;

  beforeEach(() => {
    provider = new DockerSandboxProvider({
      socket: "/var/run/docker.sock",
      image: "node:20-slim",
    });
  });

  it("create: pulls image then calls /containers/create and /containers/{id}/start", async () => {
    pushMock("");                            // POST /images/create (pull)
    pushMock({ Id: "container-abc" });     // POST /containers/create
    pushMock({});                           // POST /containers/container-abc/start
    pushMock({ Id: "exec-mkdir" });        // POST /exec (mkdir -p /workspace)
    pushMock(new ArrayBuffer(0));          // POST /exec/exec-mkdir/start
    pushMock({ ExitCode: 0 });             // GET  /exec/exec-mkdir/json

    const handle = await provider.create({ name: "test-agent" });

    expect(handle.id).toBe("container-abc");
    expect(handle.provider).toBe("docker");
  });

  it("exec: creates exec instance and returns stdout", async () => {
    const handle: SandboxHandle = { id: "container-abc", provider: "docker" };

    // stdout frame: type=1, size=5, data="hello"
    const frame = new Uint8Array(8 + 5);
    frame[0] = 1; // stdout
    new DataView(frame.buffer).setUint32(4, 5, false);
    frame.set(new TextEncoder().encode("hello"), 8);

    (globalThis as any).fetch = mock(async (url: string) => {
      if ((url as string).includes("/exec/") && (url as string).includes("/start")) {
        return { ok: true, status: 200, arrayBuffer: async () => frame.buffer, json: async () => ({}), text: async () => "" } as unknown as Response;
      }
      if ((url as string).includes("/exec/") && (url as string).includes("/json")) {
        return { ok: true, status: 200, json: async () => ({ ExitCode: 0 }), text: async () => "", arrayBuffer: async () => new ArrayBuffer(0) } as unknown as Response;
      }
      return { ok: true, status: 200, json: async () => ({ Id: "exec-xyz" }), text: async () => "", arrayBuffer: async () => new ArrayBuffer(0) } as unknown as Response;
    });

    const result = await provider.exec(handle, ["echo", "hello"]);
    expect(result.stdout).toBe("hello");
    expect(result.exitCode).toBe(0);
  });

  it("destroy: calls DELETE /containers/{id}?force=true", async () => {
    const handle: SandboxHandle = { id: "container-abc", provider: "docker" };
    pushMock({});
    await provider.destroy(handle);
    // No error = pass
  });

  it("list: filters by label", async () => {
    pushMock([{ Id: "container-abc", Labels: { "vakt.swarm-id": "s1" } }]);
    const results = await provider.list!({ labels: { "vakt.swarm-id": "s1" } });
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe("container-abc");
  });
});
