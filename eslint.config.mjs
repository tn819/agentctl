// @ts-check
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    // Only lint production source — test files excluded
    files: ["src/**/*.ts"],
    ignores: ["src/**/*.test.ts", "dist/**"],
    plugins: {
      "@typescript-eslint": tseslint,
      sonarjs,
      unicorn,
    },
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    rules: {
      // ── SonarCloud S3776: Cognitive Complexity ────────────────────────────
      // Matches the SonarCloud threshold; catches overly complex functions
      // before they reach CI.
      "sonarjs/cognitive-complexity": ["error", 15],

      // ── SonarCloud S1940: No negated condition as primary branch ─────────
      "sonarjs/no-inverted-boolean-check": "error",

      // ── SonarCloud S2201: Return values must be used ──────────────────────
      "sonarjs/no-ignored-return": "error",

      // ── SonarCloud S4144: No identical functions ──────────────────────────
      "sonarjs/no-identical-functions": "error",

      // ── SonarCloud S6594: Prefer RegExp.exec() over String.match() ───────
      // Requires type info; only triggers when return value matters.
      "@typescript-eslint/prefer-regexp-exec": "error",

      // ── SonarCloud S2138 equiv: Number.parseInt / Number.isNaN ───────────
      "unicorn/prefer-number-properties": ["error", { checkInfinity: false }],

      // ── SonarCloud S1126 — Return boolean expression directly ────────────
      "sonarjs/prefer-single-boolean-return": "error",

      // ── SonarCloud S1488 — Immediately returned variable ─────────────────
      "sonarjs/prefer-immediate-return": "error",

      // ── TypeScript hygiene ────────────────────────────────────────────────
      // warn (not error) so pre-existing `any` in daemon/proxy doesn't block commits
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];
