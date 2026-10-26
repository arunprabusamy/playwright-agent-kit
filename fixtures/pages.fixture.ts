import { test as base, Page } from "@playwright/test";

type pageFixtures = {
  formsPage: Page;
  tablePage: Page;
};

export const test = base.extend<pageFixtures>({
  formsPage: async ({ page }, use) => {
    await page.goto("http://localhost:3000/forms");
    use(page);
  }
});

export { expect } from "@playwright/test";
