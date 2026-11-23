import { test, expect } from "../fixtures/pages.fixture";

test("Home page sample test", async ({ homePage }) => {
  await expect(homePage.page).toHaveTitle(
    "Practice Software Testing - Toolshop - v5.0",
  );
  await homePage.pliersImage.click();
});

test("Contact page sample test", async ({ contactPage }) => {
  await contactPage.goToContactPage();
  await expect(contactPage.sendButton).toBeVisible();
});
