import { test as base, Page } from "@playwright/test";
import { HomePage } from "../pages/home.page";

type PageFixtures = {
  homePage: HomePage;
};

export const test = base.extend<PageFixtures>({
  homePage: async ({ page }, use) => {
    await page.goto("/");
    await use(new HomePage(page));
  }
});

export { expect } from "@playwright/test";
