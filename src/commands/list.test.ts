import { describe, test, expect } from "bun:test";
import { globalTag } from "./list";

describe("globalTag", () => {
  test("returns green [global] for true", () => {
    const tag = globalTag(true);
    expect(tag).toContain("[global]");
  });

  test("returns yellow [local] for false", () => {
    const tag = globalTag(false);
    expect(tag).toContain("[local]");
  });
});
