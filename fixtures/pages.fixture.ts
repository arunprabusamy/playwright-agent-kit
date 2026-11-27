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
    const homePage = new HomePage(page);
    await homePage.goto();
    await use(homePage);
  },

  contactPage: async ({ page }, use) => {
    const contactPage = new ContactPage(page);
    await contactPage.goto();
    await use(contactPage);
  },

  // Overrides project-level storageState so tests get an unauthenticated browser context.
  freshPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});
