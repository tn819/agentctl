import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Parse YAML frontmatter from a SKILL.md file.
 * Returns key-value pairs from the --- block.
 * Lightweight — no full YAML parser needed for simple scalar values.
 */
function parseFrontmatter(content: string): Record<string, string> {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") return {};
  const result: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") break;
    const kv = (/^(\w[\w-]*):\s*(.+)/).exec(lines[i]!);
    if (kv) result[kv[1]!] = kv[2]!.trim();
  }
  return result;
}

// ── Skill metadata (includes array fields) ──────────────────────────────────

export interface SkillMeta {
  name?: string;
  description?: string;
  version?: string;
  /** Claude Code `allowed-tools` frontmatter — other platforms ignore it. */
  allowedTools?: string[];
}

export interface SkillHazard {
  file: string;
  pattern: string;
  line: number;
}

/** Inline array: `[Bash, Read, Write]` */
function parseInlineArray(value: string): string[] | null {
  const m = value.match(/^\[([^\]]+)\]$/);
  if (!m) return null;
  return m[1]!.split(",").map(s => s.trim()).filter(Boolean);
}

/**
 * Parse all structured frontmatter from a SKILL.md content string,
 * including the `allowed-tools` array field (inline or block style).
 */
export function parseSkillFrontmatter(content: string): SkillMeta {
  const meta: SkillMeta = {};
  // Extract frontmatter block without a multi-line regex (avoids ReDoS with [\s\S]*?)
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) return meta;
  const bodyStart = content.indexOf("\n") + 1;
  const endMarker = content.indexOf("\n---", bodyStart);
  if (endMarker === -1) return meta;
  const block = content.slice(bodyStart, endMarker);

  const lines = block.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;

    // Block-array key: "allowed-tools:" with list items on following lines
    const blockKey = line.match(/^([\w-]+):\s*$/);
    if (blockKey) {
      const key = blockKey[1]!;
      const items: string[] = [];
      i++;
      while (i < lines.length && /^\s+-\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s+-\s+/, "").trim());
        i++;
      }
      if (key === "allowed-tools" && items.length) meta.allowedTools = items;
      continue;
    }

    // Scalar or inline-array
    const kv = line.match(/^([\w-]+):\s*([^\r\n]+)/);
    if (kv) {
      const [, key, val] = kv as [string, string, string];
      const trimmed = val.trim();
      switch (key) {
        case "allowed-tools": {
          const arr = parseInlineArray(trimmed);
          if (arr) meta.allowedTools = arr;
          break;
        }
        case "name":        meta.name        = trimmed; break;
        case "description": meta.description = trimmed; break;
        case "version":     meta.version     = trimmed; break;
      }
    }
    i++;
  }
  return meta;
}

/** Read and parse SKILL.md from a skill directory. Returns `{}` if missing. */
export function readSkillMeta(skillDir: string): SkillMeta {
  assertSafePath(skillDir);
  const skillMd = join(skillDir, "SKILL.md");
  if (!existsSync(skillMd)) return {};
  return parseSkillFrontmatter(readFileSync(skillMd, "utf-8"));
}

/**
 * Scan a skill directory for static hazard patterns in SKILL.md and
 * bundled scripts. Returns an array of findings; empty means no issues.
 *
 * Note: this is best-effort heuristic analysis — it cannot catch all
 * dangerous instructions, and some findings may be false positives.
 */
