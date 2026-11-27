## reviews

## Verify against current docs

- When recommending a change, don't rely on memory for version-sensitive library or tool details (config options, APIs, flags, defaults). Check the official docs for the version in package.json / lockfile first. Never recommend deprecated or removed options.
- If you can't verify a recommendation, label it "unverified".
- Repo rules in `.agent/rules/` take precedence. If one conflicts with current docs, flag it instead of overriding it.
