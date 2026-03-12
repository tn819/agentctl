import type { Command } from "commander";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadAgentConfig } from "../lib/config";
import {
  fetchRemotePolicy,
  fetchRemoteMcpConfig,
  fetchRemoteSkillsManifest,
  mergeRemoteMcp,
} from "../lib/remote";

const bold   = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const cyan   = (s: string) => `\x1b[36m${s}\x1b[0m`;
const ok     = (s: string) => console.log(`  ${green("✓")}  ${s}`);
const warn   = (s: string) => console.log(`  ${yellow("⚠")}  ${s}`);
const info   = (s: string) => console.log(`  ${cyan("→")}  ${s}`);

export function registerPull(program: Command): void {
  program
    .command("pull")
    .description("Fetch remote config, policy, and skills manifest")
    .option("--dry-run", "preview without writing files")
    .option("--policy-only", "only fetch policy.json")
    .option("--mcp-only", "only fetch mcp-config.json")
    .option("--skills-only", "only fetch skills/index.json")
    .action(async (opts: { dryRun?: boolean; policyOnly?: boolean; mcpOnly?: boolean; skillsOnly?: boolean }) => {
      const agentsDir = process.env["AGENTS_DIR"] ?? join(process.env["HOME"] ?? "~", ".agents");

      if (!existsSync(agentsDir)) {
        console.error(`Error: ~/.agents/ not initialized. Run 'vakt init' first.`);
        process.exit(1);
      }

      let cfg;
      try {
        cfg = loadAgentConfig();
      } catch (e) {
        console.error(`Error loading config: ${e instanceof Error ? e.message : String(e)}`);
        process.exit(1);
      }

      if (!cfg.remote?.url) {
        console.error("No remote.url configured.");
        console.error("Set it with: vakt config set remote.url https://github.com/org/agent-config");
        process.exit(1);
      }

      console.log("");
      console.log(bold("vakt pull"));
      if (opts.dryRun) console.log(yellow("DRY RUN — no changes will be made"));
      console.log("");

      const remoteCfg = cfg.remote;
      const token = remoteCfg.token;

      const what = opts.policyOnly ? "policy" : opts.mcpOnly ? "mcp" : opts.skillsOnly ? "skills" : "all";

      const fetched: string[] = [];
      const errors: string[] = [];

      if (what === "all" || what === "policy") {
        const out = await fetchRemotePolicy(remoteCfg, agentsDir, token);
        if (out) {
          fetched.push("policy");
          if (!opts.dryRun) ok("policy.json fetched → policy.remote.json");
          else info("[dry-run] would fetch policy.json");
        } else {
          errors.push("policy.json");
          warn("could not fetch policy.json");
        }
      }

      if (what === "all" || what === "mcp") {
        const out = opts.dryRun ? null : await fetchRemoteMcpConfig(remoteCfg, agentsDir, token);
        if (opts.dryRun) {
          info("[dry-run] would fetch mcp-config.json");
        } else if (out) {
          fetched.push("mcp-config");
          ok("mcp-config.json fetched → mcp-config.remote.json");
          const changes = await mergeRemoteMcp(agentsDir, false);
          for (const [name, status] of Object.entries(changes)) {
            if (status !== "unchanged") info(`server ${status}: ${name}`);
          }
        } else {
          errors.push("mcp-config.json");
          warn("could not fetch mcp-config.json");
        }
      }

      if (what === "all" || what === "skills") {
        const out = opts.dryRun ? null : await fetchRemoteSkillsManifest(remoteCfg, agentsDir, token);
        if (opts.dryRun) {
          info("[dry-run] would fetch skills/index.json");
        } else if (out) {
          fetched.push("skills/index");
          ok("skills/index.json fetched → skills/remote-index.json");
        }
        // Skills manifest is optional — not an error if missing
      }

      console.log("");
      if (errors.length === 0 || fetched.length > 0) {
        ok("Pull complete");
        if (!opts.dryRun) info("Run 'vakt sync' to apply updated config to all providers");
      } else {
        warn("Pull failed — check remote.url in config.json");
        process.exit(1);
      }
      console.log("");
    });
}
