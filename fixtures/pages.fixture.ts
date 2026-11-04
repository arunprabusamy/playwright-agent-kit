import { test as base, Page } from "@playwright/test";

type pageFixtures = {
  homePage: Page;
};

export const test = base.extend<pageFixtures>({
  homePage: async ({ page }, use) => {
    await page.goto("/");
    await use(page);
  }
});

export { expect } from "@playwright/test";
