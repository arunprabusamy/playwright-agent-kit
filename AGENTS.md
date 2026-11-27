# Agents.md

## Rules

Before making changes, read the rule files that match your task. Do not rely on memory of the rules; open the file.

| When you are...                                               | Read first                     |
| ------------------------------------------------------------- | ------------------------------ |
| Creating or modifying a page object (anything under `pages/`) | `.agent/rules/page-objects.md` |
| Creating or modifying a test case (anything under `tests/`)   | `.agent/rules/test-cases.md`   |

If a task touches both (for example, a new test that needs a new page object), read both files.

If two rules appear to conflict, `page-objects.md` governs page-object code and `test-cases.md` governs test code. Ask the user instead of guessing.

## Guardrails

Automated checks (ESLint rules, a pre-commit gate and a Claude Code hook) enforce the rules above. Never turn them off to get your work past them; read `.agent/hooks/README.md` for what they cover and when disabling one is allowed.

## Code comments

- Match the comment style and density of the surrounding code.
- Add a comment when the WHY is not obvious: a workaround, a hidden constraint,
  or something that looks wrong but is intentional.
- Don't comment what the code already says. Don't guess reasons.
- Prefer a clearer name or test.step() over a comment.
- Fix or delete comments that are wrong or outdated.
- No commented-out code.
