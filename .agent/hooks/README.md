# Guardrails

Automated checks that keep the code and the agent's own rules intact. They run in three places:

| Layer            | What it does                                                        | Where it is defined                                    |
| ---------------- | ------------------------------------------------------------------- | ------------------------------------------------------ |
| ESLint rules     | The 5 code rules, shown in the editor and by `npm run lint`         | `eslint.config.mjs`                                    |
| Pre-commit gate  | Runs ESLint on staged `.ts` files; a violation fails the commit     | `lint-staged.config.mjs`, `.husky/`                    |
| Claude Code hook | Blocks an agent edit that breaks a rule, or touches protected files | `.agent/hooks/guardrails.mjs`, `.claude/settings.json` |

## The rules

1. Specs import `test`/`expect` from fixtures, never value imports from `@playwright/test` (`import type` is fine).
2. No hard waits (`waitForTimeout`, `new Promise` + `setTimeout`, `timers/promises`).
3. No `new SomethingPage()` / `new SomethingComponent()` in specs; use fixtures.
4. No hardcoded `http(s)://` URLs in `tests`, `fixtures`, `pages`, `constants`, `env` or `playwright.config.ts`.
5. Comments never trigger a rule.

The hook also protects `.agent/`, `.claude/`, `.cursor/`, `.codex/`, `.antigravitycli/`, `.playwright-cli/`,
`.husky/`, `eslint.config.mjs` and `lint-staged.config.mjs` from edits by an agent.

## Turning checks off (for people)

Pick the smallest option that does the job.

**One line or one file** (ESLint rules, and therefore the hook too):

```ts
// eslint-disable-next-line no-restricted-syntax
await page.waitForTimeout(500);
```

```ts
/* eslint-disable no-restricted-syntax */ // at the top of a file
```

**One rule, for the whole repo:** in `eslint.config.mjs`, remove that rule's group. For example, drop `URL_RULES`
from the `restrict(...)` calls to allow hardcoded URLs, or drop `HARD_WAIT` to allow hard waits.

**All content rules:** delete the `files` blocks in `eslint.config.mjs`, or set `'no-restricted-syntax': 'off'` in them.
This also turns them off in the editor, `npm run lint`, pre-commit and the hook.

**The Claude Code hook only:** in `.claude/settings.json`, remove the `PreToolUse` block.
This turns off both the content rules and the protected-path guard for the agent.
To keep the protected paths and drop only the content rules, remove the "Content rules (ESLint)" section
from `.agent/hooks/guardrails.mjs`.

**The pre-commit gate only:**

- One commit: `git commit --no-verify`
- Permanently: remove `"eslint"` from the `*.ts` entry in `lint-staged.config.mjs`,
  or delete `.husky/pre-commit`.

Needs Node 22.22.1 or newer. If the hook crashes on an older Node it blocks every `.ts` edit, and its message says so.

## For agents

- Do not turn a guardrail off to get your work past it. If a check blocks you, fix the code, or tell the user which
  rule blocked you and why.
- Disable comments (`eslint-disable`), edits to the rule config, `lint-staged`, `.husky/` and the hook settings are
  allowed only when the user explicitly asks for that specific check to be turned off. Say exactly what you changed.
- `.agent/`, `.claude/`, `.husky/`, `eslint.config.mjs` and `lint-staged.config.mjs` are protected. If the hook blocks an edit there, do not
  work around it (no shell redirects, scripts or aliases). Give the user the exact change to apply by hand.
