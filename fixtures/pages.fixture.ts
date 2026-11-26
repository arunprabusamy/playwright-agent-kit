import { test as base, Page } from "@playwright/test";
import { HomePage } from "@pages/home.page";
import { ContactPage } from "@pages/contact.page";

type PageFixtures = {
  homePage: HomePage;
  contactPage: ContactPage;
  freshPage: Page;
};

export const test = base.extend<PageFixtures>({
  homePage: async ({ page }, use) => {
    await page.goto("/");
    await use(new HomePage(page));
  },

  contactPage: async ({ page }, use) => {
    await page.goto("/contact");
    await use(new ContactPage(page));
  },

  // Overrides project-level storageState so tests get an unauthenticated browser context.
  freshPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});
