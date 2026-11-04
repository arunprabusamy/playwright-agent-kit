import { test, expect } from "../fixtures/pages.fixture";

test("Home page sample test", async ({ homePage }) => {
  // await expect(homePage).toHaveTitle(
  //   "Practice Software Testing - Toolshop - v5.0"
  // );
  await homePage.pliersImage.click();
});
