# playwright-agent-kit

Agent-first Playwright POM framework. Fork this repo to start your own test automation project.

## Getting started

```bash
npm run setup
npm test
```

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
