# playwright-agent-kit

Agent-first Playwright POM framework. Fork this repo to start your own test automation project.

## Getting started

Requires Node.js 22.22.1 or newer.

```bash
npm run setup
npm test
```

Run `npm run lint` to check the guardrail rules (fixture imports, no hard waits, no manual page instantiation, no hardcoded URLs). The same rules run on commit and in the Claude Code hook (`.agent/hooks/guardrails.mjs`), which only needs Node. See [.agent/hooks/README.md](./.agent/hooks/README.md) for how to turn individual checks off.

## Structure

- `pages/` — Page Object Model classes
- `tests/` — Playwright test specs and auth setup
- `fixtures/` — Custom Playwright test fixtures (`pages`, `api`)
- `constants/` — Shared constants
- `env/` — Environment configuration files (e.g., `.env.dev`)
- `.agent/` — Agent rules and guardrail hooks
- `AGENTS.md` — Agent instructions and rule index
- `playwright.config.ts` — Playwright configuration

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) if you'd like to share a new skill or feature back.

## License

MIT
