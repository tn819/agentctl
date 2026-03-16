import { describe, test, expect } from "bun:test";
import { writeFileSync, readFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { isSkillGlobal, isSkillClassified, isGitRepo, assertSafePath, fetchAndCheckSkill, setSkillGlobal } from "./skills";

const tmp = "/tmp/vakt-skills-test";

describe("isSkillGlobal", () => {
  test("returns true for skill with global: true", () => {
    mkdirSync(join(tmp, "my-skill"), { recursive: true });
    writeFileSync(join(tmp, "my-skill", "SKILL.md"),
      "---\nname: my-skill\nglobal: true\n---\n\n# My Skill\n");
    expect(isSkillGlobal(join(tmp, "my-skill"))).toBe(true);
    rmSync(tmp, { recursive: true });
  });

  test("returns false for skill with global: false", () => {
    mkdirSync(join(tmp, "my-skill"), { recursive: true });
    writeFileSync(join(tmp, "my-skill", "SKILL.md"),
      "---\nname: my-skill\nglobal: false\n---\n\n# My Skill\n");
    expect(isSkillGlobal(join(tmp, "my-skill"))).toBe(false);
    rmSync(tmp, { recursive: true });
  });

  test("returns true for skill with no global field (default)", () => {
    mkdirSync(join(tmp, "my-skill"), { recursive: true });
    writeFileSync(join(tmp, "my-skill", "SKILL.md"),
      "---\nname: my-skill\n---\n\n# My Skill\n");
    expect(isSkillGlobal(join(tmp, "my-skill"))).toBe(true);
    rmSync(tmp, { recursive: true });
  });

  test("returns true for skill with no SKILL.md", () => {
    mkdirSync(tmp, { recursive: true });
    expect(isSkillGlobal(tmp)).toBe(true);
    rmSync(tmp, { recursive: true });
  });
});

describe("isGitRepo", () => {
  test("returns true for a real git repo", () => {
    // The project root is a git repo — use the worktree
    const projectRoot = new URL("../../", import.meta.url).pathname;
    expect(isGitRepo(projectRoot)).toBe(true);
  });

  test("returns false for a plain directory", () => {
    const tmp = mkdtempSync("/tmp/not-a-git-");
    expect(isGitRepo(tmp)).toBe(false);
    rmSync(tmp, { recursive: true });
  });
});

describe("assertSafePath", () => {
  test("accepts a normal absolute path", () => {
    expect(() => assertSafePath("/tmp/my-skill")).not.toThrow();
  });

  test("accepts an absolute path with hyphens and underscores", () => {
    expect(() => assertSafePath("/home/user/.agents/skills/my_skill-v2")).not.toThrow();
  });

  test("rejects a relative path", () => {
    expect(() => assertSafePath("relative/path")).toThrow("Unsafe path rejected");
  });

  test("rejects a path with semicolon", () => {
    expect(() => assertSafePath("/tmp/foo;bar")).toThrow("Unsafe path rejected");
  });

  test("rejects a path with pipe", () => {
    expect(() => assertSafePath("/tmp/foo|bar")).toThrow("Unsafe path rejected");
  });

  test("rejects a path with ampersand", () => {
    expect(() => assertSafePath("/tmp/foo&bar")).toThrow("Unsafe path rejected");
  });

  test("rejects a path with backtick", () => {
    expect(() => assertSafePath("/tmp/foo`bar")).toThrow("Unsafe path rejected");
  });

  test("rejects a path with dollar sign", () => {
    expect(() => assertSafePath("/tmp/foo$bar")).toThrow("Unsafe path rejected");
  });

  test("rejects a path with angle brackets", () => {
    expect(() => assertSafePath("/tmp/foo<bar>")).toThrow("Unsafe path rejected");
  });

  test("rejects an empty string", () => {
    expect(() => assertSafePath("")).toThrow("Unsafe path rejected");
  });
});

describe("isSkillClassified", () => {
  test("returns false when no SKILL.md exists", () => {
    mkdirSync(tmp, { recursive: true });
    expect(isSkillClassified(tmp)).toBe(false);
    rmSync(tmp, { recursive: true });
  });

  test("returns false when SKILL.md has no global field", () => {
    mkdirSync(join(tmp, "s"), { recursive: true });
    writeFileSync(join(tmp, "s", "SKILL.md"), "---\nname: s\n---\n");
    expect(isSkillClassified(join(tmp, "s"))).toBe(false);
    rmSync(tmp, { recursive: true });
  });

  test("returns true when SKILL.md has global: true", () => {
    mkdirSync(join(tmp, "s"), { recursive: true });
    writeFileSync(join(tmp, "s", "SKILL.md"), "---\nname: s\nglobal: true\n---\n");
    expect(isSkillClassified(join(tmp, "s"))).toBe(true);
    rmSync(tmp, { recursive: true });
  });

  test("returns true when SKILL.md has global: false", () => {
    mkdirSync(join(tmp, "s"), { recursive: true });
    writeFileSync(join(tmp, "s", "SKILL.md"), "---\nname: s\nglobal: false\n---\n");
    expect(isSkillClassified(join(tmp, "s"))).toBe(true);
    rmSync(tmp, { recursive: true });
  });
});

describe("fetchAndCheckSkill", () => {
  test("returns null for a non-git directory", () => {
    const dir = mkdtempSync("/tmp/vakt-fetch-test-");
    expect(fetchAndCheckSkill(dir)).toBeNull();
    rmSync(dir, { recursive: true });
  });

  test("returns null for a local git repo with no remote", () => {
    const dir = mkdtempSync("/tmp/vakt-fetch-test-");
    spawnSync("git", ["init", dir]);
    spawnSync("git", ["-C", dir, "config", "user.email", "test@test.com"]);
    spawnSync("git", ["-C", dir, "config", "user.name", "Test"]);
    writeFileSync(join(dir, "README.md"), "test");
    spawnSync("git", ["-C", dir, "add", "."]);
    spawnSync("git", ["-C", dir, "commit", "-m", "init"]);
    // No remote configured — rev-list @{u} will fail → returns null
    expect(fetchAndCheckSkill(dir)).toBeNull();
    rmSync(dir, { recursive: true });
  });
});

describe("setSkillGlobal", () => {
  test("creates SKILL.md when it does not exist", () => {
    const dir = mkdtempSync("/tmp/vakt-setglobal-test-");
    setSkillGlobal(dir, true);
    const content = readFileSync(join(dir, "SKILL.md"), "utf-8");
    expect(content).toContain("global: true");
    rmSync(dir, { recursive: true });
  });

  test("updates existing global: true to false", () => {
    const dir = mkdtempSync("/tmp/vakt-setglobal-test-");
    writeFileSync(join(dir, "SKILL.md"), "---\nname: test\nglobal: true\n---\n");
    setSkillGlobal(dir, false);
    const content = readFileSync(join(dir, "SKILL.md"), "utf-8");
    expect(content).toContain("global: false");
    rmSync(dir, { recursive: true });
  });

  test("injects global field when SKILL.md has frontmatter but no global field", () => {
    const dir = mkdtempSync("/tmp/vakt-setglobal-test-");
    writeFileSync(join(dir, "SKILL.md"), "---\nname: test\n---\n\n# Body\n");
    setSkillGlobal(dir, true);
    const content = readFileSync(join(dir, "SKILL.md"), "utf-8");
    expect(content).toContain("global: true");
    rmSync(dir, { recursive: true });
  });

  test("creates frontmatter when SKILL.md has no --- block", () => {
    const dir = mkdtempSync("/tmp/vakt-setglobal-test-");
    writeFileSync(join(dir, "SKILL.md"), "# Just a body\nNo frontmatter here\n");
    setSkillGlobal(dir, true);
    const content = readFileSync(join(dir, "SKILL.md"), "utf-8");
    expect(content).toContain("global: true");
    rmSync(dir, { recursive: true });
  });
});
