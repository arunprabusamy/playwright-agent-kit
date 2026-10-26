import { test, expect } from "../fixtures/pages.fixture";

test("Forms page sample test", async ({ formsPage }) => {
  await expect(formsPage.getByTestId("page-title")).toHaveText("Forms");
});

test("Table page sample test", async ({ tablePage }) => {
  await expect(tablePage.getByTestId("page-title")).toHaveText("Table");
});
