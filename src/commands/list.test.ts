import { describe, test, expect } from "bun:test";
import { globalTag } from "./list";

describe("globalTag", () => {
  test("returns green [global] for 'global'", () => {
    const tag = globalTag("global");
    expect(tag).toContain("[global]");
  });

  test("returns yellow [local] for 'local'", () => {
    const tag = globalTag("local");
    expect(tag).toContain("[local]");
  });
});
