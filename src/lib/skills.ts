import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
    const kv = lines[i]!.match(/^(\w[\w-]*):\s*(.+)/);
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
  const behind = parseInt(behindResult.stdout.trim(), 10);
  if (isNaN(behind) || behind === 0) return null;

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
  if (content.match(/^---/)) {
    if (content.match(/\nglobal:/)) {
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
