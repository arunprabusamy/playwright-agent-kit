import { test, expect } from "@fixtures/index";

test("Home page sample test", async ({ homePage }) => {
  await homePage.pliersImage.click();
});

test("Contact page sample test", async ({ contactPage }) => {
  await expect(contactPage.sendButton).toBeVisible();
});
