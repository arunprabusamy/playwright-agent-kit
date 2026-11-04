import { test as base, Page } from "@playwright/test";

type pageFixtures = {
  homePage: Page;
};

const baseUrl = process.env.URL;
if (!baseUrl) throw new Error("URL is required");

export const test = base.extend<pageFixtures>({
  homePage: async ({ page }, use) => {
    await page.goto(baseUrl);
    use(page);
  }
});

export { expect } from "@playwright/test";
