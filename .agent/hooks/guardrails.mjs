#!/usr/bin/env node
/**
 * Deterministic guardrail enforcement for Playwright Agent Kit (PreToolUse hook).
 *
 * Reads a tool-call JSON payload on stdin; prints violations to stderr and exits 2 to
 * block, or exits 0 to allow.
 *
 * Two kinds of checks:
 * - protected-path: blocks agent mutations of governance and agent/CLI state
 *   (.agent/, .claude/, .cursor/, .cursorrules, .codex/, .antigravitycli/, .playwright-cli/),
 *   including shell commands that appear to modify them.
 * - content rules: the proposed file content is linted in memory with the repo's own
 *   `eslint.config.mjs` (the same rules humans hit via `npm run lint`) before it is written.
 *
 * Fail-closed: malformed input or any unhandled error exits 2 so a runtime error can never
 * silently bypass the guardrails.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// ==============================================================================
// Paths
// ==============================================================================

function realpathLoose(p) {
  try {
    return fs.realpathSync.native(p);
  } catch {
    const parent = path.dirname(p);
    if (parent === p) return p;
    return path.join(realpathLoose(parent), path.basename(p));
  }
}

function projectRoot() {
  const envRoot = process.env.CLAUDE_PROJECT_DIR || process.env.PROJECT_ROOT;
  if (envRoot && fs.existsSync(envRoot) && fs.statSync(envRoot).isDirectory()) {
    return realpathLoose(envRoot);
  }
  const hooksDir = path.dirname(fileURLToPath(import.meta.url));
  return realpathLoose(path.resolve(hooksDir, "..", ".."));
}

const PROJECT_ROOT = projectRoot();

/** Repo-relative path with forward slashes; resolves symlinks and `..` so traversal cannot dodge predicates. */
function repoRel(p) {
  const full = path.isAbsolute(p) ? p : path.join(PROJECT_ROOT, p);
  return path
    .relative(PROJECT_ROOT, realpathLoose(path.resolve(full)))
    .split(path.sep)
    .join("/");
}

// COUPLING INVARIANT: keep protected entries in sync with SHELL_PROTECTED_TARGET.
// `eslint.config.mjs`, `lint-staged.config.mjs` and `.husky/` hold the rule definitions and the commit gate,
// so an agent that could edit them could switch every content rule off.
const PROTECTED_PATH =
  /(?:^|\/)(?:\.agent\/|\.claude\/|\.cursor\/|\.cursorrules$|\.codex\/|\.antigravitycli\/|\.playwright-cli\/|\.husky\/|eslint\.config\.mjs$|lint-staged\.config\.mjs$)/i;

const TS_FILE = /\.ts$/i;

// ==============================================================================
// Tool classification
// ==============================================================================

const READ_ONLY_TOOLS = new Set([
  "read",
  "read_file",
  "view_file",
  "view_file_outline",
  "view_code_item",
  "glob",
  "grep",
  "grep_search",
  "ls",
  "list_dir",
  "find_by_name",
  "read_notebook",
  "list_resources",
  "read_resource",
]);

const CONTENT_RULE_TOOLS = new Set([
  "write",
  "edit",
  "multiedit",
  "write_file",
  "edit_file",
  "batch_edit",
  "notebookedit",
  "notebook_edit",
]);

const PATCH_TOOLS = new Set(["apply_patch", "patch_file"]);

const SHELL_TOOLS = new Set([
  "bash",
  "shell",
  "powershell",
  "pwsh",
  "cmd",
  "run_command",
  "execute_command",
  "terminal",
]);

// ==============================================================================
// Shell command inspection
// ==============================================================================

