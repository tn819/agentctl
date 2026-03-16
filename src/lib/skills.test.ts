import { describe, test, expect } from "bun:test";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { isSkillGlobal } from "./skills";

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
