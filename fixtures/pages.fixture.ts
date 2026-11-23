import { test as base, Page } from "@playwright/test";
import { HomePage } from "../pages/home.page";
import { ContactPage } from "../pages/contact.page";

type PageFixtures = {
  homePage: HomePage;
  contactPage: ContactPage;
};

export const test = base.extend<PageFixtures>({
  homePage: async ({ page }, use) => {
    await page.goto("/");
    await use(new HomePage(page));
  },

  contactPage: async ({ page }, use) => {
    await page.goto("/");
    await use(new ContactPage(page));
  },
});

export { expect } from "@playwright/test";