// COUPLING INVARIANT: keep protected entries in sync with PROTECTED_PATH.
const SHELL_PROTECTED_TARGET =
  /(?:^|[\s"'`=;:,/\\<>(){}|&$])(?:\.(?:agent|claude|cursor|codex|antigravitycli|playwright-cli|husky)(?:[/\\]|$|[\s"'`;|&>)])|(?:\.cursorrules|eslint\.config\.mjs|lint-staged\.config\.mjs)(?:$|[\s"'`;|&>)]))/i;

// Redirects that discard output or duplicate a descriptor never write a file, so they are
// removed before looking for mutations (otherwise `ls .agent 2>/dev/null` looked like a write).
const HARMLESS_REDIRECT =
  /(?:\d*|&|\*)>>?\s*(?:\/dev\/null|\$null|nul)\b|\d*>&\d/gi;

// Negative lookbehind `(?<!\.)` keeps filenames such as `guardrails.py` from matching a command name.
const SHELL_MUTATION_OP = new RegExp(
  [
    ">>?",
    String.raw`\|\s*tee\b`,
    String.raw`(?<!\.)\b(?:rm|rmdir|unlink|mv|cp|mkdir|touch|chmod|chown|ln|truncate|install|dd|patch|del|erase|ren|rename|move|copy|xcopy|robocopy)\b`,
    String.raw`(?<!\.)\bgit\s+(?:checkout|restore|reset|clean|rm|mv|apply)\b`,
    String.raw`(?<!\.)\bsed\b[^\n;]*\s-[^\s]*i`,
    String.raw`(?<!\.)\bawk\b[^\n;]*-i\s+inplace`,
    String.raw`(?<!\.)\bperl\b[^\n;]*\s-[^\s]*i`,
    String.raw`(?<!\.)\b(?:Out-File|Set-Content|Add-Content|New-Item|Remove-Item|Move-Item|Copy-Item|Rename-Item|Clear-Content|sc|ac|ri|ni|mi|cpi|rni)\b`,
    String.raw`\b(?:WriteAllText|WriteAllLines|WriteAllBytes|AppendAllText|AppendAllLines)\b`,
    // Formatters/fixers rewrite files in place.
    String.raw`(?<!\.)\b(?:prettier|eslint)\b`,
    String.raw`(?<!\.)\b(?:python|python3|py|node|ruby|pwsh|powershell)\b`,
  ].join("|"),
  "i",
);

function shellCommandIsBlocked(command) {
  if (typeof command !== "string") return false;
  if (!SHELL_PROTECTED_TARGET.test(command)) return false;
  return SHELL_MUTATION_OP.test(command.replace(HARMLESS_REDIRECT, " "));
}

// ==============================================================================
// Patch parsing
// ==============================================================================

/** Extract touched paths and added lines per file from `apply_patch` or unified diffs. */
function parsePatch(patchText) {
  const touched = [];
  const added = new Map();
  let current = "";

  const record = (p) => {
    if (p && !added.has(p)) {
      touched.push(p);
      added.set(p, []);
    }
  };

  for (const line of patchText.split(/\r?\n/)) {
    const prefix = [
      "*** Update File:",
      "*** Add File:",
      "*** Delete File:",
      "*** Move to:",
    ].find((x) => line.startsWith(x));
    if (prefix) {
      const target = line.slice(prefix.length).trim();
      if (target) {
        record(target);
        current = target;
      }
    } else if (line.startsWith("--- ") || line.startsWith("+++ ")) {
      let raw = line.slice(4).trim().split("\t")[0];
      if (raw !== "/dev/null") {
        raw = raw.replace(/^[ab]\//, "");
        record(raw);
        current = raw;
      }
    } else if (line.startsWith("+") && current) {
      added.get(current).push(line.slice(1));
    }
  }
  return { touched, added };
}

// ==============================================================================
// Content views for edit tools
// ==============================================================================

function readExisting(relPath) {
  try {
    return fs.readFileSync(path.join(PROJECT_ROOT, relPath), "utf8");
  } catch {
    return null;
  }
}

function applyEdits(text, edits) {
  for (const { old, next, replaceAll } of edits) {
    if (
      typeof old !== "string" ||
      typeof next !== "string" ||
      old === "" ||
      !text.includes(old)
    )
      return null;
    text = replaceAll
      ? text.split(old).join(next)
      : text.replace(old, () => next);
  }
  return text;
}

const first = (...vals) => vals.find((v) => v) ?? "";

/** Returns `{ old, next, delta }`. Full writes lint the whole file; edits apply in memory against disk. */
function contentViews(toolName, input, relPath) {
  const name = toolName.toLowerCase();

  if (name === "write" || name === "write_file") {
    return { old: "", next: first(input.content, input.Content), delta: false };
  }
  if (name === "notebookedit" || name === "notebook_edit") {
    return {
      old: "",
      next: first(input.new_source, input.newSource),
      delta: false,
    };
  }

  const toEdit = (e) => ({
    old: first(e.old_string, e.Target, e.target),
    next: first(e.new_string, e.Replacement, e.replacement),
    replaceAll: e.replace_all ?? Boolean(e.Target || e.target),
  });
  const edits =
    name === "multiedit" || name === "batch_edit" || "edits" in input
      ? (input.edits || []).map(toEdit)
      : [toEdit(input)];

  const existing = readExisting(relPath);
  const applied = existing === null ? null : applyEdits(existing, edits);

  if (applied === null) {
    // Fail-safe: file unreadable or edit target missing, so inspect the replacement text directly.
    return {
      old: "",
      next: edits.map((e) => String(e.next)).join("\n"),
      delta: false,
    };
  }
  return { old: existing, next: applied, delta: true };
}

// ==============================================================================
// Content rules (ESLint)
// ==============================================================================

let eslintInstance;

async function getEslint() {
  if (!eslintInstance) {
    const requireFromRoot = pathToFileURL(
      path.join(PROJECT_ROOT, "package.json"),
    ).href;
    const { createRequire } = await import("node:module");
    let resolved;
    try {
      resolved = createRequire(requireFromRoot).resolve("eslint");
    } catch {
      throw new Error(
        "eslint is not installed. Run `npm install` in the repository root.",
      );
    }
    const { ESLint } = await import(pathToFileURL(resolved).href);
    eslintInstance = new ESLint({ cwd: PROJECT_ROOT });
  }
  return eslintInstance;
}

const URL_SCOPE =
  /(?:^|\/)(?:tests|fixtures|pages|constants|env)\/.+\.ts$|(?:^|\/)playwright\.config\.ts$/i;

// Used only when the text cannot be parsed, so an unparsable edit cannot slip past the AST rules.
// Comment-blind on purpose: a false positive blocks the edit, a false negative would not.
const FALLBACK_SCAN = [
  {
    applies: TS_FILE,
    re: /\bwaitForTimeout\b|timers\/promises|\bnew\s+Promise\b[\s\S]{0,80}?\bsetTimeout\b/,
    message:
      "hard waits are forbidden (matched by the unparsable-text fallback).",
  },
  {
    applies: /\.spec\.ts$/i,
    re: /^\s*import\s+(?!type\b)[^;]*?from\s*['"]@playwright\/test['"]/m,
    message:
      "value imports from `@playwright/test` are forbidden in specs (matched by the unparsable-text fallback).",
  },
  {
    applies: /\.spec\.ts$/i,
    re: /\bnew\s+(?:[\w$]+\s*\.\s*)*(?:[A-Z][A-Za-z0-9_]*)?(?:Page|Component)\s*\(/,
    message:
      "manual page object instantiation is forbidden in specs (matched by the unparsable-text fallback).",
  },
  {
    applies: URL_SCOPE,
    re: /['"`]https?:\/\//i,
    message:
      "hardcoded http(s) URLs are forbidden here (matched by the unparsable-text fallback).",
  },
];

