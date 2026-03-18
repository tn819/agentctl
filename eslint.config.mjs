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

      // ── SonarCloud S1301: Prefer if over single-case switch ──────────────
      "sonarjs/no-small-switch": "error",

      // ── SonarCloud S3358: No nested ternary expressions ──────────────────
      "no-nested-ternary": "error",

      // ── SonarCloud S7735: No negated conditions ───────────────────────────
      "no-negated-condition": "error",

      // ── SonarCloud S7744: No useless fallback in spread (e.g. ?? {}) ─────
      "unicorn/no-useless-fallback-in-spread": "error",

      // ── TypeScript hygiene ────────────────────────────────────────────────
      // warn (not error) so pre-existing `any` in daemon/proxy doesn't block commits
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],

      // ── Bun compiled-binary safety ────────────────────────────────────────
      // import.meta.dir and import.meta.url → .pathname resolve to /$bunfs/…
      // paths in a compiled Bun binary and cannot be used to read bundled files
      // at runtime. Use static `import` for bundled assets instead.
      "no-restricted-syntax": [
        "error",
        {
          // import.meta.dir
          selector:
            "MemberExpression[object.type='MetaProperty'][object.meta.name='import'][object.property.name='meta'][property.name='dir']",
          message:
            "import.meta.dir is '/$bunfs/root' in compiled Bun binaries. Use a static import for bundled assets.",
        },
        {
          // new URL("...", import.meta.url).pathname — file-path-from-source pattern
          selector:
            "MemberExpression[property.name='pathname'][object.type='NewExpression'][object.callee.name='URL'] > NewExpression > MemberExpression[object.type='MetaProperty'][object.meta.name='import'][object.property.name='meta'][property.name='url']",
          message:
            "new URL(..., import.meta.url).pathname resolves into /$bunfs in compiled Bun binaries. Use a static import for bundled assets or Bun.main for self-exec paths.",
        },
      ],
    },
  },
];
