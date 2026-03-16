import { describe, test, expect } from "bun:test";
import { McpConfigSchema } from "./schemas";

describe("McpConfigSchema global field", () => {
  test("stdio server accepts global: true", () => {
    const result = McpConfigSchema.parse({
      "my-server": { command: "npx", args: ["-y", "some-mcp"], global: true },
    });
    expect(result["my-server"]!.global).toBe(true);
  });

  test("stdio server defaults global to false", () => {
    const result = McpConfigSchema.parse({
      "my-server": { command: "npx" },
    });
    expect(result["my-server"]!.global).toBe(false);
  });

  test("http server accepts global: true", () => {
    const result = McpConfigSchema.parse({
      "my-server": { transport: "http", url: "https://example.com/mcp", global: true },
    });
    expect(result["my-server"]!.global).toBe(true);
  });

  test("_note key is stripped from config", () => {
    const raw = {
      "_note": "this is a comment",
      "github": { command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] },
    };
    const result = McpConfigSchema.parse(raw);
    expect("_note" in result).toBe(false);
    expect("github" in result).toBe(true);
  });
});