function fallbackMessages(relPath, code) {
  const lines = code.split(/\r?\n/);
  return FALLBACK_SCAN.filter(
    (r) => r.applies.test(relPath) && r.re.test(code),
  ).map((r) => {
    const hit = lines.findIndex((l) => r.re.test(l));
    return {
      key: `${r.message}|${(lines[hit] || "").trim()}`,
      text: r.message,
      line: hit + 1,
    };
  });
}

/** Lint `code` as `relPath`; fragments that do not parse are retried wrapped in a function body, then text-scanned. */
async function lintMessages(relPath, code) {
  if (!TS_FILE.test(relPath) || !code) return [];
  const eslint = await getEslint();

  const run = async (text) => {
    const [result] = await eslint.lintText(text, {
      filePath: path.join(PROJECT_ROOT, relPath),
    });
    return result?.messages ?? [];
  };

  let text = code;
  let messages = await run(text);
  if (messages.some((m) => m.fatal)) {
    text = `async function __fragment__() {\n${code}\n}`;
    messages = await run(text);
    if (messages.some((m) => m.fatal)) return fallbackMessages(relPath, code);
  }
  const lines = text.split(/\r?\n/);
  return messages
    .filter((m) => m.ruleId === "no-restricted-syntax")
    .map((m) => ({
      key: `${m.message}|${(lines[m.line - 1] || "").trim()}`,
      text: m.message,
      line: m.line,
    }));
}

function countKeys(messages) {
  const counts = new Map();
  for (const m of messages) counts.set(m.key, (counts.get(m.key) || 0) + 1);
  return counts;
}

