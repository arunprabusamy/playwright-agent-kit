## test-cases

## Verification in test cases

- A test case must perform its own test-specific verification inside the test itself. Use page objects for navigation and actions, but put the assertions that define what the test is checking (data, messages, state, outcomes) in the test body.
- Do not rely on a page object to verify the outcome of the test.
- Do not repeat the page-ready checks that page objects already perform on navigation (heading or URL checks). A test should assert on the page only when that assertion is part of what the test is verifying, not as a load check.
