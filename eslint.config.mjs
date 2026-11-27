import babelParser from "@babel/eslint-parser";

// typescript-eslint cannot load alongside typescript 7 (no importable compiler API),
// so TS syntax is parsed by Babel. These rules are syntax-only and need no type info.
//
// esquery regexes cannot contain `/` or escapes, hence `[/]` and explicit classes below.
const URL_RE = "/^https?:[/][/]/i";
const TIMERS_RE = "/^(node:)?timers[/]promises$/";
const POM_NAME_RE = "/^([A-Z][A-Za-z0-9_]*)?(Page|Component)$/";
const GOTO_CALL = "CallExpression[callee.property.name='goto']";

const HARD_WAIT_MESSAGE =
  "`waitForTimeout()`, `new Promise(... setTimeout ...)`, and `timers/promises` sleeps are forbidden. Use web-first assertions or event-based waits.";

const HARD_WAIT = [
  "CallExpression[callee.property.name='waitForTimeout']",
  "CallExpression[callee.computed=true][callee.property.value='waitForTimeout']",
  "NewExpression[callee.name='Promise'] CallExpression:matches([callee.name='setTimeout'], [callee.property.name='setTimeout'])",
  `ImportDeclaration[source.value=${TIMERS_RE}]`,
  `ImportExpression[source.value=${TIMERS_RE}]`,
  `CallExpression[callee.name='require'][arguments.0.value=${TIMERS_RE}]`,
].map((selector) => ({ selector, message: HARD_WAIT_MESSAGE }));

const SPEC_ONLY = [
  {
    // Inline `type` specifiers and `import type` stay allowed; `test`/`expect` must come from fixtures.
    selector: `ImportDeclaration[source.value='@playwright/test'][importKind!='type']:has(ImportDefaultSpecifier, ImportNamespaceSpecifier, ImportSpecifier[importKind!='type'])`,
    message:
      "Spec files must import `test` and `expect` from `@fixtures` (or fixtures), never value imports from `@playwright/test` (`import type` is permitted).",
  },
  ...[
    `NewExpression[callee.name=${POM_NAME_RE}]`,
    `NewExpression[callee.property.name=${POM_NAME_RE}]`,
  ].map((selector) => ({
    selector,
    message:
      "Direct page object instantiation (e.g., `new Page(page)` or `new LoginPage(page)`) is forbidden in test files. Inject page objects via fixtures instead.",
  })),
];

const GOTO_MESSAGE =
  "`page.goto()` with a hardcoded URL is forbidden. Use relative routes with baseURL or environment variables (e.g., `BASE_URL`).";
const URL_MESSAGE =
  "Hardcoded http(s) URLs are forbidden in tests, fixtures, pages, constants, and config. URLs must come from environment variables or configuration constants.";

const NOT_GOTO = `:not(${GOTO_CALL})`;
const URL_RULES = [
  {
    selector: `${GOTO_CALL} > Literal[value=${URL_RE}]`,
    message: GOTO_MESSAGE,
  },
  {
    selector: `${GOTO_CALL} > TemplateLiteral > TemplateElement[value.raw=${URL_RE}]`,
    message: GOTO_MESSAGE,
  },
  { selector: `${NOT_GOTO} > Literal[value=${URL_RE}]`, message: URL_MESSAGE },
  {
    selector: `${NOT_GOTO} > TemplateLiteral > TemplateElement[value.raw=${URL_RE}]`,
    message: URL_MESSAGE,
  },
];

// Flat config replaces (does not merge) `no-restricted-syntax` across matching blocks,
// so each block lists its full selector set and later blocks are the most specific.
const restrict = (...groups) => ({
  "no-restricted-syntax": ["error", ...groups.flat()],
});

const tsLanguageOptions = {
  parser: babelParser,
  parserOptions: {
    requireConfigFile: false,
    babelOptions: { parserOpts: { plugins: ["typescript", "decorators"] } },
  },
};

export default [
  {
    ignores: [
      "node_modules/",
      "playwright-report/",
      "test-results/",
      "blob-report/",
      "playwright/.cache/",
      ".husky/_/",
    ],
  },
  {
    files: ["**/*.ts"],
    languageOptions: tsLanguageOptions,
    rules: restrict(HARD_WAIT),
  },
  {
    files: [
      "**/{tests,fixtures,pages,constants,env}/**/*.ts",
      "**/playwright.config.ts",
    ],
    languageOptions: tsLanguageOptions,
    rules: restrict(HARD_WAIT, URL_RULES),
  },
  {
    files: ["**/tests/**/*.spec.ts"],
    languageOptions: tsLanguageOptions,
    rules: restrict(HARD_WAIT, URL_RULES, SPEC_ONLY),
  },
];
