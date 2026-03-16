import { existsSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import type { Command } from "commander";
import { AGENTS_DIR } from "../lib/config";
import { AuditStore } from "../lib/audit";
import { readSkillMeta, scanSkillHazards } from "../lib/skills";

function parseDuration(s: string): number {
  const m = s.match(/^(\d+)(h|d|w)$/);
  if (!m) return 24 * 3_600_000;
  const n = Number(m[1]);
  const units: Record<string, number> = { h: 3_600_000, d: 86_400_000, w: 604_800_000 };
  return n * (units[m[2]!] ?? 3_600_000);
}

export function registerAudit(program: Command): void {
  const audit = program.command("audit").description("Query the local audit log");

  audit
    .command("show")
    .description("Show recent tool calls")
    .option("--server <name>", "filter by server name")
    .option("--last <window>", "time window: 1h, 24h, 7d, 4w", "24h")
    .option("--limit <n>",    "max rows to show", "50")
    .action((opts) => {
      const store = new AuditStore();
      store.init();
      const rows = store.query({
        serverName: opts.server,
        since: Date.now() - parseDuration(opts.last as string),
        limit: Number(opts.limit),
      });

      if (rows.length === 0) {
        console.log("No tool calls found.");
        return;
      }

      const COL_WIDTH = { time: 12, server: 16, tool: 30, policy: 8 };
      console.log(`\n${"TIME".padEnd(COL_WIDTH.time)} ${"SERVER".padEnd(COL_WIDTH.server)} ${"TOOL".padEnd(COL_WIDTH.tool)} ${"POLICY".padEnd(COL_WIDTH.policy)} DUR`);
      console.log("─".repeat(76));

      for (const r of rows) {
        const time   = new Date(r.started_at as number).toISOString().slice(11, 23);
        const policy = r.policy_result === "deny" ? "✗ deny " : "✓ allow";
        const dur    = (r.duration_ms as number) < 1000
          ? `${r.duration_ms}ms`
          : `${((r.duration_ms as number) / 1000).toFixed(1)}s`;
        console.log(
          `${time.padEnd(COL_WIDTH.time)} ${(r.server_name as string).padEnd(COL_WIDTH.server)} ` +
          `${(r.tool_name as string).padEnd(COL_WIDTH.tool)} ${policy.padEnd(COL_WIDTH.policy)} ${dur}`
        );
      }
    });

  audit
    .command("skills")
    .description("Show security posture of installed skills (allowed-tools, hazards)")
    .option("--json", "Emit JSON array instead of table")
    .action((opts: { json?: boolean }) => {
      const skillsDir = join(AGENTS_DIR, "skills");
      if (!existsSync(skillsDir)) {
        console.log("No skills directory found.");
        return;
      }

      const skills = readdirSync(skillsDir);
      if (skills.length === 0) {
        console.log("No skills installed.");
        return;
      }

      const rows = skills
        .filter(skill => skill === basename(skill) && statSync(join(skillsDir, skill)).isDirectory())
        .map(skill => {
          const skillDir = join(skillsDir, skill);
          const meta = readSkillMeta(skillDir);
          const hazards = scanSkillHazards(skillDir);
          return {
            name:         skill,
            allowedTools: meta.allowedTools ?? null,
            scoped:       meta.allowedTools !== undefined,
            hazards,
          };
        });

      if (opts.json) {
        console.log(JSON.stringify(rows, null, 2));
        return;
      }

      const bold   = (s: string) => `\x1b[1m${s}\x1b[0m`;
      const dim    = (s: string) => `\x1b[2m${s}\x1b[0m`;
      const green  = (s: string) => `\x1b[32m${s}\x1b[0m`;
      const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
      const red    = (s: string) => `\x1b[31m${s}\x1b[0m`;

      const W = { skill: 26, tools: 26, scoped: 10, hazards: 10 };
      console.log(`\n${bold("── Skills Security Audit ────────────────────────────────────────────────────")}`);
      console.log(
        `  ${"SKILL".padEnd(W.skill)} ${"TOOLS".padEnd(W.tools)} ${"SCOPED".padEnd(W.scoped)} HAZARDS`
      );
      console.log(`  ${"─".repeat(W.skill)} ${"─".repeat(W.tools)} ${"─".repeat(W.scoped)} ${"─".repeat(W.hazards)}`);

      for (const r of rows) {
        const nameCol   = bold(r.name.length > W.skill ? r.name.slice(0, W.skill - 1) + "…" : r.name).padEnd(W.skill + 8 /* ANSI */);
        const toolsCol  = (r.allowedTools ? dim(r.allowedTools.join(", ")) : dim("—")).padEnd(W.tools + 4);
        const scopedCol = (r.scoped ? green("✓") : yellow("⚠ no")).padEnd(W.scoped + 9);
        const hazCol    = r.hazards.length === 0
          ? green("—")
          : red(`${r.hazards.length} finding${r.hazards.length > 1 ? "s" : ""}`);
        console.log(`  ${nameCol} ${toolsCol} ${scopedCol} ${hazCol}`);

        if (r.hazards.length > 0) {
          for (const h of r.hazards) {
            console.log(`    ${dim(`${h.file}:${h.line}`)}  ${yellow(h.pattern)}`); // NOSONAR — intentional CLI output of local scan results
          }
        }
      }

      const unscoped = rows.filter(r => !r.scoped).length;
      const withHazards = rows.filter(r => r.hazards.length > 0).length;
      console.log();
      if (unscoped > 0) console.log(`  ${yellow(`⚠ ${unscoped} unscoped skill${unscoped > 1 ? "s" : ""} — add allowed-tools to SKILL.md frontmatter`)}`); // NOSONAR
      if (withHazards > 0) console.log(`  ${red(`✗ ${withHazards} skill${withHazards > 1 ? "s" : ""} with static hazard findings — review before syncing`)}`); // NOSONAR
      if (unscoped === 0 && withHazards === 0) console.log(`  ${green("✓ All skills scoped and no static hazards found")}`);
      console.log();
    });

  audit
    .command("export")
    .description("Export audit log as JSON (pipe to SIEM or OTLP collector)")
    .option("--since <iso-date>", "only events after this date")
    .option("--limit <n>", "max rows", "10000")
    .action((opts) => {
      const store = new AuditStore();
      store.init();
      const since = opts.since ? new Date(opts.since as string).getTime() : 0;
      const rows = store.query({ since, limit: Number(opts.limit) });
      console.log(JSON.stringify(rows, null, 2));
    });
}
