import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { expandHome } from "./config";
import { KNOWN_TOOLS, type ToolPermission } from "./schemas";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PermissionsResult {
  written: boolean;
  path: string;
  allow: string[];
  deny: string[];
  warnings: string[];
}

export interface PermissionsAdapter {
  apply(
    allow: ToolPermission[],
    deny: ToolPermission[],
    dryRun: boolean,
  ): PermissionsResult;
}

// ── Serialisation ─────────────────────────────────────────────────────────────

/** Serialise a ToolPermission back to the Claude Code string format. */
export function serializeToolPermission(p: ToolPermission): string {
  return p.specifier !== undefined ? `${p.tool}(${p.specifier})` : p.tool;
}

// ── Warning helpers ───────────────────────────────────────────────────────────

const KNOWN_TOOL_SET = new Set<string>(KNOWN_TOOLS);

function collectWarnings(permissions: ToolPermission[]): string[] {
  return permissions
    .filter((p) => !KNOWN_TOOL_SET.has(p.tool))
    .map(
      (p) =>
        `unknown tool "${p.tool}" — not in KNOWN_TOOLS; run "bun run check:tool-enum" to detect drift`,
    );
}

// ── Marker convention ─────────────────────────────────────────────────────────
//
// vakt writes a top-level "_vakt_managed" key into settings.json that records
// exactly which allow/deny entries it injected. On the next sync, vakt removes
// those entries from permissions.allow/deny and re-inserts the current policy.
// Entries not present in _vakt_managed are treated as user-managed and are
// never touched.
//
// Marker format (stable — changing this requires a migration):
//   "_vakt_managed": { "allow": ["Bash(git *)"], "deny": ["WebSearch"] }

const VAKT_MARKER_KEY = "_vakt_managed";

interface VaktMarker {
  allow: string[];
  deny: string[];
}

interface ClaudeSettings {
  permissions?: {
    allow?: string[];
    deny?: string[];
    [key: string]: unknown;
  };
  _vakt_managed?: VaktMarker;
  [key: string]: unknown;
}

// ── Claude settings adapter ───────────────────────────────────────────────────

export class ClaudeSettingsAdapter implements PermissionsAdapter {
  constructor(private readonly settingsPath: string) {}

  apply(
    allow: ToolPermission[],
    deny: ToolPermission[],
    dryRun: boolean,
  ): PermissionsResult {
    const resolvedPath = expandHome(this.settingsPath);
    const warnings: string[] = [
      ...collectWarnings(allow),
      ...collectWarnings(deny),
    ];

    const allowStrings = allow.map(serializeToolPermission);
    const denyStrings = deny.map(serializeToolPermission);

    if (dryRun) {
      return { written: false, path: resolvedPath, allow: allowStrings, deny: denyStrings, warnings };
    }

    // Read existing settings (or start empty)
    let settings: ClaudeSettings = {};
    if (existsSync(resolvedPath)) {
      try {
        settings = JSON.parse(readFileSync(resolvedPath, "utf-8")) as ClaudeSettings;
      } catch {
        // Treat unparseable file as empty — safer than aborting the sync
        warnings.push(`could not parse ${resolvedPath} — treating as empty`);
      }
    }

    // Strip previously vakt-managed entries from permissions arrays
    const prevMarker: VaktMarker = settings[VAKT_MARKER_KEY] ?? { allow: [], deny: [] };
    const prevAllowSet = new Set(prevMarker.allow);
    const prevDenySet = new Set(prevMarker.deny);

    const existingAllow = (settings.permissions?.allow ?? []).filter(
      (e) => !prevAllowSet.has(e),
    );
    const existingDeny = (settings.permissions?.deny ?? []).filter(
      (e) => !prevDenySet.has(e),
    );

    // Merge: user-managed entries first, vakt-managed entries appended
    const mergedAllow = [...existingAllow, ...allowStrings];
    const mergedDeny = [...existingDeny, ...denyStrings];

    const updated: ClaudeSettings = {
      ...settings,
      permissions: {
        ...(settings.permissions ?? {}),
        ...(mergedAllow.length > 0 ? { allow: mergedAllow } : {}),
        ...(mergedDeny.length > 0 ? { deny: mergedDeny } : {}),
      },
      [VAKT_MARKER_KEY]: { allow: allowStrings, deny: denyStrings },
    };

    // Remove empty permissions keys to keep the file clean
    if ((updated.permissions?.allow?.length ?? 0) === 0) delete updated.permissions!.allow;
    if ((updated.permissions?.deny?.length ?? 0) === 0) delete updated.permissions!.deny;
    if (Object.keys(updated.permissions ?? {}).length === 0) delete updated.permissions;

    // Remove marker when vakt has nothing to manage
    if (allowStrings.length === 0 && denyStrings.length === 0) {
      delete updated[VAKT_MARKER_KEY];
    }

    // Atomic write: temp file + rename
    const dir = dirname(resolvedPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const tmp = join(dir, `.vakt-settings-${randomBytes(6).toString("hex")}.tmp`);
    writeFileSync(tmp, JSON.stringify(updated, null, 2) + "\n", { encoding: "utf-8" });
    // rename is atomic on POSIX; on Windows it overwrites via separate copy+delete
    try {
      renameSync(tmp, resolvedPath); // NOSONAR — intentional atomic write
    } catch {
      // Fallback for cross-device rename (e.g. tmpfs → home on some Linux configs)
      writeFileSync(resolvedPath, JSON.stringify(updated, null, 2) + "\n", { encoding: "utf-8" });
      try { unlinkSync(tmp); } catch { /* ignore */ }
    }

    return { written: true, path: resolvedPath, allow: allowStrings, deny: denyStrings, warnings };
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function makePermissionsAdapter(
  format: "claude-settings",
  path: string,
): PermissionsAdapter {
  switch (format) {
    case "claude-settings":
      return new ClaudeSettingsAdapter(path);
  }
}
