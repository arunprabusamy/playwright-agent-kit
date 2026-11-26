#!/usr/bin/env python3
"""Deterministic guardrail enforcement for Playwright Agent Kit.

Enforces two categories of invariants:
- protected-path: Blocks agent mutations to agent governance, rules/hooks, and
  agent/CLI state (.agent/, .claude/, .cursor/, .cursorrules, .codex/,
  .antigravitycli/, .playwright-cli/).
- Architectural rules (RULES): Enforces fixture imports, bans hard waits,
  bans manual page/component instantiation in specs, and bans hardcoded URLs.

Operating Modes:
- PreToolUse Hook (default, stdin JSON): Evaluates file, patch, notebook, and
  shell tool calls; prints violations to stderr and exits 2 to block, or 0 to allow.
- Scan (`--scan file1 ...`): Scans files on disk, prints `<rule-id>\\t<rel_path>:<line>:<text>`,
  and exits 0 if clean or 1 if violations are found.

Fail-Closed Invariant:
Any malformed input or unhandled exception in hook mode exits with status 2 so
guardrails cannot be bypassed by runtime errors.
"""

import json
import os
import re
import sys
from collections import Counter


def _project_root() -> str:
    """Resolve the repository root, honoring hook-runner env vars before falling back
    to three levels above `.agent/hooks/guardrails.py`.
    """
    env_root = os.environ.get("CLAUDE_PROJECT_DIR") or os.environ.get("PROJECT_ROOT")
    if env_root and os.path.isdir(env_root):
        return os.path.realpath(env_root)

    script_dir = os.path.dirname(os.path.abspath(__file__))
    hooks_dir = script_dir
    agent_dir = os.path.dirname(hooks_dir)
    root_dir = os.path.dirname(agent_dir)
    return os.path.realpath(root_dir)


PROJECT_ROOT = _project_root()


def repo_rel(path: str) -> str:
    """Return a repository-relative path with forward slashes.

    Resolves symlinks and relative segments so traversal or platform separators
    cannot bypass path predicates.
    """
    root = os.path.realpath(PROJECT_ROOT)
    full = path if os.path.isabs(path) else os.path.join(root, path)
    rel = os.path.relpath(os.path.realpath(full), root)
    return rel.replace(os.sep, "/")


# ==============================================================================
# Path Scoping Regular Expressions
# ==============================================================================

# Scoped to *.spec.ts under tests/ so auth/setup files are not subject to spec-only rules.
SPEC_ONLY_FILE = re.compile(r"(^|/)tests/.+\.spec\.ts$", re.I)

TS_FILE = re.compile(r"\.ts$", re.I)

# Files where hardcoded URLs are forbidden (excludes non-test scripts/tooling).
URL_TARGET_FILES = re.compile(
    r"(^|/)(tests|fixtures|pages|constants|env)/.+\.ts$"
    r"|(^|/)playwright\.config\.ts$",
    re.I,
)

# Protected agent governance, rules/hooks, and agent/CLI state that agents must not modify.
# COUPLING INVARIANT: Keep protected entries in sync with SHELL_PROTECTED_TARGET.
PROTECTED_PATH = re.compile(
    r"(?:^|/)(?:"
    r"\.agent/"
    r"|\.claude/"
    r"|\.cursor/|\.cursorrules$"
    r"|\.codex/"
    r"|\.antigravitycli/"
    r"|\.playwright-cli/"
    r")",
    re.I,
)


# ==============================================================================
# Rule Pattern Regular Expressions
# ==============================================================================

# Rule: no-playwright-test-import
# Negative lookaheads allow `import type` and inline `import { type ... }` so type-only
# annotations from `@playwright/test` still work while `test`/`expect` come from fixtures.
PLAYWRIGHT_VALUE_IMPORT = re.compile(
    r"^\s*import\s+(?!type\b)"
    r"(?!\{(?:\s*type\s+[\w$]+(?:\s+as\s+[\w$]+)?\s*,?)+\s*\}\s*from)"
    r"(?:\{[^;}]*\}|[^;{\n])*?"
    r"from\s+['\"]@playwright/test['\"]",
    re.MULTILINE,
)