export function scanSkillHazards(skillDir: string): SkillHazard[] {
  const hazards: SkillHazard[] = [];

  const PATTERNS: Array<{ re: RegExp; label: string }> = [
    { re: /curl\s+[^\n]+\|\s*(ba)?sh/i,           label: "curl-pipe-sh" },
    { re: /wget\s+[^\n]+\|\s*(ba)?sh/i,           label: "wget-pipe-sh" },
    { re: /base64\s+-d\s*\|\s*(ba)?sh/i,          label: "base64-pipe-sh" },
    { re: /rm\s+-[a-z]*r[a-z]*f?\s+\//i,          label: "rm-rf-absolute" },
    { re: /\beval\s*["'`$\(]/,                     label: "eval-exec" },
    { re: /\$\([^\n]*curl|`[^\n]*curl/i,           label: "subshell-curl" },
  ];

  function scanFile(filePath: string): void {
    if (!existsSync(filePath)) return;
    const lines = readFileSync(filePath, "utf-8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      for (const { re, label } of PATTERNS) {
        if (re.test(lines[i]!)) {
          hazards.push({ file: basename(filePath), pattern: label, line: i + 1 });
        }
      }
    }
  }

  // Scan SKILL.md content (catches instructions directing the agent)
  scanFile(join(skillDir, "SKILL.md"));

  // Scan all bundled scripts
  const scriptsDir = join(skillDir, "scripts");
  if (existsSync(scriptsDir)) {
    for (const f of readdirSync(scriptsDir)) {
      const full = join(scriptsDir, f);
      if (statSync(full).isFile()) scanFile(full);
    }
  }

  return hazards;
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
/**
 * Build a clean environment for git subprocess calls that strips any inherited
 * GIT_DIR / GIT_WORK_TREE overrides so that isGitRepo correctly detects
 * whether a directory is itself a git repo.
 */
function cleanGitEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env["GIT_DIR"];
  delete env["GIT_WORK_TREE"];
  delete env["GIT_INDEX_FILE"];
  delete env["GIT_OBJECT_DIRECTORY"];
  return env;
}

/**
 * Validates that a path is safe to pass to spawnSync as a directory argument.
 * Rejects relative paths and paths containing shell metacharacters.
 * This makes the security intent explicit and addresses OS command injection hotspots.
 */
export function assertSafePath(p: string): void {
  if (!p.startsWith("/") || /[;&|`$<>]/.test(p)) {
    throw new Error(`Unsafe path rejected: ${p}`);
  }
}

/**
 * Returns true if the given directory is a git repository.
 */
export function isGitRepo(skillDir: string): boolean {
  assertSafePath(skillDir);
  const result = spawnSync("git", ["-C", skillDir, "rev-parse", "--git-dir"], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "ignore"],
    env: cleanGitEnv(),
  });
  return result.status === 0;
}

export type SkillUpdateInfo = {
  behind: number;       // number of commits behind upstream
  filesSummary: string; // e.g. "SKILL.md, README.md (+2 more)"
};

/**
 * Fetches from origin and returns info about how far behind the local branch is.
 * Returns null if not a git repo, no remote, or already up to date.
 */
export function fetchAndCheckSkill(skillDir: string): SkillUpdateInfo | null {
  assertSafePath(skillDir);
  if (!isGitRepo(skillDir)) return null;

  // git fetch origin (silent — ignore errors if no network)
  spawnSync("git", ["-C", skillDir, "fetch", "origin"], {
    encoding: "utf-8",
    stdio: "ignore",
    env: cleanGitEnv(),
  });

  // Count commits behind
  const behindResult = spawnSync( // NOSONAR — hardcoded "git" command, path validated by assertSafePath
    "git", ["-C", skillDir, "rev-list", "--count", "HEAD..@{u}"],
    { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"], env: cleanGitEnv() }
  );
  if (behindResult.status !== 0) return null;
  const behind = Number.parseInt(behindResult.stdout.trim(), 10);
  if (Number.isNaN(behind) || behind === 0) return null;

  // Get changed files summary
  const filesResult = spawnSync( // NOSONAR — hardcoded "git" command, path validated by assertSafePath
    "git", ["-C", skillDir, "diff", "--name-only", "HEAD..@{u}"],
    { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"], env: cleanGitEnv() }
  );
  const files = (filesResult.stdout ?? "").trim().split("\n").filter(Boolean);
  const filesSummary = files.length <= 3
    ? files.join(", ")
    : `${files.slice(0, 3).join(", ")} (+${files.length - 3} more)`;

  return { behind, filesSummary };
}

/**
 * Pulls the latest changes for a skill directory (fast-forward only).
 * Returns true on success.
 */
export function pullSkill(skillDir: string): boolean {
  assertSafePath(skillDir);
  const result = spawnSync("git", ["-C", skillDir, "pull", "--ff-only"], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
    env: cleanGitEnv(),
  });
  return result.status === 0;
}

export function setSkillGlobal(skillDir: string, value: boolean): void {
  const skillMd = join(skillDir, "SKILL.md");
  if (!existsSync(skillMd)) {
    writeFileSync(skillMd, `---\nname: ${basename(skillDir)}\nglobal: ${value}\n---\n`);
    return;
  }
  let content = readFileSync(skillMd, "utf-8"); // NOSONAR — path constrained to join(skillDir, "SKILL.md")
  if (content.startsWith("---")) {
    if (content.includes("\nglobal:")) {
      // Replace existing global line
      content = content.replace(/\nglobal: (true|false)/, `\nglobal: ${value}`);
    } else {
      // Inject after opening ---
      content = content.replace(/^---\r?\n/, `---\nglobal: ${value}\n`);
    }
    writeFileSync(skillMd, content); // NOSONAR — path constrained to join(skillDir, "SKILL.md")
  } else {
    writeFileSync(skillMd, `---\nglobal: ${value}\n---\n\n` + content);
  }
}
