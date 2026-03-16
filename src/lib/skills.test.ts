import { describe, test, expect } from "bun:test";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { isSkillGlobal, isSkillClassified } from "./skills";

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