# Rule: no-hard-wait
# Prevents flaky arbitrary sleeps; web-first assertions or event-based waits must be used.
HARD_WAIT = re.compile(
    r"\bwaitForTimeout\s*\("
    r"|\[\s*['\"]waitForTimeout['\"]\s*\]"
    r"|\bnew\s+Promise\b[\s\S]{0,80}?\bsetTimeout\b"
    r"|from\s*['\"](?:node:)?timers/promises['\"]"
    r"|\brequire\(\s*['\"](?:node:)?timers/promises['\"]"
)

# Rule: no-manual-instantiation
# Enforces fixture-based dependency injection instead of `new Page(...)` / `new LoginPage(...)`.
MANUAL_INSTANTIATION = re.compile(
    r"new\s+(?:[\w$]+\s*\.\s*)*(?:[A-Z][A-Za-z0-9_]*)?(?:Page|Component)\s*\("
)

# Rule: no-hardcoded-goto-url
# Navigation must use baseURL + relative routes or env vars so tests stay environment-agnostic.
HARDCODED_GOTO_URL = re.compile(
    r"""\.goto\s*\(\s*['"`]https?://""",
    re.I,
)

# Rule: no-hardcoded-url
# URLs must come from environment variables or constants rather than inline literals.
HARDCODED_URL = re.compile(
    r"""['"`]https?://""",
    re.I,
)


def check_hardcoded_url(content: str) -> bool:
    """Check for hardcoded URLs outside `.goto()` calls.

    Strips `.goto()` matches first so `no-hardcoded-goto-url` and `no-hardcoded-url`
    do not double-report the same line.
    """
    content_without_goto = HARDCODED_GOTO_URL.sub("", content)
    return bool(HARDCODED_URL.search(content_without_goto))


# ==============================================================================
# Curated Guardrail Rules
# ==============================================================================
# Tuple contract for adding/updating rules:
#   (rule_id, path_predicate, content_predicate, error_message)
# - path_predicate(rel_path) -> truthy if the rule applies to the repo-relative path.
# - content_predicate(stripped_content) -> truthy if comment-stripped source violates the rule.
RULES = [
    (
        "no-playwright-test-import",
        lambda p: SPEC_ONLY_FILE.search(p),
        lambda c: PLAYWRIGHT_VALUE_IMPORT.search(c),
        "Spec files must import `test` and `expect` from `@fixtures` (or fixtures), "
        "never value imports from `@playwright/test` (`import type` is permitted).",
    ),
    (
        "no-hard-wait",
        lambda p: TS_FILE.search(p),
        lambda c: HARD_WAIT.search(c),
        "`waitForTimeout()`, `new Promise(... setTimeout ...)`, and `timers/promises` "
        "sleeps are forbidden. Use web-first assertions or event-based waits.",
    ),
    (
        "no-manual-instantiation",
        lambda p: SPEC_ONLY_FILE.search(p),
        lambda c: MANUAL_INSTANTIATION.search(c),
        "Direct page object instantiation (e.g., `new Page(page)` or `new LoginPage(page)`) is forbidden in test files. "
        "Inject page objects via fixtures instead.",
    ),
    (
        "no-hardcoded-goto-url",
        lambda p: URL_TARGET_FILES.search(p),
        lambda c: HARDCODED_GOTO_URL.search(c),
        "`page.goto()` with a hardcoded URL is forbidden. Use relative routes with baseURL "
        "or environment variables (e.g., `BASE_URL`).",
    ),
    (
        "no-hardcoded-url",
        lambda p: URL_TARGET_FILES.search(p),
        check_hardcoded_url,
        "Hardcoded http(s) URLs are forbidden in tests, fixtures, pages, constants, and config. "
        "URLs must come from environment variables or configuration constants.",
    ),
]


# ==============================================================================
# Comment Stripping & Content Analysis
# ==============================================================================

# Keywords after which a `/` begins a regular expression literal rather than division.
REGEX_PREFIX_KEYWORDS = frozenset({
    "return",
    "throw",
    "case",
    "yield",
    "await",
    "typeof",
    "void",
    "delete",
    "in",
    "instanceof",
    "of",
    "else",
    "do",
})


