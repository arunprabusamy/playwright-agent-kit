# Framework Implementation Order — What to Build, Why, and Blog Sources

Notes from a deep-dive session. Captured so we don't have to re-derive this from
scratch next time. This is the full ordered build sequence for reimplementing
this repo's architecture elsewhere, step by step, with the blog/source found
for each step (or honestly noted as unfound/internal-only).

Companion file: `enforcement-layers-blog-sources.md` has the deeper writeup on
steps 8-10 below.

---

#: 1
Concept: Env/config setup
Why this order: Everything else reads URLs/creds from here
This repo's file: config/app.ts, env/.env.\*, playwright.config.ts dotenv load
Blog source: idavidov.eu "setup-environment-variables" article — https://idavidov.eu/building-playwright-framework-step-by-step-setup-environment-variables

#: 2
Concept: Auth session (login once -> storageState)
Why this order: Fixtures/tests need a valid session before anything UI-related works
This repo's file: tests/app/auth.setup.ts + helpers/app/createStorageState.ts, wired via dependencies: ['setup'] in playwright.config.ts
Blog source: idavidov.eu "Auth User Session" section — https://idavidov.eu/building-playwright-framework-step-by-step-implementing-pom-as-fixture-and-auth-user-session. Independently documented in near-identical form by Artem Bondar — https://bondaracademy.com/blog/playwright-storage-state-authentication

#: 3
Concept: Plain Page Object classes (no fixture yet)
Why this order: Fixtures just wrap POM classes -- the classes must exist first
This repo's file: pages/app/app.page.ts, pages/components/navigation.component.ts
Blog source: no direct blog found from the 4 credited people (Stefan Judis, Murat Ozcan, Filip Hric, Artem Bondar) specifically on POM class structure. Closest generic reference: Filip Hric's login-page example — https://filiphric.com/how-to-do-authentication-in-playwright (uses a plain LoginPage class, not a fixture)

#: 4
Concept: POM-as-Fixture (DI wrapper)
Why this order: Turns step 3's classes into injectable fixtures instead of `new Page(page)`
This repo's file: fixtures/pom/page-object-fixture.ts
Blog source: idavidov.eu main article (the one originally linked) — https://idavidov.eu/building-playwright-framework-step-by-step-implementing-pom-as-fixture-and-auth-user-session. Pattern itself credited by the author to Murat Ozcan

#: 5
Concept: Unified test entry point (mergeTests)
Why this order: Needs step 4's fixture plus any other fixture categories to merge
This repo's file: fixtures/pom/test-options.ts
Blog source: same idavidov.eu article as step 4, same Murat Ozcan credit

#: 6
Concept: API request fixture
Why this order: Independent of UI POM but also merged in step 5; needs the access token produced in step 2
This repo's file: fixtures/api/api-request-fixture.ts, fixtures/api/plain-function.ts
Blog source: not covered in the linked blog -- this repo's own extension, documented only in-repo (.claude/skills/api-testing/SKILL.md, .claude/skills/fixtures/SKILL.md)

#: 7
Concept: Helper fixtures (setup/teardown for 3+ reused flows)
Why this order: Built last since it's the "only if reused 3+ times" escape hatch; needs the API fixture from step 6
This repo's file: fixtures/helper/helper-fixture.ts
Blog source: not blog-documented -- internal convention only, see .claude/skills/fixtures/SKILL.md

#: 8
Concept: Agent guardrail hook (PreToolUse, regex-block, exit code 2)
Why this order: Added once the core architecture and conventions above exist, so there's something concrete to hard-block violations of at write time
This repo's file: .claude/scripts/enforce_constitution.py + .claude/settings.json
Blog source: no idavidov.eu article -- he only covers CLAUDE.md prompt-level guidance (ask-the-model), not a hard mechanical block. Generic Claude Code hooks pattern documented at https://blog.boucle.sh/posts/what-claude-code-hooks-can-and-cannot-enforce/ (flags that a model can route around a single blocked tool unless the whole tool family is matched -- this repo's hook already matches Write|Edit|MultiEdit correctly). Novel specifically applied to a Playwright constitution; not novel as a general Claude Code hooks pattern

#: 9
Concept: Git pre-commit hook (husky + lint-staged)
Why this order: Catches anything committed outside the AI agent -- human edits, other tools, bypassing step 8 entirely
This repo's file: .husky/, package.json -> lint-staged (eslint --fix + prettier --write on staged files)
Blog source: idavidov.eu has a dedicated article -- "Prevent Broken Code: ESLint & Husky Guide" https://idavidov.eu/never-commit-broken-code-again-a-guide-to-eslint-and-husky-in-playwright. Also a very standard, widely-documented practice industry-wide (builtin.com, betterstack.com, lint-staged's own docs)

#: 10
Concept: CI quality gate (tsc --noEmit, eslint, prettier --check, kept as a job separate from the test run)
Why this order: Last line of defense -- catches anything that slips past steps 8 and 9 (e.g. GitHub web UI edits, Dependabot bumps)
This repo's file: .github/workflows/lint.yml, .github/workflows/playwright.yml
Blog source: idavidov.eu touches CI as a general quality-gate concept -- https://idavidov.eu/mastering-in-sprint-quality-for-faster-releases-ci-code-reviews-and-collaboration -- but not this specific job-separation recipe. Standard practice in the broader GitHub Actions + Playwright community, no single canonical source

---

## Overall provenance verdict

Steps 1, 2, 4, 5, 9 have a direct idavidov.eu article to read. Step 10 is
touched conceptually but not in this exact shape. Steps 3, 6, 7, 8 have no
blog from the credited four (Stefan Judis, Murat Ozcan, Filip Hric, Artem
Bondar) and must be built from this repo's own code + `.claude/skills/*`
reasoning, or from generic/non-Playwright-specific sources where noted above.

The `mergeTests()` fixture-merge pattern (steps 4-5) is credited by the blog
author to **Murat Ozcan**. The storage-state auth pattern (step 2) is
independently documented almost identically by **Artem Bondar**. Filip Hric
documents a different, non-fixture auth approach. Nothing specific to this
exact architecture was found from Stefan Judis.
