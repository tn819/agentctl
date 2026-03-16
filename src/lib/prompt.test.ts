import { describe, test, expect } from "bun:test";
import { promptBoolean } from "./prompt";

describe("promptBoolean", () => {
  test("returns true when user enters 'y'", async () => {
    const result = await promptBoolean("Question?", false, async () => "y");
    expect(result).toBe(true);
  });

  test("returns true when user enters 'Y'", async () => {
    const result = await promptBoolean("Question?", false, async () => "Y");
    expect(result).toBe(true);
  });

  test("returns false when user enters 'n'", async () => {
    const result = await promptBoolean("Question?", false, async () => "n");
    expect(result).toBe(false);
  });

  test("returns false when user enters anything other than y", async () => {
    const result = await promptBoolean("Question?", false, async () => "yes");
    expect(result).toBe(false);
  });

  test("returns false when user enters empty string", async () => {
    const result = await promptBoolean("Question?", false, async () => "");
    expect(result).toBe(false);
  });

  test("returns defaultValue when EOF (null)", async () => {
    const result = await promptBoolean("Question?", false, async () => null);
    expect(result).toBe(false);
  });

  test("returns true as defaultValue when EOF and defaultValue=true", async () => {
    const result = await promptBoolean("Question?", true, async () => null);
    expect(result).toBe(true);
  });

  test("trims whitespace from input", async () => {
    const result = await promptBoolean("Question?", false, async () => "  y  ");
    expect(result).toBe(true);
  });
});