def strip_comments(content: str) -> str:
    """Blank out `//` and `/* */` comments with spaces/newlines.

    Replaces comment text with spaces/newlines rather than deleting it so line numbers
    and character offsets stay intact for `--scan` reporting. Tracks string and regex
    literals so `//` or `/*` inside URLs or regex patterns are not treated as comments.
    """
    out = []
    i, n = 0, len(content)
    quote = None
    last = ""
    current_word = ""
    last_word = ""

    while i < n:
        ch = content[i]

        if quote:
            out.append(ch)
            if ch == "\\" and i + 1 < n:
                out.append(content[i + 1])
                i += 2
                continue
            if ch == quote or (ch == "\n" and quote != "`"):
                quote = None
            if not ch.isspace():
                last = ch
            current_word = ""
            last_word = ""
            i += 1
            continue

        if ch in ("'", '"', "`"):
            quote = ch
            out.append(ch)
            last = ch
            current_word = ""
            last_word = ""
            i += 1
            continue

        if content.startswith("//", i):
            if current_word:
                last_word = current_word
                current_word = ""
            j = content.find("\n", i)
            j = n if j == -1 else j
            out.append(" " * (j - i))
            i = j
            continue

        if content.startswith("/*", i):
            if current_word:
                last_word = current_word
                current_word = ""
            j = content.find("*/", i + 2)
            j = n if j == -1 else j + 2
            out.append("".join("\n" if c == "\n" else " " for c in content[i:j]))
            i = j
            continue

        # Treat `/` as a regex literal only after operators, delimiters, line starts,
        # or prefix keywords so division expressions are not misparsed as regexes.
        prev_word = current_word or last_word
        if ch == "/" and (
            last == ""
            or last in "(,=:[!&|?{};+-*%<>~^"
            or prev_word in REGEX_PREFIX_KEYWORDS
        ):
            j, in_class = i + 1, False
            while j < n and content[j] != "\n":
                c = content[j]
                if c == "\\":
                    j += 2
                    continue
                if in_class:
                    in_class = (c != "]")
                elif c == "[":
                    in_class = True
                elif c == "/":
                    break
                j += 1
            if j < n and content[j] == "/":
                out.append(content[i : j + 1])
                last = "/"
                current_word = ""
                last_word = ""
                i = j + 1
                continue

        out.append(ch)
        if ch.isalnum() or ch in "_$":
            current_word += ch
            last = ch
        elif ch.isspace():
            if current_word:
                last_word = current_word
                current_word = ""
        else:
            current_word = ""
            last_word = ""
            last = ch
        i += 1

    return "".join(out)


def read_existing(rel_path: str) -> "str | None":
    """Read an existing repo-relative file from disk, or return None if unreadable."""
    full = os.path.join(os.path.realpath(PROJECT_ROOT), rel_path)
    try:
        with open(full, encoding="utf-8", errors="replace") as fh:
            return fh.read()
    except OSError:
        return None


def apply_edits(text: str, edits: "list[dict]") -> "str | None":
    """Apply edits in-memory; returns None if any target `old_string` is missing or invalid."""
    for edit in edits:
        old = edit.get("old_string", "")
        new = edit.get("new_string", "")
        replace_all = edit.get("replace_all", False)

        if not isinstance(old, str) or not isinstance(new, str):
            return None
        if old == "" or old not in text:
            return None

        if replace_all:
            text = text.replace(old, new)
        else:
            text = text.replace(old, new, 1)

    return text


