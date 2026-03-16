import { describe, test, expect } from "bun:test";
import { filterGlobal } from "./sync";
import type { McpConfig } from "../lib/schemas";

describe("filterGlobal", () => {
  test("keeps servers with global: true", () => {
    const cfg: McpConfig = {
      "global-srv": { command: "npx", global: true },
      "local-srv": { command: "npx", global: false },
    };
    const result = filterGlobal(cfg);
    expect("global-srv" in result).toBe(true);
    expect("local-srv" in result).toBe(false);
  });

  test("removes servers with global: false", () => {
    const cfg: McpConfig = {
      "srv-a": { command: "npx", global: false },
      "srv-b": { command: "node", global: false },
    };
    const result = filterGlobal(cfg);
    expect(Object.keys(result)).toHaveLength(0);
  });

  test("removes servers whose global defaults to false (no explicit field parsed by zod)", () => {
    // When zod parses a server without a global field, it defaults to false
    const cfg: McpConfig = {
      "no-global": { command: "npx", global: false },
      "explicit-global": { command: "npx", global: true },
    };
    const result = filterGlobal(cfg);
    expect("no-global" in result).toBe(false);
    expect("explicit-global" in result).toBe(true);
  });

  test("returns empty object when all servers are local", () => {
    const cfg: McpConfig = {
      "a": { command: "a", global: false },
      "b": { command: "b", global: false },
    };
    expect(Object.keys(filterGlobal(cfg))).toHaveLength(0);
  });

  test("returns all servers when all are global", () => {
    const cfg: McpConfig = {
      "a": { command: "a", global: true },
      "b": { command: "b", global: true },
    };
    const result = filterGlobal(cfg);
    expect(Object.keys(result)).toHaveLength(2);
  });

  test("works with HTTP servers", () => {
    const cfg: McpConfig = {
      "http-global": { transport: "http", url: "https://example.com/mcp", global: true },
      "http-local": { transport: "http", url: "https://example.com/mcp", global: false },
    };
    const result = filterGlobal(cfg);
    expect("http-global" in result).toBe(true);
    expect("http-local" in result).toBe(false);
  });
});
