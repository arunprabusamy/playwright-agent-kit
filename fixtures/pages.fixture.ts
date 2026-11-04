import { test as base, Page } from "@playwright/test";

type PageFixtures = {
  homePage: Page;
};

export const test = base.extend<PageFixtures>({
  homePage: async ({ page }, use) => {
    await page.goto("/");
    await use(page);
  }
});

export { expect } from "@playwright/test";
