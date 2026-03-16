import { describe, test, expect } from "bun:test";
import { promptBoolean } from "./prompt";

describe("promptBoolean export", () => {
  test("is a function", () => {
    expect(typeof promptBoolean).toBe("function");
  });
});
