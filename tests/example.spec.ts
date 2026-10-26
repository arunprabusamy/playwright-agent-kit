import { test, expect } from "../fixtures/pages.fixture";

test("Sample Test", async ({ formsPage }) => {
  await expect(formsPage.getByTestId("page-title")).toHaveText("Forms");
});