def content_views(tool_name: str, tool_input: dict, rel_path: str):
    """Return `(old_content, new_content, is_delta)` for a file-editing tool call.

    Full-file writes return `is_delta=False` to check the whole file. Targeted edits
    apply in-memory against disk (`is_delta=True`) so pre-existing violations elsewhere
    in the file do not block unrelated edits; if the file is unreadable or an edit target
    misses, it fails safe by inspecting the replacement text directly (`is_delta=False`).
    """
    name_lower = tool_name.lower()

    if name_lower in ("write", "write_file"):
        content = tool_input.get("content") or tool_input.get("Content") or ""
        return "", content, False

    if name_lower in ("notebookedit", "notebook_edit"):
        content = tool_input.get("new_source") or tool_input.get("newSource") or ""
        return "", content, False

    edits = []
    if name_lower in ("multiedit", "batch_edit") or "edits" in tool_input:
        raw_edits = tool_input.get("edits", []) or []
        for e in raw_edits:
            old = e.get("old_string") or e.get("Target") or e.get("target") or ""
            new = e.get("new_string") or e.get("Replacement") or e.get("replacement") or ""
            rep_all = e.get("replace_all", bool(e.get("Target") or e.get("target")))
            edits.append({"old_string": old, "new_string": new, "replace_all": rep_all})
    else:
        old = tool_input.get("old_string") or tool_input.get("Target") or tool_input.get("target") or ""
        new = tool_input.get("new_string") or tool_input.get("Replacement") or tool_input.get("replacement") or ""
        rep_all = tool_input.get("replace_all", bool(tool_input.get("Target") or tool_input.get("target")))
        edits.append({"old_string": old, "new_string": new, "replace_all": rep_all})

    existing = read_existing(rel_path)
    applied = apply_edits(existing, edits) if existing is not None else None

    if applied is None:
        # Fail-safe fallback when the file cannot be read or patched in memory.
        fallback_content = "\n".join(str(e.get("new_string", "")) for e in edits)
        return "", fallback_content, False

    return existing, applied, True


def matched_lines(content_match, content: str):
    """Return `(Counter(matching_stripped_lines), bool(full_content_match))`."""
    lines = [line.strip() for line in content.splitlines() if content_match(line)]
    return Counter(lines), bool(content_match(content))


def rule_fires(content_match, old: str, new: str, delta: bool) -> bool:
    """Return True if the proposed change introduces a rule violation.

    For targeted edits (`delta=True`), compares `Counter` line multisets and full-file
    multiline matches between `old` and `new` so pre-existing violations do not block
    unrelated edits.
    """
    new_view = strip_comments(new)
    if not delta:
        return bool(content_match(new_view))

    old_view = strip_comments(old)
    new_lines, new_whole = matched_lines(content_match, new_view)
    old_lines, old_whole = matched_lines(content_match, old_view)

    return bool(new_lines - old_lines) or (new_whole and not old_whole)


# ==============================================================================
# Execution Modes: Scan & PreToolUse Hook
# ==============================================================================

def scan(paths: "list[str]") -> int:
    """Scan files on disk, printing `<rule-id>\\t<rel_path>:<line>:<text>`, and return 1 if any fail."""
    found = False
    for path in paths:
        path = os.path.abspath(path)
        rel_path = repo_rel(path)

        if not os.path.isfile(path):
            continue

        try:
            with open(path, encoding="utf-8", errors="replace") as fh:
                content = fh.read()
        except OSError:
            continue

        original_lines = content.splitlines()
        stripped = strip_comments(content)

        for rule_id, path_match, content_match, _message in RULES:
            if not path_match(rel_path):
                continue

            if not content_match(stripped):
                continue

            hit_lines = [
                (i, original_lines[i - 1].strip())
                for i, line in enumerate(stripped.splitlines(), 1)
                if content_match(line)
            ]

            if not hit_lines:
                # Fallback when a violation spans multiple lines and matches no single line.
                m = content_match(stripped)
                lineno = stripped[: m.start()].count("\n") + 1 if hasattr(m, "start") else 1
                hit_lines = [(lineno, "(multiline match)")]

            for lineno, text in hit_lines:
                print(f"{rule_id}\t{rel_path}:{lineno}:{text}")
                found = True

    return 1 if found else 0


# ==============================================================================
# Patch, Shell, and Tool Coverage Helpers
# ==============================================================================

# Exempt from path/content checks because they cannot mutate files.
READ_ONLY_TOOLS = frozenset({
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
})

CONTENT_RULE_TOOLS = frozenset({
    "write",
    "edit",
    "multiedit",
    "write_file",
    "edit_file",
    "batch_edit",
    "notebookedit",
    "notebook_edit",
})

PATCH_TOOLS = frozenset({"apply_patch", "patch_file"})

SHELL_TOOLS = frozenset({"bash", "shell", "run_command", "execute_command", "terminal"})

