// src/commands/add-server.ts
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { Command } from "commander";
import { AGENTS_DIR, loadMcpConfig } from "../lib/config";
import type { McpServer } from "../lib/schemas";
import { RegistryClient } from "../lib/registry";

type StdioEntryOpts = { command: string; args: string[]; global: boolean };
type HttpEntryOpts = { transport: "http"; url: string; global: boolean };
type ServerEntryOpts = StdioEntryOpts | HttpEntryOpts;

export function buildServerEntry(opts: ServerEntryOpts): Record<string, unknown> {
  if ("transport" in opts) {
    return { transport: opts.transport, url: opts.url, global: opts.global };
  }
  return {
    command: opts.command,
    ...(opts.args.length > 0 ? { args: opts.args } : {}),
    global: opts.global,
  };
}

export async function addServerToConfig(
  agentsDir: string,
  name: string,
  opts: ServerEntryOpts,
): Promise<void> {
  const mcpPath = join(agentsDir, "mcp-config.json");
  const { McpConfigSchema } = await import("../lib/schemas");
  const { readFileSync, existsSync: fsExists } = await import("node:fs");
  let config: Record<string, unknown> = {};
  if (fsExists(mcpPath)) {
    config = McpConfigSchema.parse(JSON.parse(readFileSync(mcpPath, "utf-8"))) as Record<string, unknown>;
  }
  config[name] = buildServerEntry(opts);
  await Bun.write(mcpPath, JSON.stringify(config, null, 2));
}

export function registerAddServer(program: Command): void {
  const cmd = program
    .command("add-server <name>")
    .description("Add a new MCP server")
    .option("--http <url>", "Add an HTTP transport server")
    .option("--global", "Mark server as global — will be synced to all providers")
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .action(async (name: string, opts: { http?: string; global?: boolean }) => {
      const mcpPath = join(AGENTS_DIR, "mcp-config.json");
      if (!existsSync(AGENTS_DIR)) {
        console.error("Run 'vakt init' first");
        process.exit(1);
      }

      const config = loadMcpConfig();
      const makeGlobal = opts.global ?? false;

      let server: McpServer;
      if (opts.http !== undefined) {
        server = { transport: "http", url: opts.http, global: makeGlobal };
        config[name] = server;
        await Bun.write(mcpPath, JSON.stringify(config, null, 2));
        console.log(`Added HTTP server: ${name}`);
      } else {
        // Extract command args from process.argv — everything after <name>,
        // filtering out --http and its value and --global if present.
        const argv = process.argv;
        const addServerIdx = argv.indexOf("add-server");
        const rawAfterName = addServerIdx >= 0 ? argv.slice(addServerIdx + 2) : [];
        const cmdArgs: string[] = [];
        for (let i = 0; i < rawAfterName.length; i++) {
          if (rawAfterName[i] === "--http") { i++; continue; }
          if (rawAfterName[i]!.startsWith("--http=")) continue;
          if (rawAfterName[i] === "--global") continue;
          cmdArgs.push(rawAfterName[i]!);
        }

        if (cmdArgs.length === 0) {
          console.error("Error: provide a command (or --http <url>)");
          process.exit(1);
        }

        // Registry ID: contains "/" but isn't a local path
        const firstArg = cmdArgs[0]!;
        if (firstArg.includes("/") && !firstArg.startsWith("/") && !firstArg.startsWith(".")) {
          const client = new RegistryClient();
          let entry;
          try {
            entry = await client.lookup(firstArg);
          } catch (e) {
            console.error(`Registry lookup failed: ${e}`);
            process.exit(1);
          }
          if (!entry) {
            console.error(`Not found in MCP registry: ${firstArg}`);
            process.exit(1);
          }
          const resolved = client.resolvePackage(entry);
          (config as Record<string, unknown>)[name] = {
            registry: firstArg,
            ...(entry.server.version ? { version: entry.server.version } : {}),
            command: resolved.command,
            args: resolved.args,
            ...(resolved.requiredSecrets.length > 0
              ? { env: Object.fromEntries(resolved.requiredSecrets.map(k => [k, `secret:${k}`])) }
              : {}),
            global: makeGlobal,
          };
          await Bun.write(mcpPath, JSON.stringify(config, null, 2));
          console.log(`Added ${name} from registry (${firstArg})`);
          if (resolved.requiredSecrets.length > 0) {
            console.log(`\nSecrets needed:`);
            resolved.requiredSecrets.forEach(k =>
              console.log(`  vakt secrets set ${k} <value>`)
            );
          }
        } else {
          server = { command: firstArg, args: cmdArgs.slice(1), global: makeGlobal };
          config[name] = server;
          await Bun.write(mcpPath, JSON.stringify(config, null, 2));
          console.log(`Added server: ${name}`);
        }
      }
      console.log("Run 'vakt sync' to push to providers.");
    });

  cmd.configureOutput({
    outputError(str, write) {
      write(str);
      write(`\nUsage: vakt add-server <name> [command [args...]]\n`);
      write(`       vakt add-server <name> --http <url>\n`);
    },
  });
}