/** Violations introduced by the change; for deltas, pre-existing ones elsewhere in the file are ignored. */
async function evaluate(relPath, old, next, delta) {
  const after = await lintMessages(relPath, next);
  if (!delta) return after.map((m) => m.text);

  const before = countKeys(await lintMessages(relPath, old));
  const seen = new Map();
  const introduced = [];
  for (const m of after) {
    const n = (seen.get(m.key) || 0) + 1;
    seen.set(m.key, n);
    if (n > (before.get(m.key) || 0)) introduced.push(m.text);
  }
  return introduced;
}

// ==============================================================================
// Hook
// ==============================================================================

const block = (header, bullets) => {
  console.error(
    `BLOCKED by Guardrail enforcement hook${header}:\n${bullets.map((b) => `  - ${b}`).join("\n")}`,
  );
  return 2;
};

const blockProtected = (relPath) =>
  block(` (${relPath})`, [
    "[protected-path] Governance, rule definitions and IDE infrastructure (.agent/, .claude/, .cursor/, .codex/, " +
      ".antigravitycli/, .playwright-cli/, .husky/, eslint.config.mjs, lint-staged.config.mjs) is protected from AI agent modifications. " +
      "Please request the repository human owner to apply changes to these files.",
  ]);

const unique = (arr) => [...new Set(arr)];

async function hook() {
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(0, "utf8"));
  } catch (err) {
    return block("", [
      `malformed JSON payload on stdin (${err.name}: ${err.message}).`,
    ]);
  }
  if (
    payload === null ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return block("", ["expected JSON object payload on stdin."]);
  }

  const toolName = String(payload.tool_name || "");
  const name = toolName.toLowerCase();
  const input =
    payload.tool_input && typeof payload.tool_input === "object"
      ? payload.tool_input
      : {};

  if (READ_ONLY_TOOLS.has(name)) return 0;

  const command = input.command || input.CommandLine || input.cmd || "";

  // Any tool carrying a command string is treated as a shell, so an unlisted shell
  // tool name cannot bypass the protected-path check.
  if (SHELL_TOOLS.has(name) || (!CONTENT_RULE_TOOLS.has(name) && command)) {
    if (shellCommandIsBlocked(command)) {
      return block(" (shell command)", [
        "[protected-path] Shell command appears to modify or delete protected governance/IDE " +
          "infrastructure (.agent/, .claude/, .cursor/, .codex/, .antigravitycli/, .playwright-cli/, .husky/, eslint.config.mjs, lint-staged.config.mjs).",
      ]);
    }
    return 0;
  }

  if (PATCH_TOOLS.has(name)) {
    const patch = first(input.patch, input.input, input.content);
    if (typeof patch !== "string" || !patch.trim()) return 0;

    const { touched, added } = parsePatch(patch);
    for (const raw of touched) {
      const rel = repoRel(raw);
      if (PROTECTED_PATH.test(rel)) return blockProtected(rel);
    }
    for (const [raw, lines] of added) {
      if (!lines.length) continue;
      const rel = repoRel(raw);
      const violations = await evaluate(rel, "", lines.join("\n"), false);
      if (violations.length) return block(` (${rel})`, unique(violations));
    }
    return 0;
  }

  const filePath = first(
    input.file_path,
    input.path,
    input.Path,
    input.filePath,
    input.notebook_path,
    input.notebookPath,
    input.target_file,
    input.TargetFile,
  );
  if (!filePath || typeof filePath !== "string") return 0;

  const rel = repoRel(filePath);
  if (PROTECTED_PATH.test(rel)) return blockProtected(rel);
  if (!CONTENT_RULE_TOOLS.has(name)) return 0;

  const { old, next, delta } = contentViews(toolName, input, rel);
  const violations = await evaluate(rel, old, next, delta);
  return violations.length ? block(` (${rel})`, unique(violations)) : 0;
}

let code;
try {
  code = await hook();
} catch (err) {
  console.error(
    "BLOCKED — Guardrail enforcement hook crashed (failing closed):\n" +
      `  ${err?.name}: ${err?.message}\n` +
      "  The tool call was blocked because guardrail enforcement could not complete. " +
      `  Running Node ${process.versions.node}; this repo needs Node >=22.22.1 (see "engines" in package.json). ` +
      "If `eslint` is missing, run `npm install`; otherwise fix the hook or contact the maintainers.",
  );
  code = 2;
}
process.exit(code);