# Matches protected agent governance, rules/hooks, and agent/CLI state inside shell commands.
# COUPLING INVARIANT: Keep protected entries in sync with PROTECTED_PATH.
SHELL_PROTECTED_TARGET = re.compile(
    r"(?:^|[\s\"'`=;:,/\\])"
    r"(?:\.(?:agent|claude|cursor|codex|antigravitycli|playwright-cli)(?:[/\\]|$|[\s\"'`;|&>])"
    r"|\.cursorrules(?:$|[\s\"'`;|&>]))",
    re.I,
)

# Matches shell redirections, file-mutation commands, or inline scripting interpreters
# that can modify, delete, move, or overwrite protected files.
# Uses negative lookbehind `(?<!\.)` on command/interpreter names so filenames like `.py`
# in read-only commands (e.g., `cat .agent/hooks/guardrails.py`) are not misclassified.
SHELL_MUTATION_OP = re.compile(
    r"(?:>>?|\b(?:1>|2>|&>))"
    r"|\|\s*tee\b"
    r"|(?<!\.)\b(?:rm|rmdir|unlink|mv|cp|mkdir|touch|chmod|chown|ln|truncate|install|dd|patch"
    r"|del|erase|ren|rename|move|copy|xcopy|robocopy)\b"
    r"|(?<!\.)\bgit\s+(?:checkout|restore|reset|clean|rm|mv|apply)\b"
    r"|(?<!\.)\bsed\b[^\n;]*\s-[^\s]*i"
    r"|(?<!\.)\bawk\b[^\n;]*-i\s+inplace"
    r"|(?<!\.)\bperl\b[^\n;]*\s-[^\s]*i"
    r"|(?<!\.)\b(?:Out-File|Set-Content|Add-Content|New-Item|Remove-Item|Move-Item|Copy-Item|Rename-Item|Clear-Content)\b"
    r"|(?<!\.)\b(?:python|python3|py|node|ruby|pwsh|powershell)\b",
    re.I,
)


def parse_patch(patch_text: str) -> "tuple[list[str], dict[str, list[str]]]":
    """Extract unique touched paths and added lines per file from `apply_patch` or unified diffs."""
    touched_files: "list[str]" = []
    added_by_file: "dict[str, list[str]]" = {}
    current_file = ""

    def _record_file(path: str) -> None:
        if path and path not in added_by_file:
            touched_files.append(path)
            added_by_file[path] = []

    for line in patch_text.splitlines():
        for prefix in ("*** Update File:", "*** Add File:", "*** Delete File:", "*** Move to:"):
            if line.startswith(prefix):
                target = line[len(prefix) :].strip()
                if target:
                    _record_file(target)
                    current_file = target
                break
        else:
            if line.startswith("--- "):
                raw = line[4:].strip().split("\t")[0]
                if raw != "/dev/null":
                    if raw.startswith("a/"):
                        raw = raw[2:]
                    _record_file(raw)
                    current_file = raw
            elif line.startswith("+++ "):
                raw = line[4:].strip().split("\t")[0]
                if raw != "/dev/null":
                    if raw.startswith("b/"):
                        raw = raw[2:]
                    _record_file(raw)
                    current_file = raw
            elif line.startswith("+") and current_file:
                added_by_file[current_file].append(line[1:])

    return touched_files, added_by_file


def _block_protected_path(rel_path: str) -> int:
    """Print a protected-path block message to stderr and return exit code 2."""
    print(
        f"BLOCKED by Guardrail enforcement hook ({rel_path}):\n"
        "  - [protected-path] Governance and IDE infrastructure (.agent/, .claude/, "
        ".cursor/, .codex/, .antigravitycli/, .playwright-cli/) is protected from AI agent modifications. "
        "Please request the repository human owner to apply changes to these files.",
        file=sys.stderr,
    )
    return 2


def _evaluate_rules(rel_path: str, old: str, new: str, delta: bool) -> "list[str]":
    """Evaluate all curated guardrail RULES against a target path and content change."""
    violations = []
    for rule_id, path_match, content_match, message in RULES:
        if not path_match(rel_path):
            continue
        if rule_fires(content_match, old, new, delta):
            violations.append(f"[{rule_id}] {message}")
    return violations


