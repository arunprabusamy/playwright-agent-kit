## page-objects

### Navigation methods must confirm the page loaded

- In page-object classes under `pages/`, every method that navigates to a page (e.g. `goto()`, `open()`, or a click that leads to another page) must verify that the destination loaded before the method completes.
- Use a page-specific, stable signal for this check, such as the page heading, a URL assertion, or a key element that is visible only on that page.
- This is a page-ready check only. It confirms we are on the right page and nothing more.

### What page objects must NOT assert

- Page objects must not contain test-specific or business assertions, such as expected text, data values, counts, validation messages, or the success or failure of an action. Those belong in the test case (see test-cases.md).

### Locator naming

- Name every locator `[what the user sees]` + `[element type]` in camelCase (e.g. `submitButton`, `emailInput`, `forgotPasswordLink`).
- Use these suffixes: `Button`, `Input`, `Link`, `Dropdown`, `Checkbox`, `Radio`, `Heading`, `Image`, `Icon`, `Alert`, `Modal`. For any other element, use its closest element type (e.g. `ordersTable`, `profileTab`).
- Use a plural name for locators that match multiple elements (e.g. `productCards`, `userRows`).

| Do                    | Don't                                |
| --------------------- | ------------------------------------ |
| `submitButton`        | `btnSubmit`, `submitBtnXpath`        |
| `emailInput`          | `txtEmail`, `emailCssSelector`       |
| `forgotPasswordLink`  | `link1`, `aTag`                      |
| `welcomeHeading`      | `h1Element`                          |
| `productCards` (many) | `productCard` (when it matches many) |
| `login()` (method)    | `clickLoginButton()`                 |
