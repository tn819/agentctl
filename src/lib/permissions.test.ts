import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ClaudeSettingsAdapter, serializeToolPermission } from "./permissions";
import type { ToolPermission } from "./schemas";

// ── Helpers ───────────────────────────────────────────────────────────────────

function tempDir(): string {
  const dir = join(tmpdir(), `vakt-perm-test-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
}

// ── serializeToolPermission ───────────────────────────────────────────────────

describe("serializeToolPermission", () => {
  it("serialises a bare tool name", () => {
    expect(serializeToolPermission({ tool: "Bash" })).toBe("Bash");
  });

  it("serialises a tool name with specifier", () => {
    expect(serializeToolPermission({ tool: "Bash", specifier: "git *" })).toBe("Bash(git *)");
  });

  it("serialises WebFetch domain specifier", () => {
    expect(serializeToolPermission({ tool: "WebFetch", specifier: "domain:github.com" }))
      .toBe("WebFetch(domain:github.com)");
  });

  it("serialises Read path specifier", () => {
    expect(serializeToolPermission({ tool: "Read", specifier: "~/.env" })).toBe("Read(~/.env)");
  });
});

// ── ClaudeSettingsAdapter ─────────────────────────────────────────────────────

describe("ClaudeSettingsAdapter", () => {
  let dir: string;
  let settingsPath: string;

  beforeEach(() => {
    dir = tempDir();
    settingsPath = join(dir, "settings.json");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const allow: ToolPermission[] = [
    { tool: "Read" },
    { tool: "Bash", specifier: "git *" },
  ];
  const deny: ToolPermission[] = [{ tool: "WebSearch" }];

  it("creates settings.json when it does not exist", () => {
    const adapter = new ClaudeSettingsAdapter(settingsPath);
    const result = adapter.apply(allow, deny, false);

    expect(result.written).toBe(true);
    expect(existsSync(settingsPath)).toBe(true);

    const settings = readJson(settingsPath) as {
      permissions?: { allow?: string[]; deny?: string[] };
      _vakt_managed?: { allow: string[]; deny: string[] };
    };
    expect(settings.permissions?.allow).toEqual(["Read", "Bash(git *)"]);
    expect(settings.permissions?.deny).toEqual(["WebSearch"]);
    expect(settings._vakt_managed).toEqual({ allow: ["Read", "Bash(git *)"], deny: ["WebSearch"] });
  });

  it("returns written: false in dry-run mode and does not touch the file", () => {
    const adapter = new ClaudeSettingsAdapter(settingsPath);
    const result = adapter.apply(allow, deny, true);

    expect(result.written).toBe(false);
    expect(existsSync(settingsPath)).toBe(false);
    expect(result.allow).toEqual(["Read", "Bash(git *)"]);
    expect(result.deny).toEqual(["WebSearch"]);
  });

  it("preserves user-managed entries on second sync", () => {
    // Write initial user-managed entries
    writeFileSync(
      settingsPath,
      JSON.stringify({
        permissions: {
          allow: ["Edit(/src/**)"],
          deny: ["Write(//etc/**)"],
        },
      }) + "\n",
    );

    const adapter = new ClaudeSettingsAdapter(settingsPath);
    adapter.apply(allow, deny, false);

    const settings = readJson(settingsPath) as {
      permissions?: { allow?: string[]; deny?: string[] };
    };
    // User entries appear first, vakt entries appended
    expect(settings.permissions?.allow).toContain("Edit(/src/**)");
    expect(settings.permissions?.allow).toContain("Read");
    expect(settings.permissions?.allow).toContain("Bash(git *)");
    expect(settings.permissions?.deny).toContain("Write(//etc/**)");
    expect(settings.permissions?.deny).toContain("WebSearch");
  });

  it("replaces vakt-managed entries on repeat sync without duplicating", () => {
    const adapter = new ClaudeSettingsAdapter(settingsPath);
    // First sync
    adapter.apply(allow, deny, false);
    // Second sync with same policy
    adapter.apply(allow, deny, false);

    const settings = readJson(settingsPath) as {
      permissions?: { allow?: string[]; deny?: string[] };
    };
    // No duplicates
    expect(settings.permissions?.allow?.filter(e => e === "Read").length).toBe(1);
    expect(settings.permissions?.allow?.filter(e => e === "Bash(git *)").length).toBe(1);
    expect(settings.permissions?.deny?.filter(e => e === "WebSearch").length).toBe(1);
  });

  it("idempotent: two syncs with same policy produce identical files", () => {
    const adapter = new ClaudeSettingsAdapter(settingsPath);
    adapter.apply(allow, deny, false);
    const after1 = readFileSync(settingsPath, "utf-8");
    adapter.apply(allow, deny, false);
    const after2 = readFileSync(settingsPath, "utf-8");
    expect(after1).toBe(after2);
  });

  it("removes vakt entries when policy is cleared", () => {
    const adapter = new ClaudeSettingsAdapter(settingsPath);
    adapter.apply(allow, deny, false);
    // Clear policy
    adapter.apply([], [], false);

    const settings = readJson(settingsPath) as {
      permissions?: { allow?: string[]; deny?: string[] };
      _vakt_managed?: unknown;
    };
    expect(settings.permissions?.allow ?? []).toHaveLength(0);
    expect(settings.permissions?.deny ?? []).toHaveLength(0);
    // Marker is removed when vakt has nothing managed
    expect(settings._vakt_managed).toBeUndefined();
  });

  it("does not clobber user entries added between syncs", () => {
    const adapter = new ClaudeSettingsAdapter(settingsPath);
    adapter.apply(allow, deny, false);

    // User manually adds an entry
    const settings = readJson(settingsPath) as {
      permissions?: { allow?: string[] };
    };
    settings.permissions!.allow!.push("Agent(Explore)");
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");

    // vakt syncs again with same policy
    adapter.apply(allow, deny, false);

    const final = readJson(settingsPath) as {
      permissions?: { allow?: string[] };
    };
    expect(final.permissions?.allow).toContain("Agent(Explore)");
  });

  it("emits a warning for unknown tool names", () => {
    const adapter = new ClaudeSettingsAdapter(settingsPath);
    const result = adapter.apply([{ tool: "FutureTool" }], [], false);
    expect(result.warnings.some(w => w.includes("FutureTool"))).toBe(true);
  });

  it("does not emit warnings for known tool names", () => {
    const adapter = new ClaudeSettingsAdapter(settingsPath);
    const result = adapter.apply(allow, deny, false);
    expect(result.warnings).toHaveLength(0);
  });

  it("handles unparseable existing settings.json gracefully", () => {
    writeFileSync(settingsPath, "not valid json");
    const adapter = new ClaudeSettingsAdapter(settingsPath);
    // Should not throw; should warn and treat as empty
    const result = adapter.apply(allow, deny, false);
    expect(result.written).toBe(true);
    expect(result.warnings.some(w => w.includes("could not parse"))).toBe(true);
  });
});