def hook() -> int:
    """Evaluate a PreToolUse stdin JSON payload; return 0 to allow or 2 to block."""
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError) as exc:
        # Fail closed: malformed stdin must never silently bypass guardrails.
        print(
            "BLOCKED by Guardrail enforcement hook: malformed JSON payload on stdin "
            f"({type(exc).__name__}: {exc}).",
            file=sys.stderr,
        )
        return 2

    if not isinstance(payload, dict):
        # Fail closed: non-object JSON payload cannot be safely inspected.
        print(
            "BLOCKED by Guardrail enforcement hook: expected JSON object payload on stdin, "
            f"got {type(payload).__name__}.",
            file=sys.stderr,
        )
        return 2

    tool_name = str(payload.get("tool_name") or "")
    name_lower = tool_name.lower()
    raw_input = payload.get("tool_input")
    tool_input = raw_input if isinstance(raw_input, dict) else {}

    if name_lower in READ_ONLY_TOOLS:
        return 0

    if name_lower in SHELL_TOOLS:
        command = (
            tool_input.get("command")
            or tool_input.get("CommandLine")
            or tool_input.get("cmd")
            or ""
        )
        if isinstance(command, str) and SHELL_PROTECTED_TARGET.search(command) and SHELL_MUTATION_OP.search(command):
            print(
                "BLOCKED by Guardrail enforcement hook (shell command):\n"
                "  - [protected-path] Shell command appears to modify or delete protected "
                "governance/IDE infrastructure (.agent/, .claude/, .cursor/, .codex/, "
                ".antigravitycli/, .playwright-cli/).",
                file=sys.stderr,
            )
            return 2
        return 0

    if name_lower in PATCH_TOOLS:
        patch_text = (
            tool_input.get("patch")
            or tool_input.get("input")
            or tool_input.get("content")
            or ""
        )
        if not isinstance(patch_text, str) or not patch_text.strip():
            return 0

        touched_files, added_by_file = parse_patch(patch_text)

        for raw_path in touched_files:
            rel_path = repo_rel(raw_path)
            if PROTECTED_PATH.search(rel_path):
                return _block_protected_path(rel_path)

        for raw_path, added_lines in added_by_file.items():
            if not added_lines:
                continue
            rel_path = repo_rel(raw_path)
            added_content = "\n".join(added_lines)
            violations = _evaluate_rules(rel_path, "", added_content, delta=False)
            if violations:
                print(
                    f"BLOCKED by Guardrail enforcement hook ({rel_path}):\n"
                    + "\n".join(f"  - {v}" for v in violations),
                    file=sys.stderr,
                )
                return 2

        return 0

    file_path = (
        tool_input.get("file_path")
        or tool_input.get("path")
        or tool_input.get("Path")
        or tool_input.get("filePath")
        or tool_input.get("notebook_path")
        or tool_input.get("notebookPath")
        or tool_input.get("target_file")
        or tool_input.get("TargetFile")
        or ""
    )

    if not file_path or not isinstance(file_path, str):
        return 0

    rel_path = repo_rel(file_path)

    if PROTECTED_PATH.search(rel_path):
        return _block_protected_path(rel_path)

    if name_lower not in CONTENT_RULE_TOOLS:
        return 0

    old, new, delta = content_views(tool_name, tool_input, rel_path)
    violations = _evaluate_rules(rel_path, old, new, delta)

    if violations:
        print(
            f"BLOCKED by Guardrail enforcement hook ({rel_path}):\n"
            + "\n".join(f"  - {v}" for v in violations),
            file=sys.stderr,
        )
        return 2

    return 0


def main() -> int:
    """CLI entry point; routes `--scan` to scan mode and otherwise runs hook mode."""
    if len(sys.argv) > 1 and sys.argv[1] == "--scan":
        return scan(sys.argv[2:])
    return hook()


if __name__ == "__main__":
    # Fail closed: unexpected exceptions exit 2 so guardrails are never bypassed.
    try:
        code = main()
    except Exception as exc:
        import traceback

        print(
            "BLOCKED — Guardrail enforcement hook crashed (failing closed):\n"
            f"  {type(exc).__name__}: {exc}\n"
            "  The tool call was blocked because guardrail enforcement could not complete. "
            "Please fix the hook or contact repository maintainers.",
            file=sys.stderr,
        )
        traceback.print_exc()
        code = 2

    sys.exit(code)
