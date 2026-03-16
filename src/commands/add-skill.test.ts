import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { setSkillGlobal } from "./add-skill";

const tmp = "/tmp/vakt-add-skill-test";

describe("setSkillGlobal", () => {
  beforeEach(() => mkdirSync(tmp, { recursive: true }));
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  test("creates SKILL.md with global: true when no SKILL.md exists", () => {
    setSkillGlobal(tmp, true);
    const content = readFileSync(join(tmp, "SKILL.md"), "utf-8");
    expect(content).toContain("global: true");
  });

  test("sets global: true in existing SKILL.md frontmatter", () => {
    writeFileSync(join(tmp, "SKILL.md"), "---\nname: my-skill\n---\n\n# Body\n");
    setSkillGlobal(tmp, true);
    const content = readFileSync(join(tmp, "SKILL.md"), "utf-8");
    expect(content).toContain("global: true");
  });

  test("sets global: false in existing SKILL.md frontmatter", () => {
    writeFileSync(join(tmp, "SKILL.md"), "---\nname: my-skill\nglobal: true\n---\n\n# Body\n");
    setSkillGlobal(tmp, false);
    const content = readFileSync(join(tmp, "SKILL.md"), "utf-8");
    expect(content).toContain("global: false");
    expect(content).not.toContain("global: true");
  });
});
