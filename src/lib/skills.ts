import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";

/**
 * Parse YAML frontmatter from a SKILL.md file.
 * Returns key-value pairs from the --- block.
 * Lightweight — no full YAML parser needed for simple scalar values.
 */
function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1]!.split("\n")) {
    const kv = line.match(/^(\w[\w-]*):\s*(.+)/);
    if (kv) result[kv[1]!] = kv[2]!.trim();
  }
  return result;
}

/**
 * Returns true if a skill directory should be synced globally.
 * Skills without a SKILL.md or without a `global` field default to true
 * (preserves backwards compatibility).
 * Set `global: false` in SKILL.md frontmatter to make a skill local-only.
 */
export function isSkillGlobal(skillDir: string): boolean {
  const skillMd = join(skillDir, "SKILL.md");
  if (!existsSync(skillMd)) return true;
  const content = readFileSync(skillMd, "utf-8");
  const fm = parseFrontmatter(content);
  if (!("global" in fm)) return true;
  return fm["global"] !== "false";
}

/**
 * Returns true if a skill has an explicit `global:` field in its SKILL.md.
 * Skills without this field are "unclassified" and should trigger a prompt during sync/add.
 */
export function isSkillClassified(skillDir: string): boolean {
  const skillMd = join(skillDir, "SKILL.md");
  if (!existsSync(skillMd)) return false;
  const content = readFileSync(skillMd, "utf-8");
  const fm = parseFrontmatter(content);
  return "global" in fm;
}

/**
 * Write or update the `global:` field in a skill's SKILL.md frontmatter.
 * Creates SKILL.md if it does not exist.
 */
export function setSkillGlobal(skillDir: string, value: boolean): void {
  const skillMd = join(skillDir, "SKILL.md");
  if (!existsSync(skillMd)) {
    writeFileSync(skillMd, `---\nname: ${basename(skillDir)}\nglobal: ${value}\n---\n`);
    return;
  }
  let content = readFileSync(skillMd, "utf-8");
  if (content.match(/^---/)) {
    if (content.match(/\nglobal:/)) {
      // Replace existing global line
      content = content.replace(/\nglobal: (true|false)/, `\nglobal: ${value}`);
    } else {
      // Inject after opening ---
      content = content.replace(/^---\r?\n/, `---\nglobal: ${value}\n`);
    }
    writeFileSync(skillMd, content);
  } else {
    writeFileSync(skillMd, `---\nglobal: ${value}\n---\n\n` + content);
  }
}
