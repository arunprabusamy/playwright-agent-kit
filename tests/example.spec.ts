import { test, expect } from "@fixtures/index";
import { HomePage } from "@pages/home.page";

test("Home page sample test", async ({ homePage }) => {
  await expect(homePage.page).toHaveTitle(HomePage.TITLE_PATTERN);
  await homePage.pliersImage.click();
});

test("Contact page sample test", async ({ contactPage }) => {
  await contactPage.goToContactPage();
  await expect(contactPage.sendButton).toBeVisible();
});
